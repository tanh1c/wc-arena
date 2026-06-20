import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, X } from 'lucide-react';
import PointsCoin from './ui/PointsCoin';

type DailyLoginRewardPopupProps = {
  open: boolean;
  status: 'idle' | 'claiming' | 'claimed';
  alreadyClaimed?: boolean;
  pointsAwarded?: number;
  totalPoints?: number;
  weekday?: number;
  error?: string | null;
  onClaim: () => void;
  onClose: () => void;
};

const weeklyRewards = [1, 2, 3, 4, 5, 6, 7];

export default function DailyLoginRewardPopup({ open, status, alreadyClaimed = false, pointsAwarded = 1, totalPoints, weekday, error, onClaim, onClose }: DailyLoginRewardPopupProps) {
  const { t } = useTranslation();
  const isClaimed = status === 'claimed';
  const isClaiming = status === 'claiming';
  const browserWeekday = new Date().getDay() || 7;
  const currentWeekday = weekday ?? browserWeekday;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 p-4 flex items-center justify-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-login-title"
        className="w-full max-w-lg bg-card border-4 border-main shadow-[8px_8px_0_var(--color-shadow)] text-main"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="bg-main text-inv border-b-4 border-main px-4 py-3 flex items-center justify-between gap-4">
          <div className="font-black uppercase text-sm tracking-wide">{t('dailyLogin.eyebrow')}</div>
          <button type="button" onClick={onClose} className="w-8 h-8 border-2 border-inv flex items-center justify-center hover:bg-c5 hover:text-main transition-colors" aria-label={t('dailyLogin.close')}>
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] border-b-4 border-main">
          <div className="bg-c1 border-b-4 sm:border-b-0 sm:border-r-4 border-main p-5 flex flex-col items-center justify-center text-center">
            <CalendarCheck size={54} strokeWidth={2.5} />
            <div className="mt-3 border-4 border-main bg-card px-4 py-3 shadow-[4px_4px_0_var(--color-shadow)] flex flex-col items-center gap-1">
              <PointsCoin size="xl" />
              <div className="text-4xl font-black leading-none">+{pointsAwarded}</div>
              <div className="text-xs font-black uppercase tracking-widest">{t('common.pointsShort')}</div>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-3">
            <h2 id="daily-login-title" className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none">
              {isClaimed ? t('dailyLogin.title') : t('dailyLogin.readyTitle')}
            </h2>
            <p className="font-bold text-sm text-subtle leading-relaxed">
              {isClaimed ? alreadyClaimed ? t('dailyLogin.alreadyClaimedBody') : t('dailyLogin.body', { points: pointsAwarded }) : t('dailyLogin.readyBody', { points: weeklyRewards[currentWeekday - 1] })}
            </p>
            <p className="font-black uppercase text-xs bg-muted border-2 border-main p-3">
              {isClaimed ? t('dailyLogin.tomorrow') : t('dailyLogin.readyNote')}
            </p>
            {error && <p className="font-black uppercase text-xs bg-c5 border-2 border-main p-3 text-main">{error}</p>}
            <div className="grid grid-cols-7 gap-1">
              {weeklyRewards.map((points, index) => {
                const day = index + 1;
                const isToday = day === currentWeekday;
                return (
                  <div key={day} className={`border-2 border-main p-2 text-center font-black uppercase ${isToday ? 'bg-c2 text-inv' : 'bg-card text-main'}`}>
                    <div className="text-[9px]">{t(`dailyLogin.weekdays.${day}`)}</div>
                    <div className="text-sm">+{points}</div>
                  </div>
                );
              })}
            </div>
            {typeof totalPoints === 'number' && (
              <div className="bg-c2 text-inv border-2 border-main p-3 font-black uppercase text-sm flex items-center justify-between">
                <span>{t('dailyLogin.totalPoints')}</span>
                <span className="flex items-center gap-2"><PointsCoin size="sm" />{totalPoints.toLocaleString()} {t('common.pointsShort')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          {isClaimed ? (
            <>
              <button type="button" onClick={onClose} className="bg-c2 text-inv border-b-4 sm:border-b-0 sm:border-r-4 border-main px-5 py-4 font-black uppercase hover:opacity-90 transition-opacity">
                {t('dailyLogin.continue')}
              </button>
              <Link to="/activity" onClick={onClose} className="bg-card text-main px-5 py-4 font-black uppercase text-center hover:bg-muted transition-colors">
                {t('dailyLogin.viewActivity')}
              </Link>
            </>
          ) : (
            <>
              <button type="button" onClick={onClaim} disabled={isClaiming} className="bg-c2 text-inv border-b-4 sm:border-b-0 sm:border-r-4 border-main px-5 py-4 font-black uppercase hover:opacity-90 disabled:opacity-60 disabled:cursor-wait transition-opacity">
                {isClaiming ? t('dailyLogin.claiming') : t('dailyLogin.claimButton', { points: weeklyRewards[currentWeekday - 1] })}
              </button>
              <button type="button" onClick={onClose} className="bg-card text-main px-5 py-4 font-black uppercase text-center hover:bg-muted transition-colors">
                {t('dailyLogin.later')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
