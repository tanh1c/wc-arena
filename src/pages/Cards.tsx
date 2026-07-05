import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import backCardImage from '../../Backcard.png';
import commonCardBackground from '../../Common_card.png';
import dailyPackImage from '../../Daily.png';
import elitePackImage from '../../Elite.png';
import epicCardBackground from '../../Epic_card.png';
import iconPackImage from '../../Icon.png';
import iconCardBackground from '../../Icon_card.png';
import premiumPackImage from '../../Premium.png';
import rareCardBackground from '../../Rare_card.png';
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
  getPlayerCardDisplayImageUrl,
  openCardPack,
  setShowcaseCard,
  upgradePlayerCardToGif,
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

const packTextKeys: Record<PackType, { title: string; description: string }> = {
  daily: { title: 'appPages.cards.dailyPack', description: 'appPages.cards.dailyPackDescription' },
  starter: { title: 'appPages.cards.starterPack', description: 'appPages.cards.starterPackDescription' },
  premium: { title: 'appPages.cards.premiumPack', description: 'appPages.cards.premiumPackDescription' },
  elite: { title: 'appPages.cards.elitePack', description: 'appPages.cards.elitePackDescription' },
  icon: { title: 'appPages.cards.iconPack', description: 'appPages.cards.iconPackDescription' },
};

const rarityCardBackgroundImages: Record<string, string> = {
  Common: commonCardBackground,
  Rare: rareCardBackground,
  Epic: epicCardBackground,
  Icon: iconCardBackground,
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
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  'Bosnia Herzegovina': 'BIH',
  Brazil: 'BRA',
  Canada: 'CAN',
  'Cape Verde Islands': 'CPV',
  Colombia: 'COL',
  Croatia: 'CRO',
  'Czech Republic': 'CZE',
  'DR Congo': 'COD',
  Ecuador: 'ECU',
  Egypt: 'EGY',
  England: 'ENG',
  France: 'FRA',
  Germany: 'GER',
  Ghana: 'GHA',
  Haiti: 'HAI',
  'Ivory Coast': 'CIV',
  Japan: 'JPN',
  'Korea Republic': 'KOR',
  Mexico: 'MEX',
  Morocco: 'MAR',
  Netherlands: 'NED',
  'New Zealand': 'NZL',
  Norway: 'NOR',
  Panama: 'PAN',
  Paraguay: 'PAR',
  Portugal: 'POR',
  Qatar: 'QAT',
  'Saudi Arabia': 'KSA',
  Scotland: 'SCO',
  Senegal: 'SEN',
  'South Africa': 'RSA',
  Spain: 'ESP',
  Sweden: 'SWE',
  Switzerland: 'SUI',
  Tunisia: 'TUN',
  Türkiye: 'TUR',
  Uruguay: 'URU',
  'United States': 'USA',
  Uzbekistan: 'UZB',
};

function getRarityCardBackgroundImage(rarity: string) {
  return rarityCardBackgroundImages[rarity] ?? rarityCardBackgroundImages.Common;
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
  const [recentPullCards, setRecentPullCards] = useState<Array<OwnedPlayerCard & { duplicate: boolean }>>([]);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [flippedRevealCardIds, setFlippedRevealCardIds] = useState(new Set<string>());
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | CardRarity>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'owned' | 'missing'>('owned');
  const [loading, setLoading] = useState(true);
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [selectedPackType, setSelectedPackType] = useState<PackType>('daily');
  const [dailyPackOpenedToday, setDailyPackOpenedToday] = useState(false);
  const [dailyResetCountdown, setDailyResetCountdown] = useState('');
  const [activeTab, setActiveTab] = useState<'openPacks' | 'gallery'>('openPacks');
  const [upgradingGifCardId, setUpgradingGifCardId] = useState<string | null>(null);
  const [previewGifCard, setPreviewGifCard] = useState<CatalogCardWithOwnedCount | null>(null);
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
      const matchesOwnership = ownershipFilter === 'owned' ? card.ownedCount > 0 : card.ownedCount === 0;
      const haystack = `${card.name} ${card.position} ${card.team} ${card.nation_region}`.toLowerCase();
      return matchesRarity && matchesOwnership && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [catalog, ownershipFilter, query, rarity]);

  const showcaseSlotsUsed = showcase.length;

  const handleOpenPack = async (packType: PackType) => {
    setOpeningPack(packType);
    setError('');
    try {
      const result = await openCardPack(packType);
      setRevealedCards(result.cards);
      setRecentPullCards([]);
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

  const handleUpgradeToGif = async (cardId: string) => {
    setUpgradingGifCardId(cardId);
    setError('');
    try {
      await upgradePlayerCardToGif(cardId);
      await loadCards();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setUpgradingGifCardId(null);
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

  const closeRevealModal = () => {
    setRecentPullCards(revealedCards);
    setRevealModalOpen(false);
  };

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6 min-h-0">
        <div className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full xl:w-1/2 shadow-[8px_8px_0_0_var(--color-shadow)]">
          <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main">{t('nav.items.cards')}</h1>
        </div>

        {error && <div className="border-4 border-main bg-c2 p-3 font-black uppercase text-sm text-main shadow-[4px_4px_0_var(--color-shadow)]">{error}</div>}

        <section className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm overflow-hidden">
          <div className="overflow-hidden">
            <div className="grid grid-cols-2 border-b-4 border-main bg-card">
              {[
                ['openPacks', 'appPages.cards.openPacks'],
                ['gallery', 'appPages.cards.gallery'],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`border-r-4 border-main px-4 py-4 text-center font-black uppercase tracking-tight last:border-r-0 ${activeTab === tab ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}
                  onClick={() => setActiveTab(tab as 'openPacks' | 'gallery')}
                >
                  {t(label)}
                </button>
              ))}
            </div>

            {activeTab === 'openPacks' ? (
              <main className="min-w-0 bg-card pt-4 sm:pt-5 lg:pt-6">
              <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_320px]">
                <PackRail selectedPackType={selectedPackType} setSelectedPackType={setSelectedPackType} />
                <SelectedPackHero
                  title={t(packTextKeys[selectedPackType].title)}
                  description={t(packTextKeys[selectedPackType].description, {
                    count: CARD_PACKS[selectedPackType].cardCount,
                    coins: CARD_PACKS[selectedPackType].priceCoins,
                  })}
                  packType={selectedPackType}
                  openingPack={openingPack}
                  isOpenedToday={selectedPackType === 'daily' && dailyPackOpenedToday}
                  onOpen={handleOpenPack}
                />
                <PackInfoPanel
                  packType={selectedPackType}
                  isOpenedToday={selectedPackType === 'daily' && dailyPackOpenedToday}
                  dailyResetCountdown={selectedPackType === 'daily' ? dailyResetCountdown : ''}
                />
              </div>

              <div className="grid border-t-4 border-main xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <section className="border-b-4 border-main bg-card p-3 xl:border-b-0 xl:border-r-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-black uppercase text-main">{t('appPages.cards.potentialRewards')}</h3>
                    <span className="border-2 border-main px-2 py-1 text-[10px] font-black uppercase text-main">{t('appPages.cards.viewAll')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(rarities.filter((nextRarity) => nextRarity !== 'all') as CardRarity[]).map((rarity) => (
                      <div key={rarity} className="rounded-sm border-4 border-main bg-muted p-2 text-center shadow-[3px_3px_0_var(--color-shadow)]">
                        <div className="mx-auto mb-2 flex aspect-[3/4] max-w-[120px] items-center justify-center rounded-sm border-4 border-main bg-cover bg-center text-2xl font-black" style={{ backgroundImage: `url(${getRarityCardBackgroundImage(rarity)})` }}>?</div>
                        <p className={`rounded-sm border-2 border-main px-2 py-1 text-[10px] font-black uppercase ${getRarityBadgeClass(rarity)}`}>{rarity}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-card p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-black uppercase text-main">{t('appPages.cards.recentPulls')}</h3>
                    <span className="border-2 border-main px-2 py-1 text-[10px] font-black uppercase text-main">{t('appPages.cards.viewHistory')}</span>
                  </div>
                  {recentPullCards.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                      {recentPullCards.map((ownedCard) => (
                        <CardTile key={ownedCard.id} card={ownedCard.player_cards} ownedCount={1} useGif={ownedCard.is_gif_upgrade} badge={ownedCard.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} badgeClass={ownedCard.duplicate ? 'bg-c4 text-main' : 'bg-c1 text-main'} />
                      ))}
                    </div>
                  ) : (
                    <p className="border-2 border-main bg-muted p-6 text-center text-sm font-black uppercase text-muted-foreground">{t('appPages.cards.emptyRecentPulls')}</p>
                  )}
                </section>
              </div>
            </main>
            ) : (
              <main className="bg-card min-w-0 flex flex-col pt-4 sm:pt-5 lg:pt-6">
              <section className="border-b-4 border-main bg-card p-3 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{t('appPages.cards.searchFilter')}</p>
                    <h3 className="text-xl font-black uppercase tracking-tight text-main">{t('appPages.cards.showcase')}</h3>
                  </div>
                  <div className="flex flex-col gap-2 text-main sm:flex-row">
                    <div className="flex gap-2 rounded-sm border-2 border-main bg-card p-1 shadow-[2px_2px_0_var(--color-shadow)]">
                      {(['owned', 'missing'] as const).map((nextFilter) => (
                        <button key={nextFilter} type="button" className={`rounded-sm px-3 py-2 text-xs font-black uppercase ${ownershipFilter === nextFilter ? 'bg-c2 text-inv' : 'bg-card text-main'}`} onClick={() => setOwnershipFilter(nextFilter)}>
                          {nextFilter === 'owned' ? t('appPages.cards.ownedCards') : t('appPages.cards.missingCards')}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 rounded-sm border-2 border-main bg-card px-3 py-2 text-sm font-bold shadow-[2px_2px_0_var(--color-shadow)]">
                      <Search size={16} />
                      <input className="bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('appPages.cards.searchPlaceholder')} />
                    </label>
                    <select className="rounded-sm border-2 border-main bg-card px-3 py-2 text-sm font-black uppercase shadow-[2px_2px_0_var(--color-shadow)]" value={rarity} onChange={(event) => setRarity(event.target.value as 'all' | CardRarity)}>
                      {rarities.map((nextRarity) => <option key={nextRarity} value={nextRarity}>{nextRarity === 'all' ? t('appPages.cards.allRarities') : nextRarity}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((slot) => {
                    const cardShowcase = showcase.find((item) => item.slot_number === slot);
                    const card = cardShowcase?.user_player_cards.player_cards;
                    return (
                      <div key={slot} className={`flex min-h-28 items-center justify-center rounded-sm border-2 border-main p-2 text-center text-[10px] font-black uppercase text-main ${card ? 'bg-cover bg-center' : 'bg-muted'}`} style={{ backgroundImage: card ? `url(${getRarityCardBackgroundImage(card.rarity)})` : undefined }}>
                        {card ? <CardImage card={card} useGif={cardShowcase.user_player_cards.is_gif_upgrade} /> : <span>{t('appPages.cards.emptySlot', { slot })}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>

              {loading ? (
                <p className="p-6 text-center font-black uppercase text-muted-foreground">{t('common.loading')}</p>
              ) : filteredCatalog.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4">
                  {filteredCatalog.map((card) => {
                    const isMissing = card.ownedCount === 0;
                    const showcaseCard = card.gifOwnedCards[0] ?? card.ownedCards[0];
                    return <CardTile key={card.id} card={card} ownedCount={card.ownedCount} useGif={card.hasGifUpgrade} baseOwnedCount={card.baseOwnedCount} dimmed={isMissing} badge={card.hasGifUpgrade ? 'GIF' : isMissing ? t('appPages.cards.locked') : undefined} badgeClass={card.hasGifUpgrade ? 'bg-c3 text-main' : 'bg-muted text-muted-foreground'} onSetShowcase={showcaseCard ? (slot) => handleSetShowcase(slot, showcaseCard.id) : undefined} onPreviewGif={card.gif_url ? () => setPreviewGifCard(card) : undefined} onUpgradeToGif={card.gif_url && !card.hasGifUpgrade && card.baseOwnedCount >= 5 ? () => handleUpgradeToGif(card.id) : undefined} upgradingGif={upgradingGifCardId === card.id} />;
                  })}
                </div>
              ) : (
                <p className="m-3 rounded-sm border-4 border-main bg-card p-6 text-center text-sm font-black uppercase text-muted-foreground shadow-[4px_4px_0_var(--color-shadow)]">{t('appPages.cards.noCardsMatch')}</p>
              )}
            </main>
          )}
          </div>
        </section>
      </div>

      {previewGifCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <section className="w-full max-w-md overflow-hidden rounded-sm border-4 border-main bg-card shadow-[8px_8px_0_var(--color-shadow)]">
            <div className="flex items-center justify-between gap-3 border-b-4 border-main bg-c3 p-3 text-main">
              <div>
                <p className="text-[10px] font-black uppercase opacity-80">GIF Available</p>
                <h2 className="text-2xl font-black uppercase tracking-tight">{previewGifCard.name}</h2>
              </div>
              <button type="button" className="border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]" onClick={() => setPreviewGifCard(null)}>
                {t('ui.close')}
              </button>
            </div>
            <div className="bg-cover bg-center p-4" style={{ backgroundImage: `url(${getRarityCardBackgroundImage(previewGifCard.rarity)})` }}>
              <img src={getPlayerCardDisplayImageUrl(previewGifCard, true)} alt={previewGifCard.name} loading="lazy" decoding="async" className="mx-auto aspect-[3/4] w-full max-w-[220px] rounded-sm border-4 border-main bg-card object-contain shadow-[4px_4px_0_var(--color-shadow)]" />
            </div>
          </section>
        </div>
      )}

      {revealModalOpen && revealedCards.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <section className="grid max-h-[92vh] w-full max-w-[1280px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-sm border-4 border-main bg-card shadow-[8px_8px_0_var(--color-shadow)]">
            <div className="flex items-center justify-between gap-3 border-b-4 border-main bg-c2 p-3 text-inv">
              <div>
                <p className="text-[10px] font-black uppercase opacity-80">{t('appPages.cards.openPack')}</p>
                <h2 className="text-2xl font-black uppercase tracking-tight">{t('appPages.cards.revealedCards')}</h2>
              </div>
              <button type="button" className="border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]" onClick={closeRevealModal}>
                {t('ui.close')}
              </button>
            </div>
            <div className="flex flex-wrap justify-center min-h-0 gap-3 p-3">
              {revealedCards.map((card) => {
                const isFlipped = flippedRevealCardIds.has(card.id);
                return (
                  <button key={card.id} type="button" className={`wc-card-flip group w-full max-w-[190px] min-w-0 text-left ${isFlipped ? 'wc-card-flip-revealed' : ''}`} aria-label={`Reveal ${card.player_cards.name}`} onClick={() => toggleRevealCard(card.id)}>
                    <span className="wc-card-flip-inner relative mx-auto block w-full max-w-[190px] min-h-[400px]">
                      <span className="wc-card-flip-face absolute inset-0">
                        <img src={backCardImage} alt="" className="h-full w-full rounded-sm border-4 border-main object-cover shadow-[4px_4px_0_var(--color-shadow)]" />
                      </span>
                      <span className="wc-card-flip-face wc-card-flip-front absolute inset-0">
                        <CardTile card={card.player_cards} ownedCount={1} useGif={card.is_gif_upgrade} badge={card.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} badgeClass={card.duplicate ? 'bg-c4 text-main' : 'bg-c1 text-main'} />
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

function PackRail({ selectedPackType, setSelectedPackType }: {
  selectedPackType: PackType;
  setSelectedPackType: (packType: PackType) => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="border-b-4 lg:border-b-0 lg:border-r-4 border-main bg-card p-2 overflow-x-auto lg:overflow-visible">
      <p className="mb-2 border-2 border-main bg-c3 text-main px-2 py-1 text-[10px] font-black uppercase">{t('appPages.cards.choosePack')}</p>
      <div className="grid auto-cols-[minmax(210px,72vw)] grid-flow-col gap-2 lg:auto-cols-auto lg:grid-flow-row">
        {packTypes.map((packType) => {
          const pack = CARD_PACKS[packType];
          const artwork = packArtwork[packType];
          return (
            <button
              key={packType}
              type="button"
              className={`grid grid-cols-[54px_minmax(0,1fr)] items-center gap-2 rounded-sm border-4 border-main p-2 text-left shadow-[3px_3px_0_var(--color-shadow)] transition-transform hover:-translate-y-0.5 ${selectedPackType === packType ? 'bg-c2 text-inv' : 'bg-muted text-main hover:bg-c1'}`}
              onClick={() => setSelectedPackType(packType)}
            >
              <span className="flex h-16 items-center justify-center border-2 border-main bg-card p-1">
                <img src={artwork.image} alt="" className={`max-h-full max-w-full object-contain ${artwork.imageClass ?? ''}`} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black uppercase">{t(packTextKeys[packType].title)}</span>
                <span className="mt-1 block text-[10px] font-black uppercase opacity-80">{pack.cardCount} {t('appPages.cards.cards')}</span>
                <span className="mt-1 inline-flex items-center gap-1 border-2 border-main bg-card px-2 py-0.5 text-[10px] font-black uppercase text-main">
                  {pack.priceCoins === 0 ? t('appPages.cards.free') : `${pack.priceCoins.toLocaleString()} ${t('ui.coinsShort')}`}
                  {pack.priceCoins > 0 && <PointsCoin size="sm" />}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SelectedPackHero({ title, description, packType, openingPack, isOpenedToday, onOpen }: {
  title: string;
  description: string;
  packType: PackType;
  openingPack: PackType | null;
  isOpenedToday: boolean;
  onOpen: (packType: PackType) => void;
}) {
  const { t } = useTranslation();
  const pack = { ...CARD_PACKS[packType], ...packArtwork[packType] };
  const isOpening = openingPack === packType;
  return (
    <section className="relative min-h-[420px] sm:min-h-[520px] overflow-hidden border-b-4 lg:border-b-0 lg:border-r-4 border-main bg-[radial-gradient(circle_at_50%_0%,rgba(228,255,0,0.28),transparent_32%),linear-gradient(135deg,#07111f_0%,#0d47ff_48%,#02040a_100%)] p-3 sm:p-4 text-inv">
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.14)_0_2px,transparent_2px_34px)] opacity-70" />
      <div className="relative z-10 grid h-full gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] lg:items-center">
        <div className="flex h-48 sm:h-72 items-center justify-center rounded-sm border-4 border-main bg-black/30 p-3 sm:p-4 shadow-[4px_4px_0_var(--color-shadow)]">
          <img src={pack.image} alt={title} className={`max-h-full max-w-full object-contain drop-shadow-[10px_10px_0_rgba(0,0,0,0.55)] ${pack.imageClass ?? ''} ${isOpening ? 'wc-pack-opening' : 'transition-transform hover:-translate-y-2 hover:rotate-1'}`} />
        </div>
        <div className="min-w-0">
          <p className="mb-2 inline-flex border-2 border-main bg-c3 px-2 py-1 text-[10px] font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">{t('appPages.cards.featuredPack')}</p>
          <h2 className="text-4xl font-black uppercase leading-none tracking-tighter sm:text-5xl">{title}</h2>
          <p className="mt-3 max-w-xl text-sm font-bold text-white/85">{description}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-main">
            <div className="border-2 border-main bg-c1 p-2 shadow-[2px_2px_0_var(--color-shadow)]">
              <p className="text-[10px] font-black uppercase opacity-70">{t('appPages.cards.cardsLabel')}</p>
              <p className="text-2xl font-black">{pack.cardCount}</p>
            </div>
            <div className="border-2 border-main bg-card p-2 shadow-[2px_2px_0_var(--color-shadow)]">
              <p className="text-[10px] font-black uppercase opacity-70">{t('appPages.cards.price')}</p>
              <p className="flex items-center gap-1 text-2xl font-black">{pack.priceCoins === 0 ? t('appPages.cards.free') : pack.priceCoins.toLocaleString()} {pack.priceCoins > 0 && <PointsCoin size="sm" />}</p>
            </div>
          </div>
          {isOpenedToday && <p className="mt-3 border-2 border-main bg-c4 px-3 py-2 text-center text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">{t('appPages.cards.dailyPackOpenedToday')}</p>}
          <button type="button" className="mt-4 w-full border-4 border-main bg-c1 px-4 py-4 text-lg font-black uppercase text-main shadow-[5px_5px_0_var(--color-shadow)] transition-transform hover:-translate-y-1 disabled:translate-y-0 disabled:opacity-60" disabled={openingPack !== null || isOpenedToday} onClick={() => onOpen(packType)}>
            {isOpening ? t('appPages.cards.opening') : isOpenedToday ? t('appPages.cards.dailyPackOpenedToday') : t('appPages.cards.openPack')}
          </button>
        </div>
      </div>
    </section>
  );
}

function PackInfoPanel({ packType, isOpenedToday, dailyResetCountdown }: {
  packType: PackType;
  isOpenedToday: boolean;
  dailyResetCountdown: string;
}) {
  const { t } = useTranslation();
  const pack = CARD_PACKS[packType];
  return (
    <aside className="bg-card p-3">
      <p className="border-2 border-main bg-c4 px-2 py-1 text-[10px] font-black uppercase text-main">{t('appPages.cards.packStatus')}</p>
      <div className="mt-3 grid gap-2 text-xs font-black uppercase text-main">
        <div className="flex items-center justify-between gap-2 border-2 border-main bg-muted px-3 py-2">
          <span>{t('appPages.cards.availability')}</span>
          <span className={isOpenedToday ? 'text-c5' : 'text-c3'}>{isOpenedToday ? t('appPages.cards.opened') : t('appPages.cards.available')}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-2 border-main bg-muted px-3 py-2">
          <span>{t('appPages.cards.limit')}</span>
          <span>{pack.oncePerUtcDay ? t('appPages.cards.oncePerUtcDay') : t('appPages.cards.unlimited')}</span>
        </div>
        {isOpenedToday && dailyResetCountdown && (
          <div className="border-2 border-main bg-c1 px-3 py-2 text-center">
            {t('appPages.cards.dailyPackResetIn', { time: dailyResetCountdown })}
          </div>
        )}
      </div>
      <div className="mt-4 border-2 border-main bg-muted p-2">
        <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">{t('appPages.cards.dropRates')}</p>
        <div className="grid gap-2">
          {(rarities.filter((nextRarity) => nextRarity !== 'all') as CardRarity[]).map((rarity) => (
            <div key={rarity} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase text-main">
                <span className={`border-2 border-main px-2 py-1 ${getRarityBadgeClass(rarity)}`}>{rarity}</span>
                <span>{pack.rarityWeights[rarity]}%</span>
              </div>
              <div className="h-4 rounded-sm border-2 border-main bg-card overflow-hidden">
                <div className={`h-full rounded-sm ${getRarityBadgeClass(rarity)}`} style={{ width: `${pack.rarityWeights[rarity]}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CardTile({ card, ownedCount, useGif = false, baseOwnedCount, badge, badgeClass = 'bg-c2 text-inv', dimmed = false, onSetShowcase, onPreviewGif, onUpgradeToGif, upgradingGif = false }: {
  key?: string;
  card: { name: string; position: string; team: string; nation_region: string; image_url: string; gif_url?: string | null; rarity: string };
  ownedCount: number;
  useGif?: boolean;
  baseOwnedCount?: number;
  badge?: string;
  badgeClass?: string;
  dimmed?: boolean;
  onSetShowcase?: (slot: number) => void;
  onPreviewGif?: () => void;
  onUpgradeToGif?: () => void;
  upgradingGif?: boolean;
}) {
  const { t } = useTranslation();
  const Flag = getNationFlag(card.nation_region);
  return (
    <article className={`rounded-sm border-4 bg-card shadow-[4px_4px_0_var(--color-shadow)] min-w-0 overflow-hidden ${dimmed ? 'opacity-45 grayscale' : ''} ${getRarityCardFrameClass(card.rarity)}`}>
      <div className="relative rounded-sm border-b-4 border-main bg-cover bg-center p-2 overflow-hidden" style={{ backgroundImage: `url(${getRarityCardBackgroundImage(card.rarity)})` }}>
        <CardImage card={card} useGif={useGif} />
        <span className={`absolute left-2 top-2 rounded-sm border-2 border-main px-2 py-1 font-black text-xs shadow-[2px_2px_0_var(--color-shadow)] ${getRarityBadgeClass(card.rarity)}`}>{card.rarity}</span>
        <span className="absolute right-2 top-2 rounded-sm border-2 border-main bg-c1 px-2 py-1 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">x{ownedCount}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 min-w-0">
        <h3 className="font-black uppercase text-sm sm:text-base leading-tight truncate text-main text-center" title={card.name}>{card.name}</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
          <p className="rounded-sm border-2 border-main bg-c1 text-main px-2 py-1 text-center truncate">{card.position}</p>
          <p className="rounded-sm border-2 border-main bg-muted px-2 py-1 text-main text-center truncate">{card.team}</p>
        </div>
        <p className="flex items-center justify-center gap-1 rounded-sm border-2 border-main bg-card text-main px-2 py-1 text-[11px] font-black uppercase truncate">
          {Flag && <Flag className="h-3 w-5 shrink-0" title={card.nation_region} />}
          <span className="truncate">{card.nation_region}</span>
        </p>
        {badge && <p className={`rounded-sm border-2 border-main px-2 py-1 text-center text-[11px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${badgeClass}`}>{badge}</p>}
        {onPreviewGif && (
          <div className="grid gap-1 rounded-sm border-2 border-main bg-muted p-2 text-center text-[10px] font-black uppercase text-main">
            <span className="rounded-sm border-2 border-main bg-c3 px-2 py-1">GIF Available</span>
            <span>{Math.min(baseOwnedCount ?? 0, 5)}/5 {(baseOwnedCount ?? 0) >= 5 ? 'ready' : 'copies'}</span>
            <button type="button" className="rounded-sm border-2 border-main bg-card px-2 py-1 text-[10px] font-black uppercase text-main hover:bg-c1" onClick={onPreviewGif}>Preview GIF</button>
          </div>
        )}
        {onUpgradeToGif && (
          <button type="button" className="rounded-sm border-2 border-main bg-c3 px-2 py-2 text-[11px] font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)] hover:bg-c1 disabled:opacity-60" disabled={upgradingGif} onClick={onUpgradeToGif}>
            {upgradingGif ? t('ui.savingEllipsis') : 'Upgrade GIF'}
          </button>
        )}
        {onSetShowcase && (
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((slot) => (
              <button key={slot} type="button" className="rounded-sm border-2 border-main bg-card px-1 py-1 text-[10px] font-black uppercase text-main hover:bg-c1" onClick={() => onSetShowcase(slot)}>
                {t('appPages.cards.slot', { slot })}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function CardImage({ card, useGif }: { card: { name: string; image_url: string; gif_url?: string | null }; useGif: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="mx-auto flex aspect-[3/4] w-full max-w-[180px] items-center justify-center rounded-sm border-2 border-main bg-muted p-2 text-center text-xs font-black uppercase text-main">{card.name}</div>;
  }

  return <img src={getPlayerCardDisplayImageUrl(card, useGif)} alt={card.name} className="mx-auto aspect-[3/4] w-full max-w-[180px] rounded-sm border-2 border-main bg-muted object-contain" onError={() => setFailed(true)} />;
}
