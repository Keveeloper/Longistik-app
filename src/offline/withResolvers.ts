/*
 * Promise.withResolvers (Chrome 119+). pdf.js calls it even in its legacy build, and drivers'
 * phones may have an older WebView. Imported for its side effect, both in the page and in
 * the pdf.js worker (src/offline/pdf.worker.ts).
 */
const P = Promise as PromiseConstructor & { withResolvers?: unknown };

if (typeof P.withResolvers !== 'function') {
  P.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export {};
