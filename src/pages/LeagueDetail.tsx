import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Crown, Shield, Trophy, Users } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import RankBadge from '../components/ui/RankBadge';
import StreakBadge from '../components/ui/StreakBadge';
import { listLeagueActivity, type ActivityEventRow } from '../services/activity';
import { listLeagueLeaderboard, type LeaderboardEntryWithProfile } from '../services/leaderboard';
import { getLeague, getLeagueMemberCount, listLeagueMembers, type LeagueMemberRow, type LeagueRow } from '../services/leagues';
import { getErrorMessage } from '../services/serviceTypes';
import { getCurrentProfile, type ProfileRow } from '../services/profile';
import { getPublicDisplayName } from '../utils/displayName';
import type { ThemeControls } from '../App';

type LeagueDetailProps = {
  themeControls: ThemeControls;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function LeagueDetail({ themeControls }: LeagueDetailProps) {
  const { t } = useTranslation();
  const { leagueId } = useParams();
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [creator, setCreator] = useState<ProfileRow | null>(null);
  const [standings, setStandings] = useState<LeaderboardEntryWithProfile[]>([]);
  const [members, setMembers] = useState<LeagueMemberRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [leagueActivity, setLeagueActivity] = useState<ActivityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setCreator(null);

    getLeague(leagueId)
      .then(async (nextLeague) => {
        const [nextStandings, nextCreator, nextMembers, nextMemberCount, nextActivity] = await Promise.all([
          listLeagueLeaderboard(nextLeague.id),
          nextLeague.creator_id ? getCurrentProfile(nextLeague.creator_id).catch(() => null) : Promise.resolve(null),
          listLeagueMembers(nextLeague.id),
          getLeagueMemberCount(nextLeague.id),
          listLeagueActivity(nextLeague.id),
        ]);
        if (!active) return;
        setLeague(nextLeague);
        setStandings(nextStandings);
        setCreator(nextCreator);
        setMembers(nextMembers);
        setMemberCount(nextMemberCount);
        setLeagueActivity(nextActivity);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(getErrorMessage(nextError));
        setLeague(null);
        setStandings([]);
        setMembers([]);
        setMemberCount(0);
        setLeagueActivity([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [leagueId]);

  if (loading) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">{t('ui.loadingLeague')}</h1>
          </div>
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
            <div className="p-6 bg-card border-b-4 border-main font-black uppercase text-sm">{t('ui.loadingLeague')}</div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !league) {
    return (
      <AppShell themeControls={themeControls}>
        <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">{t('ui.leagueNotFound')}</h1>
          </div>
          <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
            <div className="p-6 bg-card border-b-4 border-main font-black uppercase text-sm">{error ?? t('ui.leagueUnavailable')}</div>
            <div className="p-4 bg-card">
              <Link to="/leagues" className="inline-flex bg-c2 text-inv font-black uppercase py-3 px-4 border-2 border-main items-center gap-2"><ArrowLeft size={16} /> {t('ui.backToLeagues')}</Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const memberPreview = standings.length > 0 ? standings : [];

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/leagues" className="bg-card hover:bg-muted border-2 border-main p-2 shadow-[3px_3px_0_var(--color-shadow)]"><ArrowLeft size={18} /></Link>
            <div className="border-2 border-main bg-c3 px-3 py-1 font-black uppercase text-xs">{league.visibility}</div>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">
            {league.name}
          </h1>
          <p className="font-bold text-sm text-subtle max-w-xl">{t('ui.leagueStandingsBody')}</p>
        </div>

        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-4 border-b-4 sm:border-r-4 xl:border-b-0 border-main p-4 lg:p-5 bg-c1 text-main">
              <Users size={36} strokeWidth={2.5} />
              <div><div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.members')}</div><div className="text-2xl sm:text-3xl font-black leading-none">{memberCount.toLocaleString()}</div><div className="text-[10px] font-bold uppercase mt-1">{league.visibility}</div></div>
            </div>
            <div className="flex items-center gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-4 lg:p-5 bg-c2 text-inv">
              <Trophy size={36} strokeWidth={2.5} />
              <div><div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.scoring')}</div><div className="text-2xl sm:text-3xl font-black leading-none uppercase">{league.scoring_mode}</div><div className="text-[10px] font-bold uppercase mt-1">{t('ui.ruleset')}</div></div>
            </div>
            <div className="flex items-center gap-4 border-b-4 sm:border-b-0 sm:border-r-4 border-main p-4 lg:p-5 bg-c3 text-main">
              <Shield size={36} strokeWidth={2.5} />
              <div><div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.prizeMode')}</div><div className="text-2xl sm:text-3xl font-black leading-none uppercase">{league.prize_mode}</div><div className="text-[10px] font-bold uppercase mt-1">{t('ui.contestSafe')}</div></div>
            </div>
            <div className="flex items-center gap-4 border-main p-4 lg:p-5 bg-c4 text-main">
              <Crown size={36} strokeWidth={2.5} />
              <div><div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('ui.creator')}</div><div className="text-2xl sm:text-3xl font-black leading-none">{getPublicDisplayName(creator)}</div><div className="text-[10px] font-bold uppercase mt-1">{formatDate(league.created_at)}</div></div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row flex-1">
            <div className="flex-1 border-r-0 xl:border-r-4 border-main flex flex-col bg-card min-w-0">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main flex justify-between items-center">
                <span>{t('ui.standings')}</span>
                <Link to="/leagues" className="text-[10px] opacity-80 hover:underline inline-flex items-center gap-1"><ArrowLeft size={12} /> {t('ui.allLeagues')}</Link>
              </div>
              <div className="hidden md:grid grid-cols-[80px_1fr_120px_120px_120px_120px] bg-card border-b-4 border-main font-black uppercase text-[10px] tracking-widest text-subtle">
                <div className="p-3 border-r-2 border-main text-center">{t('ui.rank')}</div>
                <div className="p-3 border-r-2 border-main">{t('ui.player')}</div>
                <div className="p-3 border-r-2 border-main text-center">{t('ui.tier')}</div>
                <div className="p-3 border-r-2 border-main text-center">{t('ui.points')}</div>
                <div className="p-3 border-r-2 border-main text-center">{t('ui.accuracy')}</div>
                <div className="p-3 text-center">{t('ui.streak')}</div>
              </div>
              <div className="bg-card flex flex-col">
                {standings.length === 0 && <div className="p-6 font-black uppercase text-sm">{t('ui.noStandings')}</div>}
                {standings.map((entry) => (
                  <div key={entry.user_id} className="grid grid-cols-1 md:grid-cols-[80px_1fr_120px_120px_120px_120px] border-b-4 border-main last:border-b-0 font-bold text-sm hover:bg-muted transition-colors">
                    <div className="p-3 md:border-r-2 border-main font-black text-lg md:text-center">#{entry.rank}</div>
                    <div className="p-3 md:border-r-2 border-main"><div className="font-black uppercase">{getPublicDisplayName(entry.profiles, entry.user_id)}</div><div className="text-xs text-subtle uppercase">{t('ui.previousRank', { rank: entry.previous_rank ?? entry.rank })}</div></div>
                    <div className="p-3 md:border-r-2 border-main md:flex md:justify-center font-black"><RankBadge points={entry.points} size="sm" showLabel={false} /></div>
                    <div className="p-3 md:border-r-2 border-main md:text-center font-black">{entry.points}</div>
                    <div className="p-3 md:border-r-2 border-main md:text-center font-black">{entry.accuracy}%</div>
                    <div className="p-3 md:text-center font-black"><StreakBadge streak={entry.streak} size="sm" /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full xl:w-[380px] bg-card flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.leagueInfo')}
              </div>
              <div className="p-4 bg-card flex flex-col gap-3 text-sm font-bold border-b-4 border-main">
                <div className="flex justify-between border-b-2 border-line pb-2"><span>{t('ui.inviteCode')}</span><span className="font-black">{league.invite_code}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>{t('ui.visibility')}</span><span className="font-black uppercase">{league.visibility}</span></div>
                <div className="flex justify-between border-b-2 border-line pb-2"><span>{t('ui.prizeMode')}</span><span className="font-black uppercase">{league.prize_mode}</span></div>
                <div className="flex justify-between"><span>{t('ui.created')}</span><span className="font-black">{formatDate(league.created_at)}</span></div>
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('ui.membersPreview')}
              </div>
              <div className="bg-card flex flex-col border-b-4 border-main">
                {memberPreview.length > 0 ? memberPreview.map((entry) => (
                  <div key={entry.user_id} className="p-3 border-b-2 border-line last:border-b-0 flex items-center justify-between gap-3 font-bold text-sm">
                    <span className="font-black uppercase truncate">{getPublicDisplayName(entry.profiles, entry.user_id)}</span>
                    <RankBadge points={entry.points} size="sm" showLabel={false} />
                    <span>{entry.points} {t('ui.pointsShort')}</span>
                  </div>
                )) : members.map((member) => (
                  <div key={member.user_id} className="p-3 border-b-2 border-line last:border-b-0 flex items-center justify-between gap-3 font-bold text-sm">
                    <span className="font-black uppercase truncate">{getPublicDisplayName(member.profiles, member.user_id)}</span>
                    <RankBadge points={member.profiles?.points ?? 0} size="sm" showLabel={false} />
                    <span>{member.profiles?.points ?? 0} {t('ui.pointsShort')}</span>
                  </div>
                ))}
                {memberPreview.length === 0 && members.length === 0 && <div className="p-3 font-black uppercase text-xs">{t('ui.noMembers')}</div>}
              </div>

              <div className="flex flex-col flex-1 bg-card">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                  {t('ui.leagueActivity')}
                </div>
                <div className="bg-card flex flex-col flex-1">
                  {leagueActivity.slice(0, 4).map((item) => (
                    <Link key={item.id} to={item.href ?? '/activity'} className="p-4 border-b-2 border-line last:border-b-0 hover:bg-muted">
                      <div className="font-black uppercase text-sm flex items-center gap-2"><Activity size={16} /> {item.title}</div>
                      <div className="font-bold text-xs text-subtle mt-1 leading-snug">{item.description}</div>
                    </Link>
                  ))}
                  {leagueActivity.length === 0 && <div className="p-4 font-black uppercase text-xs">{t('ui.noLeagueActivity')}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
