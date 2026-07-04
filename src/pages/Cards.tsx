import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Search } from 'lucide-react';
import backCardImage from '../../Backcard.png';
import dailyPackImage from '../../Daily.png';
import elitePackImage from '../../Elite.png';
import iconPackImage from '../../Icon.png';
import premiumPackImage from '../../Premium.png';
import starterPackImage from '../../Starter.png';
import AppShell from '../components/layout/AppShell';
import PointsCoin from '../components/ui/PointsCoin';
import { CARD_PACKS, type CardRarity, type PackType } from '../config/cardPacks';
import type { ThemeControls } from '../App';
import {
  getCurrentUserDailyPackOpenedToday,
  groupCatalogWithOwnership,
  listCurrentUserOwnedCards,
  listCurrentUserShowcase,
  listPlayerCards,
  openCardPack,
  setShowcaseCard,
  type CatalogCardWithOwnedCount,
  type OwnedPlayerCard,
  type ShowcaseCard,
} from '../services/cards';
import { getErrorMessage } from '../services/serviceTypes';
import { getTeamFlag } from '../utils/teamFlags';

type CardsProps = {
  themeControls: ThemeControls;
};

const rarities: Array<'all' | CardRarity> = ['all', 'Common', 'Rare', 'Epic', 'Icon'];
const packTypes: PackType[] = ['daily', 'starter', 'premium', 'elite', 'icon'];

const packArtwork: Record<PackType, { image: string; imageClass?: string }> = {
  daily: { image: dailyPackImage },
  starter: { image: starterPackImage, imageClass: 'scale-[1.10]' },
  premium: { image: premiumPackImage },
  elite: { image: elitePackImage },
  icon: { image: iconPackImage },
};

const rarityCardArtClasses: Record<string, string> = {
  Common: 'bg-[repeating-linear-gradient(135deg,#7fbf5f_0_12px,#d8ff65_12px_24px),linear-gradient(135deg,#173f2b,#7fbf5f)]',
  Rare: 'bg-[linear-gradient(#0088ff_3px,transparent_3px),linear-gradient(90deg,#0088ff_3px,transparent_3px),linear-gradient(135deg,#031a5f,#00d4ff)] bg-[length:22px_22px,22px_22px,auto]',
  Epic: 'bg-[linear-gradient(135deg,transparent_0_34%,#ff2bd6_34%_44%,transparent_44%_100%),linear-gradient(45deg,transparent_0_38%,#ffe600_38%_48%,transparent_48%_100%),linear-gradient(135deg,#2b005f,#6f00ff)]',
  Icon: 'bg-[repeating-conic-gradient(from_0deg_at_50%_50%,#fff0b8_0deg_10deg,#d99a00_10deg_16deg,#111_16deg_18deg)]',
};

const rarityCardFrameClasses: Record<string, string> = {
  Common: 'wc-card-frame-common',
  Rare: 'wc-card-frame-rare',
  Epic: 'wc-card-frame-epic',
  Icon: 'wc-card-frame-icon',
};

const rarityBadgeClasses: Record<string, string> = {
  Common: 'bg-[#d8ff65] text-main',
  Rare: 'bg-[#00d4ff] text-main',
  Epic: 'bg-[#ff2bd6] text-white',
  Icon: 'bg-[#fff0b8] text-main shadow-[0_0_12px_#fff0b8]',
};

const nationFlagCodes: Record<string, string> = {
  Argentina: 'ARG',
  Brazil: 'BRA',
  Croatia: 'CRO',
  England: 'ENG',
  France: 'FRA',
  Germany: 'GER',
  Mexico: 'MEX',
  Netherlands: 'NED',
  Norway: 'NOR',
  Portugal: 'POR',
  'Saudi Arabia': 'KSA',
  Spain: 'ESP',
  'United States': 'USA',
};

function getRarityCardArtClass(rarity: string) {
  return rarityCardArtClasses[rarity] ?? rarityCardArtClasses.Common;
}

function getRarityCardFrameClass(rarity: string) {
  return rarityCardFrameClasses[rarity] ?? rarityCardFrameClasses.Common;
}

function getRarityBadgeClass(rarity: string) {
  return rarityBadgeClasses[rarity] ?? rarityBadgeClasses.Common;
}

function getNationFlag(nationRegion: string) {
  return getTeamFlag(nationFlagCodes[nationRegion] ?? nationRegion, nationRegion);
}

function formatUtcResetCountdown(value = new Date()) {
  const nextReset = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1);
  const remainingSeconds = Math.max(0, Math.floor((nextReset - value.getTime()) / 1000));
  const hours = Math.floor(remainingSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(remainingSeconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function Cards({ themeControls }: CardsProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogCardWithOwnedCount[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseCard[]>([]);
  const [revealedCards, setRevealedCards] = useState<Array<OwnedPlayerCard & { duplicate: boolean }>>([]);
  const [showRevealedReview, setShowRevealedReview] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [flippedRevealCardIds, setFlippedRevealCardIds] = useState(new Set<string>());
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | CardRarity>('all');
  const [loading, setLoading] = useState(true);
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [selectedPackType, setSelectedPackType] = useState<PackType>('daily');
  const [dailyPackOpenedToday, setDailyPackOpenedToday] = useState(false);
  const [dailyResetCountdown, setDailyResetCountdown] = useState('');
  const [activeTab, setActiveTab] = useState<'openPacks' | 'gallery'>('openPacks');
  const [error, setError] = useState('');

  const loadCards = async () => {
    setLoading(true);
    setError('');
    try {
      const [cards, owned, currentShowcase, openedDailyToday] = await Promise.all([
        listPlayerCards(),
        listCurrentUserOwnedCards(),
        listCurrentUserShowcase(),
        getCurrentUserDailyPackOpenedToday(),
      ]);
      setCatalog(groupCatalogWithOwnership(cards, owned));
      setShowcase(currentShowcase);
      setDailyPackOpenedToday(openedDailyToday);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCards();
  }, []);

  useEffect(() => {
    if (!dailyPackOpenedToday) {
      setDailyResetCountdown('');
      return;
    }

    setDailyResetCountdown(formatUtcResetCountdown());
    const intervalId = window.setInterval(() => setDailyResetCountdown(formatUtcResetCountdown()), 1000);
    return () => window.clearInterval(intervalId);
  }, [dailyPackOpenedToday]);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((card) => {
      const matchesRarity = rarity === 'all' || card.rarity === rarity;
      const haystack = `${card.name} ${card.position} ${card.team} ${card.nation_region}`.toLowerCase();
      return matchesRarity && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [catalog, query, rarity]);

  const uniqueOwned = catalog.filter((card) => card.ownedCount > 0).length;
  const showcaseSlotsUsed = showcase.length;

  const handleOpenPack = async (packType: PackType) => {
    setOpeningPack(packType);
    setError('');
    try {
      const result = await openCardPack(packType);
      setRevealedCards(result.cards);
      setShowRevealedReview(false);
      setFlippedRevealCardIds(new Set<string>());
      setRevealModalOpen(result.cards.length > 0);
      if (packType === 'daily') setDailyPackOpenedToday(true);
      window.dispatchEvent(new CustomEvent('wc26:profile-coins-changed', { detail: { coins: result.coins } }));
      await loadCards();
    } catch (nextError) {
      const message = getErrorMessage(nextError);
      if (packType === 'daily' && message === 'Daily pack already opened today.') {
        setDailyPackOpenedToday(true);
      } else {
        setError(message);
      }
    } finally {
      setOpeningPack(null);
    }
  };

  const handleSetShowcase = async (slotNumber: number, ownedCardId: string) => {
    setError('');
    try {
      setShowcase(await setShowcaseCard(slotNumber, ownedCardId));
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  };

  const toggleRevealCard = (cardId: string) => {
    setFlippedRevealCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 lg:gap-6 min-h-0">
        <section className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 w-full xl:w-1/2 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <p className="inline-flex w-fit border-2 border-main bg-c3 px-3 py-1 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">{t('appPages.cards.kicker')}</p>
          <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main leading-none">{t('appPages.cards.title')}</h1>
          <p className="max-w-3xl text-sm font-bold text-muted-foreground">{t('appPages.cards.subtitle')}</p>
        </section>

        {error && <div className="border-4 border-main bg-c2 p-3 font-black uppercase text-sm text-main shadow-[4px_4px_0_var(--color-shadow)]">{error}</div>}

        <section className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 lg:gap-6 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm">
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <StatCell label={t('appPages.cards.collection')} value={uniqueOwned.toLocaleString()} className="bg-c1 text-main" />
            <StatCell label={t('appPages.cards.cards')} value={catalog.length.toLocaleString()} className="bg-c2 text-inv" />
            <StatCell label={t('appPages.cards.revealedCards')} value={revealedCards.length.toLocaleString()} className="bg-c3 text-main" />
            <StatCell label={t('appPages.cards.showcase')} value={`${showcaseSlotsUsed}/3`} className="bg-c4 text-main" />
          </div>

          <div className="grid grid-cols-2 border-b-4 border-main">
            {[
              ['openPacks', 'Open Packs'],
              ['gallery', 'Gallery'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`border-r-4 border-main px-4 py-3 text-left font-black uppercase tracking-tight last:border-r-0 ${activeTab === tab ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}
                onClick={() => setActiveTab(tab as 'openPacks' | 'gallery')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col flex-1 min-h-[560px]">
            {activeTab === 'openPacks' ? (
              <main className="bg-muted min-w-0 flex flex-col">
                <div className="bg-main text-inv border-b-4 border-main p-3 sm:p-4">
                  <h2 className="text-2xl font-black uppercase tracking-tight">Open Packs</h2>
                  <p className="text-sm font-bold text-inv/80">{t('appPages.cards.dailyPack')} · {t('appPages.cards.premiumPack')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3 sm:gap-4 p-3 sm:p-4">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:self-start">
                    {packTypes.map((packType) => {
                      const pack = CARD_PACKS[packType];
                      return (
                        <button
                          key={packType}
                          type="button"
                          className={`border-4 border-main p-2 text-left font-black uppercase shadow-[3px_3px_0_var(--color-shadow)] transition-transform hover:-translate-y-0.5 ${selectedPackType === packType ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}
                          onClick={() => setSelectedPackType(packType)}
                        >
                          <span className="block text-xs leading-tight">{t(`appPages.cards.${packType}Pack`)}</span>
                          <span className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-80">
                            <span>{pack.cardCount} cards</span>
                            <span>{pack.priceCoins === 0 ? 'Free' : `${pack.priceCoins} Coins`}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <PackPanel
                    title={t(`appPages.cards.${selectedPackType}Pack`)}
                    description={t(`appPages.cards.${selectedPackType}PackDescription`, {
                      count: CARD_PACKS[selectedPackType].cardCount,
                      coins: CARD_PACKS[selectedPackType].priceCoins,
                    })}
                    packType={selectedPackType}
                    openingPack={openingPack}
                    isOpenedToday={selectedPackType === 'daily' && dailyPackOpenedToday}
                    dailyResetCountdown={selectedPackType === 'daily' ? dailyResetCountdown : ''}
                    onOpen={handleOpenPack}
                  />
                </div>

                {revealedCards.length > 0 ? (
                  <div className="m-3 sm:m-4 mt-0 rounded-sm border-4 border-main bg-c3 shadow-[4px_4px_0_var(--color-shadow)]">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-t-sm border-b-4 border-main bg-card p-3 text-left text-lg font-black uppercase text-main hover:bg-c1"
                      aria-expanded={showRevealedReview}
                      onClick={() => setShowRevealedReview((current) => !current)}
                    >
                      <span>{t('appPages.cards.revealedCards')}</span>
                      <span className="border-2 border-main bg-c2 px-2 py-1 text-xs text-inv shadow-[2px_2px_0_var(--color-shadow)]">{showRevealedReview ? 'Hide' : 'Show'}</span>
                    </button>
                    {revealedCards.length > 0 && showRevealedReview && (
                      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4">
                        {revealedCards.map((ownedCard) => (
                          <CardTile key={ownedCard.id} card={ownedCard.player_cards} ownedCount={1} badge={ownedCard.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} badgeClass={ownedCard.duplicate ? 'bg-c4 text-main' : 'bg-c1 text-main'} />
                        ))}
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="m-3 sm:m-4 mt-0 border-4 border-main bg-card p-6 text-center font-black uppercase text-muted-foreground shadow-[4px_4px_0_var(--color-shadow)]">
                    {t('appPages.cards.openPack')}
                  </div>
                )}
              </main>
            ) : (
              <main className="bg-muted min-w-0 flex flex-col">
                <div className="bg-main text-inv border-b-4 border-main p-3 sm:p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Gallery</h2>
                    <p className="text-sm font-bold text-inv/80">{t('appPages.cards.collectionProgress', { owned: uniqueOwned, total: catalog.length })}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 text-main">
                    <label className="flex items-center gap-2 border-2 border-main bg-card px-3 py-2 font-bold text-sm shadow-[2px_2px_0_var(--color-shadow)]">
                      <Search size={16} />
                      <input className="bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('appPages.cards.searchPlaceholder')} />
                    </label>
                    <select className="border-2 border-main bg-card px-3 py-2 font-black uppercase text-sm shadow-[2px_2px_0_var(--color-shadow)]" value={rarity} onChange={(event) => setRarity(event.target.value as 'all' | CardRarity)}>
                      {rarities.map((nextRarity) => <option key={nextRarity} value={nextRarity}>{nextRarity === 'all' ? t('appPages.cards.allRarities') : nextRarity}</option>)}
                    </select>
                  </div>
                </div>

                <section className="border-b-4 border-main bg-card p-3 sm:p-4">
                  <h3 className="text-xl font-black uppercase tracking-tight text-main">{t('appPages.cards.showcase')}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((slot) => {
                      const card = showcase.find((item) => item.slot_number === slot)?.user_player_cards.player_cards;
                      return (
                        <div key={slot} className="min-h-28 border-2 border-main bg-muted p-2 text-center text-[10px] font-black uppercase text-main flex items-center justify-center">
                          {card ? <CardImage card={card} /> : <span>{t('appPages.cards.emptySlot', { slot })}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {loading ? (
                  <p className="p-6 text-center font-black uppercase text-muted-foreground">{t('common.loading')}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4">
                    {filteredCatalog.map((card) => (
                      <CardTile key={card.id} card={card} ownedCount={card.ownedCount} onSetShowcase={card.ownedCards[0] ? (slot) => handleSetShowcase(slot, card.ownedCards[0].id) : undefined} />
                    ))}
                  </div>
                )}
              </main>
            )}
          </div>
        </section>
      </div>

      {revealModalOpen && revealedCards.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-sm border-4 border-main bg-card shadow-[8px_8px_0_var(--color-shadow)]">
            <div className="flex items-center justify-between gap-3 border-b-4 border-main bg-c2 p-3 text-inv sm:p-4">
              <div>
                <p className="text-[10px] font-black uppercase opacity-80">{t('appPages.cards.openPack')}</p>
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('appPages.cards.revealedCards')}</h2>
              </div>
              <button type="button" className="border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]" onClick={() => setRevealModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:gap-4 sm:p-4 lg:grid-cols-5">
              {revealedCards.map((card) => {
                const isFlipped = flippedRevealCardIds.has(card.id);
                return (
                  <button key={card.id} type="button" className={`wc-card-flip group min-w-0 text-left ${isFlipped ? 'wc-card-flip-revealed' : ''}`} aria-label={`Reveal ${card.player_cards.name}`} onClick={() => toggleRevealCard(card.id)}>
                    <span className="wc-card-flip-inner relative mx-auto block aspect-[3/4] w-full max-w-[180px]">
                      <span className="wc-card-flip-face absolute inset-0">
                        <img src={backCardImage} alt="" className="h-full w-full rounded-sm border-4 border-main object-cover shadow-[4px_4px_0_var(--color-shadow)]" />
                      </span>
                      <span className="wc-card-flip-face wc-card-flip-front absolute inset-0">
                        <CardTile card={card.player_cards} ownedCount={1} badge={card.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} badgeClass={card.duplicate ? 'bg-c4 text-main' : 'bg-c1 text-main'} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function StatCell({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`border-r-4 border-b-4 xl:border-b-0 border-main p-3 sm:p-4 last:border-r-0 even:border-r-0 xl:even:border-r-4 xl:last:border-r-0 ${className}`}>
      <p className="text-[10px] font-black uppercase opacity-75">{label}</p>
      <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{value}</p>
    </div>
  );
}

function PackPanel({ title, description, packType, openingPack, isOpenedToday = false, dailyResetCountdown = '', onOpen }: {
  key?: string;
  title: string;
  description: string;
  packType: PackType;
  openingPack: PackType | null;
  isOpenedToday?: boolean;
  dailyResetCountdown?: string;
  onOpen: (packType: PackType) => void;
}) {
  const { t } = useTranslation();
  const pack = { ...CARD_PACKS[packType], ...packArtwork[packType] };
  const isOpening = openingPack === packType;
  return (
    <section className="border-4 border-main bg-card p-3 sm:p-4 shadow-[4px_4px_0_var(--color-shadow)]">
      <div className="flex items-center gap-2 text-main">
        <Gift size={22} />
        <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 flex h-64 sm:h-72 items-center justify-center border-4 border-main bg-muted p-3 shadow-[4px_4px_0_var(--color-shadow)]">
        <img src={pack.image} alt={title} className={`max-h-full max-w-full object-contain drop-shadow-[6px_6px_0_var(--color-shadow)] ${pack.imageClass ?? ''} ${isOpening ? 'wc-pack-opening' : 'hover:-translate-y-1 transition-transform'}`} />
      </div>
      <p className="mt-3 text-sm font-bold text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center gap-2 border-2 border-main bg-muted px-3 py-2 text-sm font-black uppercase text-main">
        <PointsCoin size="sm" />
        {pack.priceCoins.toLocaleString()} {t('ui.coinsShort')} · {pack.cardCount} {t('appPages.cards.cards')}
      </div>
      <div className="mt-3 border-2 border-main bg-muted p-2">
        <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">{t('appPages.cards.dropRates')}</p>
        <div className="grid grid-cols-2 gap-1">
          {(rarities.filter((nextRarity) => nextRarity !== 'all') as CardRarity[]).map((rarity) => (
            <div key={rarity} className="flex items-center justify-between gap-2 border-2 border-main bg-card px-2 py-1 text-[10px] font-black uppercase text-main">
              <span className={`border-2 border-main px-1 ${getRarityBadgeClass(rarity)}`}>{rarity}</span>
              <span>{pack.rarityWeights[rarity]}%</span>
            </div>
          ))}
        </div>
      </div>
      {isOpenedToday && <p className="mt-3 border-2 border-main bg-c3 px-3 py-2 text-center text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">{t('appPages.cards.dailyPackOpenedToday')}</p>}
      {isOpenedToday && dailyResetCountdown && <p className="mt-2 border-2 border-main bg-card px-3 py-2 text-center text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">{t('appPages.cards.dailyPackResetIn', { time: dailyResetCountdown })}</p>}
      <button type="button" className="mt-4 w-full border-4 border-main bg-c1 px-4 py-3 font-black uppercase text-main shadow-[4px_4px_0_var(--color-shadow)] disabled:opacity-60" disabled={openingPack !== null || isOpenedToday} onClick={() => onOpen(packType)}>
        {isOpening ? t('appPages.cards.opening') : isOpenedToday ? t('appPages.cards.dailyPackOpenedToday') : t('appPages.cards.openPack')}
      </button>
    </section>
  );
}

function CardTile({ card, ownedCount, badge, badgeClass = 'bg-c2 text-inv', onSetShowcase }: {
  key?: string;
  card: { name: string; position: string; team: string; nation_region: string; image_url: string; rarity: string };
  ownedCount: number;
  badge?: string;
  badgeClass?: string;
  onSetShowcase?: (slot: number) => void;
}) {
  const { t } = useTranslation();
  const Flag = getNationFlag(card.nation_region);
  return (
    <article className={`border-4 bg-card shadow-[4px_4px_0_var(--color-shadow)] min-w-0 overflow-hidden ${getRarityCardFrameClass(card.rarity)}`}>
      <div className={`relative border-b-4 border-main p-2 overflow-hidden ${getRarityCardArtClass(card.rarity)}`}>
        <CardImage card={card} />
        <span className={`absolute left-2 top-2 border-2 border-main px-2 py-1 font-black text-xs shadow-[2px_2px_0_var(--color-shadow)] ${getRarityBadgeClass(card.rarity)}`}>{card.rarity}</span>
        <span className="absolute right-2 top-2 border-2 border-main bg-c1 px-2 py-1 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">x{ownedCount}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 min-w-0">
        <h3 className="font-black uppercase text-sm sm:text-base leading-tight truncate text-main text-center" title={card.name}>{card.name}</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
          <p className="border-2 border-main bg-c1 text-main px-2 py-1 text-center truncate">{card.position}</p>
          <p className="border-2 border-main bg-muted px-2 py-1 text-main text-center truncate">{card.team}</p>
        </div>
        <p className="flex items-center justify-center gap-1 border-2 border-main bg-card text-main px-2 py-1 text-[11px] font-black uppercase truncate">
          {Flag && <Flag className="h-3 w-5 shrink-0" title={card.nation_region} />}
          <span className="truncate">{card.nation_region}</span>
        </p>
        {badge && <p className={`border-2 border-main px-2 py-1 text-center text-[11px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${badgeClass}`}>{badge}</p>}
        {onSetShowcase && (
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((slot) => (
              <button key={slot} type="button" className="border-2 border-main bg-card px-1 py-1 text-[10px] font-black uppercase text-main hover:bg-c1" onClick={() => onSetShowcase(slot)}>
                {t('appPages.cards.slot', { slot })}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function CardImage({ card }: { card: { name: string; image_url: string } }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="mx-auto flex aspect-[3/4] w-full max-w-[180px] items-center justify-center border-2 border-main bg-muted p-2 text-center text-xs font-black uppercase text-main">{card.name}</div>;
  }

  return <img src={card.image_url} alt={card.name} className="mx-auto aspect-[3/4] w-full max-w-[180px] object-contain border-2 border-main bg-muted" onError={() => setFailed(true)} />;
}
