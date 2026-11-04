/*
 * Renders a PDF to canvases with pdf.js, entirely on the phone (works offline).
 * pdf.js is loaded on demand: it is big and only the document viewer needs it.
 * The legacy build is used because drivers' phones may have an outdated WebView
 * (the modern build needs very recent JavaScript APIs).
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import './withResolvers';

type Pdfjs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<Pdfjs> | null = null;

const loadPdfjs = () => {
  pdfjsPromise ??= (import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<Pdfjs>).then((pdfjs) => {
    // Our own worker entry, so the polyfill also runs inside the worker
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    return pdfjs;
  });
  return pdfjsPromise;
};

export const abrirPdf = async (bytes: Uint8Array): Promise<PDFDocumentProxy> => {
  const pdfjs = await loadPdfjs();
  // pdf.js takes ownership of the buffer: pass a copy so the caller can re-render
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
};

/** Draws every page, `cssWidth` px wide, sharp on high-density screens. */
export const renderizarPaginas = async (pdf: PDFDocumentProxy, cssWidth: number) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
};
