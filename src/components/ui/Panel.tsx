import React from 'react';

type PanelProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section className={`bg-card border-4 border-main flex flex-col shadow-[4px_4px_0_0_var(--color-shadow)] ${className}`}>
      {title && <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-xs border-b-4 border-main">{title}</div>}
      {children}
    </section>
  );
}
