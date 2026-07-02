import { SpinLoading } from 'respinner';

type LoadingScreenProps = {
  label: string;
};

export default function LoadingScreen({ label }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 min-h-dvh w-screen bg-page text-main overflow-hidden flex items-stretch" role="status" aria-live="polite" aria-label={label}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-line)_1px,transparent_1px),linear-gradient(0deg,var(--color-line)_1px,transparent_1px)] bg-[size:34px_34px] opacity-45" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full border-4 border-main bg-c3 shadow-[12px_12px_0_var(--color-shadow)]" />
      <div className="absolute -right-16 bottom-12 h-64 w-64 rotate-12 border-4 border-main bg-c2 shadow-[12px_12px_0_var(--color-shadow)]" />
      <div className="relative z-10 grid min-h-dvh w-full grid-rows-[auto_1fr_auto] p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between border-4 border-main bg-card px-4 py-3 shadow-[6px_6px_0_var(--color-shadow)]">
          <div className="font-black uppercase tracking-[-0.05em] text-2xl sm:text-4xl">We Know Ball</div>
          <div className="hidden sm:block border-2 border-main bg-c1 px-3 py-1 font-black uppercase text-[10px] tracking-[0.22em]">Match Center</div>
        </div>

        <div className="flex items-center justify-center py-8">
          <div className="relative w-full max-w-5xl border-4 border-main bg-card shadow-[14px_14px_0_var(--color-shadow)]">
            <div className="grid min-h-[360px] grid-cols-1 lg:grid-cols-[1fr_340px]">
              <div className="flex flex-col justify-between gap-8 border-b-4 border-main p-6 sm:p-8 lg:border-b-0 lg:border-r-4 lg:p-10">
                <div>
                  <div className="mb-4 inline-flex border-4 border-main bg-c4 px-3 py-1 font-black uppercase text-[10px] tracking-[0.25em] text-inv shadow-[4px_4px_0_var(--color-shadow)]">MATCH IS LOADING</div>
                  <h1 className="max-w-3xl font-black uppercase tracking-[-0.08em] text-5xl leading-[0.82] sm:text-7xl lg:text-8xl">Hold your line.</h1>
                </div>
                <div className="grid grid-cols-3 gap-2 font-black uppercase text-[9px] sm:text-xs">
                  <div className="border-2 border-main bg-c1 p-3 shadow-[3px_3px_0_var(--color-shadow)]">Fixtures</div>
                  <div className="border-2 border-main bg-c3 p-3 shadow-[3px_3px_0_var(--color-shadow)]">Predictions</div>
                  <div className="border-2 border-main bg-page p-3 shadow-[3px_3px_0_var(--color-shadow)]">Leaderboard</div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-6 bg-c1 p-8 text-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-main bg-card shadow-[8px_8px_0_var(--color-shadow)] sm:h-48 sm:w-48 [&_svg]:h-24 [&_svg]:w-24 sm:[&_svg]:h-28 sm:[&_svg]:w-28">
                  <SpinLoading color="var(--color-main)" count={12} />
                </div>
                <div className="border-4 border-main bg-card px-4 py-3 shadow-[5px_5px_0_var(--color-shadow)]">
                  <div className="font-black uppercase text-xs tracking-[0.22em] text-subtle">{label}</div>
                  <div className="mt-1 font-black uppercase tracking-[-0.04em] text-3xl">Loading</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-4 border-main bg-main font-black uppercase text-[9px] tracking-[0.2em] text-inv shadow-[6px_6px_0_var(--color-shadow)] sm:text-xs">
          <div className="border-r-4 border-main p-3">2026</div>
          <div className="border-r-4 border-main p-3 text-center">Live board</div>
          <div className="p-3 text-right">Stay ready</div>
        </div>
      </div>
    </div>
  );
}
