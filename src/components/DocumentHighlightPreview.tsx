'use client';

/* Renders an uploaded document (image or PDF page 1) and overlays a
 * highlight box over the active field's location, using the 0-1000
 * normalized bounding boxes Gemini returns alongside extraction
 * (src/lib/gemini/extract.ts). Only page 0 is rendered/highlighted —
 * a documented simplification since invoices are typically one page. */

import { useEffect, useRef, useState } from 'react';
import { I } from '@/components/icons';
import type { FieldBox } from '@/lib/gemini/extract';
import type { PDFPageProxy } from 'pdfjs-dist';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export function DocumentHighlightPreview({ url, mimeType, fileName = 'document', boxes = [], activeField = null }: {
  url: string | null;
  mimeType: string | null;
  fileName?: string;
  boxes?: FieldBox[];
  activeField?: string | null;
}) {
  const [zoom, setZoom] = useState(1);
  const box = activeField ? boxes.find(b => b.field === activeField && b.page === 0) : undefined;

  // Reset zoom whenever a new document is loaded.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setZoom(1); }, [url]);

  if (!url || !mimeType) {
    return <div className="empty"><I.doc size={32} /><div style={{ marginTop: 10 }}>No document loaded</div></div>;
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 8 }}>
        <button className="cap-vbtn" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}><I.minus size={15} /></button>
        <span style={{ fontSize: 12.5, alignSelf: 'center', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button className="cap-vbtn" title="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}><I.plus size={15} /></button>
      </div>
      <div style={{ position: 'relative', display: 'inline-block', width: `${zoom * 100}%`, minWidth: '100%' }}>
        {mimeType === 'application/pdf'
          ? <PdfPageCanvas url={url} zoom={zoom} />
          : mimeType === 'image/heic' || mimeType === 'image/heif'
          ? <HeicImage url={url} fileName={fileName} />
          : (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary blob/signed URL, not an optimizable static asset
            <img src={url} alt={fileName} style={{ width: '100%', display: 'block', boxShadow: 'var(--shadow)' }} />
          )}
        {box && (
          <div style={{
            position: 'absolute',
            top: `${box.yMin / 10}%`, left: `${box.xMin / 10}%`,
            width: `${(box.xMax - box.xMin) / 10}%`, height: `${(box.yMax - box.yMin) / 10}%`,
            background: 'var(--accent-ring)', outline: '2px solid var(--accent)', borderRadius: 3,
            transition: 'all 0.15s', pointerEvents: 'none',
          }} />
        )}
      </div>
    </div>
  );
}

// Phone-scanner apps (Notes/Files scan-to-PDF, etc.) commonly report a huge
// page point-size for a single embedded high-res photo (4000pt+ on the long
// edge). BASE_CAP_DIM sets the resolution used for the initial fit-to-width
// render — deriving the scale from the page's point-size means those huge
// pages get rendered at LOWER resolution than the photo was captured at,
// which is what blurs thin printed text and handwriting away to illegible
// smudges while thick table gridlines and pen strokes survive (they don't
// get diluted below visibility the way 1-2px glyph strokes do).
//
// Critically, zooming in must re-run pdf.js's rasterization at a higher
// scale, not just CSS-stretch the existing bitmap — stretching a bitmap
// that was already rendered below-native-resolution cannot recover detail
// that was never rasterized in the first place. ZOOM_CAP_DIM is the ceiling
// for that re-render, only reached when the user actively zooms in (so the
// larger memory cost isn't paid on every load).
const BASE_CAP_DIM = 4200;
const ZOOM_CAP_DIM = 9000;
const MAX_SCALE = 4;

function PdfPageCanvas({ url, zoom }: { url: string; zoom: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  // Load the document and its first page once per url.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(null);
    setError(null);
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        // Scanned invoices often use JBIG2 for the printed black/white layer
        // (much smaller than JPEG for text). Without wasmUrl, pdf.js can't
        // find its JBIG2/OpenJPEG decoders and silently drops that layer —
        // gridlines/photos/handwriting still render, but all printed text
        // vanishes. See scripts/copy-pdfjs-wasm.js for how this gets there.
        const pdf = await pdfjsLib.getDocument({ url, wasmUrl: '/pdfjs-wasm/' }).promise;
        const loadedPage = await pdf.getPage(1);
        if (!cancelled) setPage(loadedPage);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to load PDF'); setRendering(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // Re-rasterize at a resolution that scales with zoom, so zooming in reveals
  // real detail instead of stretching an already-blurry bitmap.
  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRendering(true);
    (async () => {
      try {
        const base = page.getViewport({ scale: 1 });
        const longEdge = Math.max(base.width, base.height);
        const fitScale = Math.min(MAX_SCALE, BASE_CAP_DIM / longEdge);
        const scale = Math.min(fitScale * zoom, ZOOM_CAP_DIM / longEdge);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingQuality = 'high';
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendering(false);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : 'Failed to render PDF'); setRendering(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [page, zoom]);

  if (error) {
    return <div className="empty"><I.alert size={28} /><div style={{ marginTop: 8, fontSize: 12.5 }}>{error}</div></div>;
  }
  return (
    <div style={{ position: 'relative' }}>
      {rendering && (
        <div className="empty"><I.refresh size={24} style={{ animation: 'spin 0.9s linear infinite' }} /><div style={{ marginTop: 8, fontSize: 12.5 }}>Rendering PDF…</div></div>
      )}
      <canvas ref={canvasRef} style={{ width: '100%', display: rendering ? 'none' : 'block', boxShadow: 'var(--shadow)' }} />
    </div>
  );
}

// Browsers cannot decode HEIC/HEIF (the default format for iPhone camera
// photos) in an <img> tag, so phone-photographed "hardcopy" invoices would
// otherwise render as blank even though Gemini extracts them fine
// server-side. Convert to a JPEG blob client-side just for display.
function HeicImage({ url, fileName }: { url: string; fileName: string }) {
  const [jpegUrl, setJpegUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJpegUrl(null);
    setError(null);
    (async () => {
      try {
        const heic2any = (await import('heic2any')).default;
        const res = await fetch(url);
        const blob = await res.blob();
        const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
        if (cancelled) return;
        const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
        objectUrl = URL.createObjectURL(jpegBlob);
        setJpegUrl(objectUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render image');
      }
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  if (error) {
    return <div className="empty"><I.alert size={28} /><div style={{ marginTop: 8, fontSize: 12.5 }}>{error}</div></div>;
  }
  if (!jpegUrl) {
    return <div className="empty"><I.refresh size={24} style={{ animation: 'spin 0.9s linear infinite' }} /><div style={{ marginTop: 8, fontSize: 12.5 }}>Rendering image…</div></div>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- converted blob URL, not an optimizable static asset
  return <img src={jpegUrl} alt={fileName} style={{ width: '100%', display: 'block', boxShadow: 'var(--shadow)' }} />;
}
