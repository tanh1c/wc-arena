import type { PredictionDisplayStatus } from '../../types/domain';

type StatusPillProps = {
  status: PredictionDisplayStatus;
};

const statusClasses: Record<PredictionDisplayStatus, string> = {
  pending: 'bg-card text-main',
  locked: 'bg-muted text-main',
  exact: 'bg-c1 text-main',
  correct: 'bg-c3 text-main',
  missed: 'bg-c5 text-inv',
};

const statusLabels: Record<PredictionDisplayStatus, string> = {
  pending: 'Pending',
  locked: 'Locked',
  exact: 'Exact Score',
  correct: 'Correct',
  missed: 'Missed',
};

export default function StatusPill({ status }: StatusPillProps) {
  return <span className={`inline-flex border-2 border-main px-2 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}
