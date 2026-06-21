import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Crown, LockKeyhole, Shield, Trophy, Users } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { listGlobalLeaderboard, type LeaderboardEntryWithProfile } from '../services/leaderboard';
import { listLeagueMemberCounts, listLeagues, type LeagueRow } from '../services/leagues';
import { getErrorMessage } from '../services/serviceTypes';
import { getPublicDisplayName } from '../utils/displayName';
import type { ThemeControls } from '../App';

type LeaguesProps = {
  themeControls: ThemeControls;
};

export default function Leagues({ themeControls }: LeaguesProps) {
  const { t } = useTranslation();
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [leagueMemberCounts, setLeagueMemberCounts] = useState<Map<string, number>>(new Map());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([listLeagues(), listGlobalLeaderboard()])
      .then(async ([nextLeagues, nextLeaderboard]) => {
        const nextMemberCounts = await listLeagueMemberCounts(nextLeagues.map((league) => league.id));
        if (!active) return;
        setLeagues(nextLeagues);
        setLeagueMemberCounts(nextMemberCounts);
        setLeaderboard(nextLeaderboard);
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

  const getLeagueMemberCount = (leagueId: string) => leagueMemberCounts.get(leagueId) ?? 0;
  const totalMembers = leagues.reduce((sum, league) => sum + getLeagueMemberCount(league.id), 0);
  const privateCount = leagues.filter((league) => league.visibility === 'private').length;
  const publicCount = leagues.length - privateCount;
  const topEntry = leaderboard[0];
  const topUsername = topEntry ? getPublicDisplayName(topEntry.profiles, topEntry.user_id) : null;

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main leading-none">
            {t('ui.leagues')}
          </h1>
        </div>

        <div className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 lg:gap-6 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 border-r-4 xl:border-b-0 border-main p-2.5 sm:p-4 lg:p-5 bg-c1 text-main min-w-0">
              <div className="shrink-0"><Trophy size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('ui.activeLeagues')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{leagues.length}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('ui.liveContests')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c2 text-inv min-w-0">
              <div className="shrink-0"><Users size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('ui.members')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{totalMembers.toLocaleString()}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('ui.acrossLeagues')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-r-4 xl:border-r-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c3 text-main min-w-0">
              <div className="shrink-0"><LockKeyhole size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('ui.privateLabel')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none">{privateCount}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{t('ui.inviteOnly')}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 border-main p-2.5 sm:p-4 lg:p-5 bg-c4 text-main min-w-0">
              <div className="shrink-0"><Crown size={24} className="sm:w-9 sm:h-9" strokeWidth={2.5} /></div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[9px] sm:text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90 truncate">{t('ui.leader')}</div>
                <div className="text-lg sm:text-3xl font-black leading-none truncate">{topUsername ?? '—'}</div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase mt-1 truncate">{topEntry?.points ?? 0} {t('ui.pointsShort')}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row flex-1">
            <div className="flex-1 border-r-0 xl:border-r-4 border-main flex flex-col bg-card min-w-0">
              <div className="bg-main text-inv font-black px-3 sm:px-4 py-2.5 sm:py-3 uppercase tracking-wide text-xs sm:text-sm border-b-4 border-main flex items-center justify-between">
                <span>{t('ui.leagueDirectory')}</span>
                <span className="text-[10px] font-bold text-faint">{t('ui.leaguesCount', { count: leagues.length })}</span>
              </div>
              <div className="flex flex-col bg-card">
                {loading && <div className="p-6 font-black uppercase text-sm">{t('ui.loadingLeague')}</div>}
                {error && <div className="p-6 font-black uppercase text-sm bg-c5 text-main border-b-4 border-main">{error}</div>}
                {!loading && !error && leagues.length === 0 && <div className="p-6 font-black uppercase text-sm">{t('ui.noLeagues')}</div>}
                {!loading && !error && leagues.map((league) => (
                  <article key={league.id} className="grid grid-cols-1 lg:grid-cols-[1fr_260px] border-b-4 border-main last:border-b-0 hover:bg-muted transition-colors">
                    <div className="p-3 sm:p-4 lg:p-5 lg:border-r-2 border-main flex flex-col gap-3 sm:gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black uppercase text-xl sm:text-2xl lg:text-3xl tracking-tighter text-main leading-none truncate">{league.name}</div>
                          <div className="font-bold uppercase text-[10px] sm:text-xs text-subtle mt-1 truncate">/{league.slug}</div>
                        </div>
                        <div className="bg-c1 border-2 border-main px-2.5 sm:px-3 py-1 font-black uppercase text-[9px] sm:text-[10px] w-fit shrink-0">{league.visibility}</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 border-2 border-main text-xs sm:text-sm font-bold overflow-hidden">
                        <div className="p-2.5 sm:p-3 border-r-2 border-b-2 lg:border-b-0 border-main">
                          <div className="font-black uppercase text-[9px] sm:text-[10px] text-subtle">{t('ui.members')}</div>
                          {getLeagueMemberCount(league.id).toLocaleString()}
                        </div>
                        <div className="p-2.5 sm:p-3 lg:border-r-2 border-b-2 lg:border-b-0 border-main">
                          <div className="font-black uppercase text-[9px] sm:text-[10px] text-subtle">{t('ui.scoring')}</div>
                          <span className="truncate block">{league.scoring_mode}</span>
                        </div>
                        <div className="p-2.5 sm:p-3 border-r-2 border-main">
                          <div className="font-black uppercase text-[9px] sm:text-[10px] text-subtle">{t('ui.prizeMode')}</div>
                          <span className="truncate block">{league.prize_mode}</span>
                        </div>
                        <div className="p-2.5 sm:p-3">
                          <div className="font-black uppercase text-[9px] sm:text-[10px] text-subtle">{t('ui.inviteCode')}</div>
                          <span className="truncate block">{league.invite_code}</span>
                        </div>
                      </div>
                      <Link to={`/leagues/${league.id}`} className="lg:hidden bg-c2 hover:bg-main text-inv font-black uppercase py-2.5 px-4 border-2 border-main text-center text-xs transition-colors shadow-[2px_2px_0_var(--color-shadow)]">
                        {t('ui.viewLeague')}
                      </Link>
                    </div>
                    <div className="hidden lg:flex p-4 lg:p-5 flex-col justify-center gap-3 bg-muted">
                      <div className="font-black uppercase text-[10px] tracking-widest text-subtle">{t('ui.contestGroup')}</div>
                      <div className="font-bold text-sm leading-snug text-main">{t('ui.contestGroupBody')}</div>
                      <Link to={`/leagues/${league.id}`} className="bg-c2 hover:bg-main text-inv font-black uppercase py-3 px-4 border-2 border-main text-center text-xs transition-colors">
                        {t('ui.viewLeague')}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="w-full xl:w-[360px] bg-card flex flex-col border-t-4 xl:border-t-0 border-main">
              <div className="bg-main text-inv font-black px-3 sm:px-4 py-2.5 sm:py-3 uppercase tracking-wide text-xs sm:text-sm border-b-4 border-main">
                {t('ui.leagueSnapshot')}
              </div>
              <div className="p-3 sm:p-4 bg-card grid grid-cols-3 xl:flex xl:flex-col gap-2 xl:gap-3 text-xs sm:text-sm font-bold border-b-4 border-main">
                <div className="flex flex-col xl:flex-row xl:justify-between border-2 xl:border-0 xl:border-b-2 border-main xl:border-line p-2 xl:p-0 xl:pb-2"><span className="uppercase text-[9px] xl:text-sm">{t('ui.publicLabel')}</span><span className="font-black">{publicCount}</span></div>
                <div className="flex flex-col xl:flex-row xl:justify-between border-2 xl:border-0 xl:border-b-2 border-main xl:border-line p-2 xl:p-0 xl:pb-2"><span className="uppercase text-[9px] xl:text-sm">{t('ui.privateLabel')}</span><span className="font-black">{privateCount}</span></div>
                <div className="flex flex-col xl:flex-row xl:justify-between border-2 xl:border-0 border-main p-2 xl:p-0"><span className="uppercase text-[9px] xl:text-sm">{t('ui.members')}</span><span className="font-black">{totalMembers.toLocaleString()}</span></div>
              </div>

              <div className="hidden xl:block bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.topPlayer')}
              </div>
              <div className="hidden xl:block p-4 bg-c1 text-main font-black uppercase border-b-4 border-main">
                <div className="text-3xl tracking-tighter">{topUsername ?? '—'}</div>
                <div className="text-xs mt-1 opacity-80">{t('ui.pointsOnGlobalBoard', { points: topEntry?.points ?? 0 })}</div>
              </div>

              <div className="hidden xl:flex flex-1 bg-card flex-col">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                  {t('ui.integrityNote')}
                </div>
                <div className="p-4 bg-c3 text-main font-black uppercase text-xs leading-relaxed flex items-start gap-3 flex-1">
                  <Shield size={22} className="shrink-0" />
                  <span>{t('ui.leaguesIntegrityBody')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
