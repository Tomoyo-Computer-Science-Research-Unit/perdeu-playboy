"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/** Cabeçalho de página: eyebrow + título em Archivo largo + linha de apoio opcional. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  aside
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-b border-line-strong pb-7 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-3 text-[clamp(30px,4.6vw,52px)] text-ink">{title}</h1>
        {lede ? <p className="mt-4 max-w-[62ch] text-[14px] leading-8 text-slate">{lede}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{aside}</div> : null}
    </section>
  );
}

/** Título de seção interna, em Shippori Mincho. */
export function SectionHeading({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
      <div>
        <h2 className="serif text-[22px] leading-snug tracking-[0.06em] text-ink sm:text-[24px]">{title}</h2>
        {sub ? <p className="mt-1 text-[12px] tracking-[0.08em] text-ash">{sub}</p> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}

export function Tag({ children, ghost = false }: { children: ReactNode; ghost?: boolean }) {
  return <span className={ghost ? "tag tag--ghost" : "tag"}>{children}</span>;
}

/** Rótulo + controle. O rótulo é ligado por id para que o nome acessível seja só o texto do rótulo. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="border-l border-line-strong pl-4 text-[12.5px] leading-7 text-slate">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="border border-line px-5 py-8 text-center text-[12px] tracking-[0.14em] text-ash">{children}</p>;
}
