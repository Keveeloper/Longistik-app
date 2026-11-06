import type { ReactNode } from 'react';

/** Numbered step of a full-screen form ("1 Fotos de la entrega"), as in "Cumplir remesa". */
const Paso: React.FC<{ n: number; titulo: string; children: ReactNode }> = ({ n, titulo, children }) => (
  <section className="mt-8 first:mt-0">
    <h2 className="m-0 mb-4 flex items-center gap-3 text-[20px] leading-7 font-semibold text-tinta">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-tinta text-[13px] font-semibold text-white">
        {n}
      </span>
      {titulo}
    </h2>
    {children}
  </section>
);

export default Paso;
