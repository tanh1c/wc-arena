import React from 'react';

type PageHeroProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export default function PageHero({ title, description, children }: PageHeroProps) {
  return (
    <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 shadow-[8px_8px_0_0_var(--color-shadow)]">
      <div>
        <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter mb-2 text-main">{title}</h1>
        <p className="font-bold text-sm lg:text-lg text-main max-w-2xl leading-snug">{description}</p>
      </div>
      {children}
    </div>
  );
}
