import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, Bell, Calculator, CalendarCheck, Lock, TrendingUp, Users } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { listCurrentUserActivity, type ActivityEventRow } from '../services/activity';
import { getErrorMessage } from '../services/serviceTypes';
import type { ThemeControls } from '../App';
import type { ActivityItem } from '../types/domain';

type ActivityProps = {
  themeControls: ThemeControls;
};

const activityMeta: Record<ActivityItem['type'], { labelKey: string; icon: typeof Bell; tone: string }> = {
  prediction_locked: { labelKey: 'appPages.activity.types.predictionLocked', icon: Lock, tone: 'bg-c1 text-main' },
  score_calculated: { labelKey: 'appPages.activity.types.scoreCalculated', icon: Calculator, tone: 'bg-c3 text-main' },
  badge_unlocked: { labelKey: 'appPages.activity.types.badgeUnlocked', icon: Award, tone: 'bg-c2 text-inv' },
  rank_changed: { labelKey: 'appPages.activity.types.rankChanged', icon: TrendingUp, tone: 'bg-c4 text-inv' },
  league_joined: { labelKey: 'appPages.activity.types.leagueJoined', icon: Users, tone: 'bg-card text-main' },
  daily_login_reward: { labelKey: 'appPages.activity.types.dailyLoginReward', icon: CalendarCheck, tone: 'bg-c1 text-main' },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function getActivityType(type: string): ActivityItem['type'] {
  if (type in activityMeta) return type as ActivityItem['type'];
  return 'prediction_locked';
}

export default function Activity({ themeControls }: ActivityProps) {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<ActivityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listCurrentUserActivity()
      .then((nextActivity) => {
        if (!active) return;
        setActivity(nextActivity);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedActivity = [...activity].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const badgeCount = activity.filter((item) => item.type === 'badge_unlocked').length;
  const scoringCount = activity.filter((item) => item.type === 'score_calculated').length;
  const leagueCount = activity.filter((item) => item.type === 'league_joined').length;

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main leading-none">
            {t('appPages.activity.title')}
          </h1>
        </div>

        <div className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 lg:gap-6 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 border-r-4 xl:border-b-0 border-main p-2.5 sm:p-4 lg:p-5 bg-c1 text-main min-w-0">
              <div className="shrink-0"><Bell size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('appPages.activity.events')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{activity.length}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('ui.supabaseFeed')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c2 text-inv min-w-0">
              <div className="shrink-0"><Calculator size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('appPages.activity.scores')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{scoringCount}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('appPages.activity.calculated')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-r-4 xl:border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c3 text-main min-w-0">
              <div className="shrink-0"><Award size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('appPages.activity.badges')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{badgeCount}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('appPages.activity.unlocked')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c4 text-main min-w-0">
              <div className="shrink-0"><Users size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('appPages.activity.leagues')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{leagueCount}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('appPages.activity.membership')}</div>
              </div>
            </div>
          </div>

          <div className="xl:hidden border-b-4 border-main bg-card">
            <div className="bg-main text-inv font-black px-3 sm:px-4 py-2.5 uppercase tracking-wide text-xs sm:text-sm border-b-4 border-main">
              {t('appPages.activity.quickFilters')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 sm:p-3">
              {Object.entries(activityMeta).map(([type, meta]) => {
                const Icon = meta.icon;
                const count = activity.filter((item) => item.type === type).length;
                return (
                  <div key={type} className="border-2 border-main bg-page p-2 flex items-center justify-between gap-2 rounded-sm min-w-0">
                    <span className="flex items-center gap-1.5 uppercase font-black text-[9px] sm:text-[10px] min-w-0"><Icon size={14} className="shrink-0" /> <span className="truncate">{t(meta.labelKey)}</span></span>
                    <span className="font-black text-xs shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col xl:flex-row flex-1">
            <div className="flex-1 border-r-0 xl:border-r-4 border-main flex flex-col bg-card min-w-0">
              <div className="bg-main text-inv font-black px-3 sm:px-4 py-2.5 sm:py-3 uppercase tracking-wide text-xs sm:text-sm border-b-4 border-main flex items-center justify-between">
                <span>{t('appPages.activity.notificationFeed')}</span>
                <span className="text-[10px] font-bold text-faint">{t('ui.itemsCount', { count: sortedActivity.length })}</span>
              </div>
              <div className="flex flex-col bg-card">
                {loading && <div className="p-6 font-black uppercase text-sm">{t('ui.loadingActivity')}</div>}
                {error && <div className="p-6 font-black uppercase text-sm bg-c5 text-main border-b-4 border-main">{error}</div>}
                {!loading && !error && sortedActivity.length === 0 && <div className="p-6 font-black uppercase text-sm">{t('ui.noActivity')}</div>}
                {!loading && !error && sortedActivity.map((item) => {
                  const type = getActivityType(item.type);
                  const meta = activityMeta[type];
                  const Icon = meta.icon;
                  return (
                    <Link key={item.id} to={item.href ?? '#'} className="grid grid-cols-[52px_1fr] md:grid-cols-[88px_1fr_180px] border-b-4 border-main last:border-b-0 hover:bg-muted transition-colors min-w-0">
                      <div className={`p-2.5 sm:p-4 md:border-r-2 border-main flex items-center justify-center ${meta.tone}`}>
                        <Icon size={22} className="sm:w-[30px] sm:h-[30px]" strokeWidth={2.5} />
                      </div>
                      <div className="p-3 sm:p-4 md:border-r-2 border-main min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="font-black uppercase text-sm sm:text-lg tracking-tight text-main leading-tight truncate">{item.title}</div>
                          <div className="md:hidden font-black uppercase text-[9px] text-subtle shrink-0">{formatDateTime(item.created_at)}</div>
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-subtle leading-snug line-clamp-2">{item.description}</div>
                        <div className="md:hidden font-black uppercase text-[9px] text-subtle mt-2">{t(meta.labelKey)}</div>
                      </div>
                      <div className="hidden md:flex p-4 flex-col justify-center bg-muted">
                        <div className="font-black uppercase text-[10px] text-subtle">{t(meta.labelKey)}</div>
                        <div className="font-bold text-sm mt-1">{formatDateTime(item.created_at)}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="hidden xl:flex w-full xl:w-[360px] bg-card flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('appPages.activity.quickFilters')}
              </div>
              <div className="bg-card flex flex-col border-b-4 border-main">
                {Object.entries(activityMeta).map(([type, meta]) => {
                  const Icon = meta.icon;
                  const count = activity.filter((item) => item.type === type).length;
                  return (
                    <div key={type} className="flex items-center justify-between p-4 border-b-2 border-line last:border-b-0 font-bold text-sm">
                      <span className="flex items-center gap-2 uppercase"><Icon size={16} /> {t(meta.labelKey)}</span>
                      <span className="font-black">{count}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col flex-1 bg-c1 text-main">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                  {t('appPages.activity.events')}
                </div>
                <div className="p-4 font-black uppercase text-xs leading-relaxed flex-1">
                  {t('appPages.activity.infoNote')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
