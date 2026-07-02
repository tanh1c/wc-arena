import { SpinLoading } from 'respinner';

type LoadingScreenProps = {
  label: string;
};

export default function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-page text-main p-6 flex items-center justify-center overflow-hidden">
      <div className="relative w-full max-w-sm border-4 border-main bg-card px-6 py-8 text-center shadow-[10px_10px_0_var(--color-shadow)] rounded-sm" role="status" aria-live="polite">
        <div className="absolute -top-4 left-6 border-4 border-main bg-c1 px-3 py-1 font-black uppercase text-[10px] tracking-[0.25em] shadow-[4px_4px_0_var(--color-shadow)]">Loading</div>
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-main bg-page shadow-[6px_6px_0_var(--color-shadow)]">
          <SpinLoading color="var(--color-main)" count={12} />
        </div>
        <div className="font-black uppercase tracking-[-0.04em] text-3xl">We Know Ball</div>
        <div className="mt-2 font-black uppercase text-xs tracking-[0.2em] text-subtle">{label}</div>
      </div>
    </div>
  );
}
