// pdf.js needs its JBIG2/OpenJPEG WASM decoders at a URL it can fetch at
// runtime. Scanned invoices commonly use JBIG2 for the black/white printed
// layer (much smaller than JPEG for text) — without these files served from
// a stable path, pdf.js silently drops that layer instead of erroring, so
// printed text vanishes from the rendered page while photos/vector content
// still render fine. Copying into public/ makes them reachable at a fixed
// URL regardless of how the bundler hashes JS/CSS assets.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'wasm');
const dest = path.join(__dirname, '..', 'public', 'pdfjs-wasm');

if (!fs.existsSync(src)) {
  console.warn('[copy-pdfjs-wasm] pdfjs-dist/wasm not found, skipping');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[copy-pdfjs-wasm] copied pdfjs-dist wasm assets to public/pdfjs-wasm');
