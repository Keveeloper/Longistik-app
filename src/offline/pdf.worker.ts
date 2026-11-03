/* pdf.js worker entry: the polyfill must run before pdf.js's own worker code. */
import './withResolvers';
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
