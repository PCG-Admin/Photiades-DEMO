'use client';

/* Renders an uploaded document (image or PDF page 1) and overlays a
 * highlight box over the active field's location, using the 0-1000
 * normalized bounding boxes Gemini returns alongside extraction
 * (src/lib/gemini/extract.ts). Only page 0 is rendered/highlighted —
 * a documented simplification since invoices are typically one page. */

import { useEffect, useRef, useState } from 'react';
import { I } from '@/components/icons';
import type { FieldBox } from '@/lib/gemini/extract';

export function DocumentHighlightPreview({ url, mimeType, fileName = 'document', boxes = [], activeField = null }: {
  url: string | null;
  mimeType: string | null;
  fileName?: string;
  boxes?: FieldBox[];
  activeField?: string | null;
}) {
  const box = activeField ? boxes.find(b => b.field === activeField && b.page === 0) : undefined;

  if (!url || !mimeType) {
    return <div className="empty"><I.doc size={32} /><div style={{ marginTop: 10 }}>No document loaded</div></div>;
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {mimeType === 'application/pdf'
        ? <PdfPageCanvas url={url} />
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
  );
}

// Cap the rendered canvas's longest edge — scanned invoices from phones can
// report a huge page size (4000pt+), and rendering that at high scale would
// produce a multi-tens-of-megapixel canvas that can lock up the tab. But for
// a normal Letter/A4-size page, capping scale at 2 (~1200x1600px) is too low
// — it downsamples a hi-res embedded scan enough that fine printed text
// blurs away to nothing while thick ruled lines and pen strokes survive.
// Raising the ceiling to 4 keeps standard-size pages sharp (~2400x3200px,
// ~7.7MP) while MAX_CANVAS_DIM still clamps oversized phone-scan pages down.
const MAX_CANVAS_DIM = 2600;
const MAX_SCALE = 4;

function PdfPageCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRendering(true);
    setError(null);
    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const pdf = await pdfjsLib.getDocument({ url }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(MAX_SCALE, MAX_CANVAS_DIM / Math.max(base.width, base.height));
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
  }, [url]);

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
