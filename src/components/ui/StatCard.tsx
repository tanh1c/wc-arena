import React from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone: 'lime' | 'blue' | 'green' | 'orange' | 'red' | 'neutral';
};

const toneClasses = {
  lime: 'bg-c1 text-main',
  blue: 'bg-c2 text-inv',
  green: 'bg-c3 text-main',
  orange: 'bg-c4 text-main',
  red: 'bg-c5 text-inv',
  neutral: 'bg-card text-main',
};

export default function StatCard({ label, value, subtitle, icon, tone }: StatCardProps) {
  return (
    <div className={`flex border-4 border-main p-3 lg:p-4 shadow-[4px_4px_0_0_var(--color-shadow)] items-center ${toneClasses[tone]}`}>
      <div className="shrink-0 mr-3 lg:mr-4">{icon}</div>
      <div className="flex flex-col justify-center">
        <div className="text-[10px] lg:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{label}</div>
        <div className="text-2xl lg:text-3xl font-black leading-none tracking-tight">{value}</div>
        {subtitle && <div className="text-[9px] lg:text-[10px] font-bold uppercase mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}
