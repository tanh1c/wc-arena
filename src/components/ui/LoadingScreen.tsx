import { SpinLoading } from 'respinner';

type LoadingScreenProps = {
  label: string;
};

export default function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex min-h-dvh w-screen items-center justify-center bg-page text-main" role="status" aria-live="polite" aria-label={label}>
      <div className="flex flex-col items-center gap-4 text-center">
        <SpinLoading color="var(--color-main)" count={12} />
        <div className="font-black uppercase tracking-[0.18em] text-xs text-subtle">{label}</div>
      </div>
    </div>
  );
}
