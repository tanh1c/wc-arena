import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Award, Flame, Lock, Medal, Sparkles, Trophy } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import RankBadge, { rankTiers } from '../components/ui/RankBadge';
import StreakBadge from '../components/ui/StreakBadge';
import { listBadgeCatalog, listCurrentUserBadges, type BadgeRow, type UserBadgeWithBadge } from '../services/badges';
import { getErrorMessage } from '../services/serviceTypes';
import { getBadgeImageSrc } from '../utils/badgeImages';
import type { ThemeControls } from '../App';

type AchievementsProps = {
  themeControls: ThemeControls;
};

type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

type ShowcaseBadge = {
  badge: BadgeRow;
  progress?: UserBadgeWithBadge;
};

const rarityClasses: Record<BadgeRarity, string> = {
  common: 'bg-card',
  rare: 'bg-c1',
  epic: 'bg-c2 text-inv',
  legendary: 'bg-c4 text-inv',
};

const rarityCountsInitial: Record<BadgeRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
const raritySortOrder: Record<BadgeRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
const rankDivisions = ['I', 'II', 'III'];
const streakLevels = [0, 1, 2, 3, 4, 5, 6];

function getBadgeRarity(value?: string | null): BadgeRarity {
  if (value === 'rare' || value === 'epic' || value === 'legendary') return value;
  return 'common';
}

function getProgressPercent(badge: BadgeRow, progress?: UserBadgeWithBadge) {
  if (!badge.progress_target) return progress?.unlocked_at ? 100 : 0;
  return Math.min(100, Math.round(((progress?.progress_current ?? 0) / badge.progress_target) * 100));
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function splitRankTierName(name: string) {
  const [tierName, division = 'I'] = name.split(' ');
  return { tierName, division };
}

export default function Achievements({ themeControls }: AchievementsProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<BadgeRow[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadgeWithBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<BadgeRarity | ''>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCatalogError(null);
    setProgressError(null);

    Promise.allSettled([listBadgeCatalog(), listCurrentUserBadges()])
      .then(([catalogResult, progressResult]) => {
        if (!active) return;

        if (catalogResult.status === 'fulfilled') {
          setCatalog(catalogResult.value);
        } else {
          setCatalog([]);
          setCatalogError(getErrorMessage(catalogResult.reason));
        }

        if (progressResult.status === 'fulfilled') {
          setUserBadges(progressResult.value);
        } else {
          setUserBadges([]);
          setProgressError(getErrorMessage(progressResult.reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const progressByBadgeId = useMemo(() => {
    return new Map(userBadges.map((userBadge) => [userBadge.badge_id, userBadge]));
  }, [userBadges]);

  const showcaseBadges = useMemo<ShowcaseBadge[]>(() => {
    return catalog
      .map((badge) => ({ badge, progress: progressByBadgeId.get(badge.id) }))
      .sort((a, b) => {
        const rarityDelta = raritySortOrder[getBadgeRarity(a.badge.rarity)] - raritySortOrder[getBadgeRarity(b.badge.rarity)];
        if (rarityDelta !== 0) return rarityDelta;

        const categoryDelta = a.badge.category.localeCompare(b.badge.category);
        if (categoryDelta !== 0) return categoryDelta;

        return a.badge.name.localeCompare(b.badge.name);
      });
  }, [catalog, progressByBadgeId]);

  const unlockedCount = showcaseBadges.filter((item) => item.progress?.unlocked_at).length;
  const inProgressCount = showcaseBadges.filter((item) => item.progress && !item.progress.unlocked_at).length;
  const completion = showcaseBadges.length ? Math.round((unlockedCount / showcaseBadges.length) * 100) : 0;
  const categoryCounts = showcaseBadges.reduce<Record<string, number>>((counts, item) => {
    counts[item.badge.category] = (counts[item.badge.category] ?? 0) + 1;
    return counts;
  }, {});
  const rarityCounts = showcaseBadges.reduce<Record<BadgeRarity, number>>((counts, item) => {
    counts[getBadgeRarity(item.badge.rarity)] += 1;
    return counts;
  }, { ...rarityCountsInitial });
  const badgeRarities = (Object.keys(raritySortOrder) as BadgeRarity[]).filter((rarity) => rarityCounts[rarity] > 0);
  const activeRarity = selectedRarity && rarityCounts[selectedRarity] ? selectedRarity : badgeRarities[0] ?? '';
  const visibleBadges = activeRarity ? showcaseBadges.filter((item) => getBadgeRarity(item.badge.rarity) === activeRarity) : showcaseBadges;
  const rankTiersByDivision = rankDivisions.map((division) => ({
    division,
    tiers: rankTiers.filter((tier) => splitRankTierName(tier.name).division === division),
  }));

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-1 text-main">
            {t('appPages.achievements.title')}
          </h1>
          <p className="font-bold text-subtle max-w-3xl leading-snug">
            {t('appPages.achievements.description')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 font-black uppercase text-xs">
            <Link to="/badges" className="bg-c2 text-inv border-2 border-main px-4 py-3 shadow-[3px_3px_0_var(--color-shadow)]">{t('appPages.achievements.viewBadges')}</Link>
            <Link to="/leaderboard" className="bg-c1 text-main border-2 border-main px-4 py-3 shadow-[3px_3px_0_var(--color-shadow)]">{t('appPages.achievements.viewLeaderboard')}</Link>
            <Link to="/picks" className="bg-main text-inv border-2 border-main px-4 py-3 shadow-[3px_3px_0_var(--color-shadow)]">{t('appPages.achievements.makePredictions')}</Link>
          </div>
        </div>

        <div className="bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-4 border-b-4 sm:border-r-4 xl:border-b-0 border-main p-4 lg:p-5 bg-c1 text-main">
              <Award size={36} strokeWidth={2.5} className="shrink-0" />
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('appPages.achievements.totalBadges')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{showcaseBadges.length}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('appPages.achievements.badgeShowcase')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-4 lg:p-5 bg-c2 text-inv">
              <Trophy size={36} strokeWidth={2.5} className="shrink-0" />
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('appPages.achievements.unlockedBadges')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{unlockedCount}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('appPages.common.unlocked')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-b-4 sm:border-b-0 sm:border-r-4 border-main p-4 lg:p-5 bg-c3 text-main">
              <Sparkles size={36} strokeWidth={2.5} className="shrink-0" />
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('appPages.achievements.inProgressBadges')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{inProgressCount}</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('appPages.common.inProgress')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 border-main p-4 lg:p-5 bg-c4 text-main">
              <Medal size={36} strokeWidth={2.5} className="shrink-0" />
              <div className="flex flex-col justify-center">
                <div className="text-xs uppercase font-black tracking-widest leading-none mb-1 opacity-90">{t('appPages.achievements.completion')}</div>
                <div className="text-2xl sm:text-3xl font-black leading-none">{completion}%</div>
                <div className="text-[10px] font-bold uppercase mt-1">{t('appPages.common.progress')}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row flex-1">
            <div className="flex-1 border-r-0 xl:border-r-4 border-main flex flex-col bg-card min-w-0">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm flex justify-between items-center border-b-4 border-main">
                <span>{t('appPages.achievements.badgeShowcase')}</span>
                <span className="text-c1 font-bold text-xs"><span className="text-accent-inv">{visibleBadges.length}</span> / {showcaseBadges.length}</span>
              </div>
              {loading && <div className="p-6 font-black uppercase text-sm bg-card border-b-4 border-main">Loading achievements...</div>}
              {catalogError && <div className="p-6 font-black uppercase text-sm bg-c5 text-main border-b-4 border-main">{catalogError}</div>}
              {!loading && !catalogError && progressError && <div className="p-4 font-black uppercase text-xs bg-card border-b-4 border-main">{t('appPages.achievements.signInForProgress')}</div>}
              {!loading && !catalogError && showcaseBadges.length === 0 && <div className="p-6 font-black uppercase text-sm bg-card border-b-4 border-main">{t('appPages.achievements.noBadges')}</div>}
              {!loading && !catalogError && showcaseBadges.length > 0 && (
                <>
                  <div className="flex flex-wrap border-b-4 border-main font-black text-xs uppercase bg-card">
                    {badgeRarities.map((rarity) => (
                      <button
                        key={rarity}
                        type="button"
                        onClick={() => setSelectedRarity(rarity)}
                        className={`${activeRarity === rarity ? 'bg-c2 text-accent-inv' : 'bg-card text-main hover:bg-elevated'} px-4 py-3 border-r-4 border-b-4 md:border-b-0 border-main flex-1 min-w-[max-content] md:flex-none`}
                      >
                        {rarity} ({rarityCounts[rarity]})
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 bg-card border-b-4 border-main">
                  {visibleBadges.map(({ badge, progress }, index) => {
                    const imageSrc = getBadgeImageSrc(badge);
                    const rarity = getBadgeRarity(badge.rarity);
                    const progressPercent = getProgressPercent(badge, progress);
                    const isUnlocked = Boolean(progress?.unlocked_at);
                    const hasMdRightBorder = index % 2 === 0;
                    const has2xlRightBorder = index % 3 !== 2;

                    return (
                      <article key={badge.id} className={`flex flex-col border-b-4 border-main ${hasMdRightBorder ? 'md:border-r-4' : ''} ${has2xlRightBorder ? '2xl:border-r-4' : '2xl:border-r-0'}`}>
                        <div className={`p-4 border-b-4 border-main ${rarityClasses[rarity]}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-black uppercase text-xl tracking-tight">{badge.name}</div>
                              <div className="font-black uppercase text-[10px] mt-1 opacity-80">{badge.category} • {badge.rarity}</div>
                            </div>
                            <div className="w-20 h-20 border-2 border-main bg-card text-main flex items-center justify-center shrink-0 overflow-hidden p-1">
                              {imageSrc ? (
                                <img src={imageSrc} alt="" className={`w-full h-full object-contain ${isUnlocked ? '' : 'grayscale opacity-50'}`} />
                              ) : isUnlocked ? <Award size={32} fill="currentColor" /> : <Lock size={30} />}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 flex flex-col gap-4 flex-1 bg-card">
                          <div>
                            <div className="font-black uppercase text-[10px] text-subtle mb-1">{t('appPages.achievements.howToEarn')}</div>
                            <p className="font-bold text-sm text-subtle leading-snug">{badge.description}</p>
                          </div>
                          <div className="grid grid-cols-2 border-2 border-main font-bold text-xs uppercase">
                            <div className="p-3 border-r-2 border-main"><div className="text-[10px] text-subtle font-black">{t('appPages.achievements.pointsRequired')}</div>{badge.progress_target ?? '—'}</div>
                            <div className="p-3"><div className="text-[10px] text-subtle font-black">{t('appPages.common.status')}</div>{isUnlocked ? t('appPages.common.unlocked') : progress ? t('appPages.common.inProgress') : t('appPages.achievements.lockedBadges')}</div>
                          </div>
                          <div>
                            <div className="flex justify-between font-black uppercase text-[10px] mb-2">
                              <span>{t('appPages.common.progress')}</span>
                              <span>{progress?.progress_current ?? 0}/{badge.progress_target ?? 0}</span>
                            </div>
                            <div className="h-5 border-2 border-main bg-muted">
                              <div className="h-full bg-c3" style={{ width: `${progressPercent}%` }} />
                            </div>
                          </div>
                          <div className="mt-auto border-2 border-main bg-muted p-3 font-black uppercase text-xs flex justify-between gap-3">
                            <span>{isUnlocked ? `${t('appPages.common.unlocked')} ${formatDate(progress?.unlocked_at)}` : t('appPages.achievements.keepPredicting')}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  </div>
                </>
              )}

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('appPages.achievements.rankSystem')}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 bg-card border-b-4 border-main">
                {rankTiersByDivision.map(({ division, tiers }, divisionIndex) => (
                  <div key={division} className={`flex flex-col ${divisionIndex !== rankTiersByDivision.length - 1 ? 'xl:border-r-4 border-main' : ''}`}>
                    <div className="bg-muted border-b-4 border-main p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black uppercase text-2xl leading-none">Division {division}</div>
                        <div className="font-black uppercase text-[10px] text-subtle mt-1">Bronze → Grandmaster</div>
                      </div>
                      <div className="bg-main text-inv border-2 border-main px-3 py-2 font-black text-sm">{tiers.length}</div>
                    </div>
                    <div className="flex flex-col">
                      {tiers.map((tier) => {
                        const { tierName } = splitRankTierName(tier.name);

                        return (
                          <div key={tier.name} className="p-3 border-b-2 border-line last:border-b-0 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <RankBadge points={tier.minPoints} size="md" showLabel={false} />
                              <div className="min-w-0">
                                <div className="font-black uppercase text-sm leading-none truncate">{tierName}</div>
                                <div className="font-bold uppercase text-[10px] text-subtle mt-1">{tier.name}</div>
                              </div>
                            </div>
                            <div className="font-black uppercase text-[10px] text-right shrink-0">
                              {tier.minPoints.toLocaleString()}<br />{t('common.pointsShort')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-b-4 border-main bg-card font-bold text-sm text-subtle leading-snug">
                {t('appPages.achievements.rankSystemBody')}
              </div>

              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                {t('appPages.achievements.streakSystem')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-card border-b-4 border-main">
                {streakLevels.map((streak, index) => (
                  <div key={streak} className={`p-4 border-b-4 lg:border-b-0 border-main flex flex-col items-center justify-center gap-2 ${index !== streakLevels.length - 1 ? 'lg:border-r-4' : ''}`}>
                    <StreakBadge streak={streak} size="lg" />
                    <div className="font-black uppercase text-[10px] text-center">{streak} {t('appPages.achievements.consecutiveCorrect')}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-card font-bold text-sm text-subtle leading-snug flex flex-col gap-3">
                <p>{t('appPages.achievements.streakSystemBody')}</p>
                <Link to="/my-predictions" className="inline-flex items-center gap-2 w-fit bg-c2 text-inv border-2 border-main px-4 py-3 font-black uppercase text-xs shadow-[3px_3px_0_var(--color-shadow)]"><Flame size={16} /> {t('nav.items.myPredictions')}</Link>
              </div>
            </div>

            <div className="w-full xl:w-[420px] bg-card flex flex-col">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm flex justify-between items-center border-b-4 border-main">
                <span>{t('appPages.badges.categories')}</span>
                <span className="text-c1 font-bold text-xs"><span className="text-accent-inv">{Object.keys(categoryCounts).length}</span> TYPES</span>
              </div>
              <div className="bg-card flex flex-col border-b-4 border-main">
                {Object.entries(categoryCounts).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-4 border-b-2 border-line last:border-b-0 font-bold text-sm uppercase">
                    <span>{category}</span>
                    <span className="font-black">{count}</span>
                  </div>
                ))}
              </div>

              <div className="bg-main text-inv font-black px-4 py-2 uppercase tracking-wide text-[11px] flex justify-between items-center border-b-4 border-main">
                <span>Rarity Mix</span>
                <span className="text-faint font-bold">SORTED</span>
              </div>
              <div className="p-4 bg-muted flex flex-col gap-3 text-sm font-bold border-b-4 border-main">
                {Object.entries(rarityCounts).map(([rarity, count]) => (
                  <div key={rarity} className="flex justify-between border-b-2 border-line pb-2 last:border-b-0 last:pb-0 uppercase">
                    <span>{rarity}</span>
                    <span className="font-black">{count}</span>
                  </div>
                ))}
              </div>

              <div className="bg-main text-inv font-black px-4 py-2 uppercase tracking-wide text-[11px] flex justify-between items-center border-b-4 border-main">
                <span>{t('appPages.common.action')}</span>
                <span className="text-faint font-bold">NEXT</span>
              </div>
              <div className="p-2 bg-card font-black uppercase flex flex-col gap-1.5 border-b-4 border-main">
                <Link to="/badges" className="bg-card text-main border-2 border-main p-3 flex items-center gap-3 hover:bg-muted"><Award /> {t('appPages.achievements.viewBadges')}</Link>
                <Link to="/leaderboard" className="bg-c1 text-main border-2 border-main p-3 flex items-center gap-3"><Trophy /> {t('appPages.achievements.viewLeaderboard')}</Link>
                <Link to="/picks" className="bg-main text-inv border-2 border-main p-3 flex items-center gap-3"><Sparkles /> {t('appPages.achievements.makePredictions')}</Link>
              </div>

              <div className="flex flex-col flex-1 bg-c1 text-main">
                <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">
                  {t('appPages.achievements.completion')}
                </div>
                <div className="p-4 font-black uppercase flex flex-col gap-3 flex-1 justify-center">
                  <div className="text-5xl tracking-tighter">{completion}%</div>
                  <div className="text-xs leading-relaxed opacity-80">{unlockedCount} of {showcaseBadges.length} badges unlocked.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row bg-card border-t-4 border-main flex-shrink-0">
            <div className="flex items-stretch border-b-4 md:border-b-0 md:border-r-4 border-main flex-1">
              <div className="w-12 flex items-center justify-center border-r-4 border-main font-black text-3xl">1</div>
              <div className="w-12 flex items-center justify-center border-r-4 border-main bg-c1"><Award size={20} className="text-accent-on" /></div>
              <div className="p-2 sm:p-3 flex flex-col justify-center"><div className="font-black uppercase text-xs mb-0.5">Browse Badges</div><div className="font-medium text-[10px] text-subtle leading-tight">See every badge<br className="hidden md:block" />and unlock rule.</div></div>
            </div>
            <div className="flex items-stretch border-b-4 md:border-b-0 md:border-r-4 border-main flex-1">
              <div className="w-12 flex items-center justify-center border-r-4 border-main font-black text-3xl text-accent-inv bg-c2">2</div>
              <div className="w-12 flex items-center justify-center border-r-4 border-main bg-c2"><Trophy size={20} className="text-accent-inv" /></div>
              <div className="p-2 sm:p-3 flex flex-col justify-center"><div className="font-black uppercase text-xs mb-0.5">Climb Rank</div><div className="font-medium text-[10px] text-subtle leading-tight">Earn prediction points<br className="hidden md:block" />to move tiers.</div></div>
            </div>
            <div className="flex items-stretch border-b-4 md:border-b-0 md:border-r-4 border-main flex-1">
              <div className="w-12 flex items-center justify-center border-r-4 border-main font-black text-3xl">3</div>
              <div className="w-12 flex items-center justify-center border-r-4 border-main bg-c3"><Flame size={20} className="text-accent-on" /></div>
              <div className="p-2 sm:p-3 flex flex-col justify-center"><div className="font-black uppercase text-xs mb-0.5">Keep Streaks</div><div className="font-medium text-[10px] text-subtle leading-tight">Chain correct results<br className="hidden md:block" />without a miss.</div></div>
            </div>
            <div className="flex items-stretch flex-1">
              <div className="w-12 flex items-center justify-center border-r-4 border-main font-black text-3xl bg-c4">4</div>
              <div className="w-12 flex items-center justify-center border-r-4 border-main bg-c4"><Sparkles size={20} className="text-accent-on" /></div>
              <div className="p-2 sm:p-3 flex flex-col justify-center"><div className="font-black uppercase text-xs mb-0.5">Track Progress</div><div className="font-medium text-[10px] text-subtle leading-tight">Return to badges<br className="hidden md:block" />for personal status.</div></div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
