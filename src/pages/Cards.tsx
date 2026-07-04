import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Search, Star } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import PointsCoin from '../components/ui/PointsCoin';
import { CARD_PACKS, type CardRarity, type PackType } from '../config/cardPacks';
import type { ThemeControls } from '../App';
import {
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

type CardsProps = {
  themeControls: ThemeControls;
};

const rarities: Array<'all' | CardRarity> = ['all', 'Common', 'Rare', 'Epic', 'Icon'];

const rarityCardArtClasses: Record<string, string> = {
  Common: 'bg-[repeating-linear-gradient(135deg,#7fbf5f_0_12px,#d8ff65_12px_24px),linear-gradient(135deg,#173f2b,#7fbf5f)]',
  Rare: 'bg-[linear-gradient(#0088ff_3px,transparent_3px),linear-gradient(90deg,#0088ff_3px,transparent_3px),linear-gradient(135deg,#031a5f,#00d4ff)] bg-[length:22px_22px,22px_22px,auto]',
  Epic: 'bg-[linear-gradient(135deg,transparent_0_34%,#ff2bd6_34%_44%,transparent_44%_100%),linear-gradient(45deg,transparent_0_38%,#ffe600_38%_48%,transparent_48%_100%),linear-gradient(135deg,#2b005f,#6f00ff)]',
  Icon: 'bg-[repeating-conic-gradient(from_0deg_at_50%_50%,#fff0b8_0deg_10deg,#d99a00_10deg_16deg,#111_16deg_18deg)]',
};

function getRarityCardArtClass(rarity: string) {
  return rarityCardArtClasses[rarity] ?? rarityCardArtClasses.Common;
}

export default function Cards({ themeControls }: CardsProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogCardWithOwnedCount[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseCard[]>([]);
  const [revealedCards, setRevealedCards] = useState<Array<OwnedPlayerCard & { duplicate: boolean }>>([]);
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | CardRarity>('all');
  const [loading, setLoading] = useState(true);
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [activeTab, setActiveTab] = useState<'openPacks' | 'gallery'>('openPacks');
  const [error, setError] = useState('');

  const loadCards = async () => {
    setLoading(true);
    setError('');
    try {
      const [cards, owned, currentShowcase] = await Promise.all([
        listPlayerCards(),
        listCurrentUserOwnedCards(),
        listCurrentUserShowcase(),
      ]);
      setCatalog(groupCatalogWithOwnership(cards, owned));
      setShowcase(currentShowcase);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCards();
  }, []);

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
      window.dispatchEvent(new CustomEvent('wc26:profile-coins-changed', { detail: { coins: result.coins } }));
      await loadCards();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
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

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 lg:gap-6 min-h-0">
        <section className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 w-full xl:w-1/2 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <p className="text-xs font-black uppercase text-muted-foreground">{t('appPages.cards.kicker')}</p>
          <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main leading-none">{t('appPages.cards.title')}</h1>
          <p className="max-w-3xl text-sm font-bold text-muted-foreground">{t('appPages.cards.subtitle')}</p>
        </section>

        {error && <div className="border-4 border-main bg-c2 p-3 font-black uppercase text-sm text-main shadow-[4px_4px_0_var(--color-shadow)]">{error}</div>}

        <section className="bg-card border-4 border-main flex flex-col shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)] rounded-sm min-h-0">
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <StatCell label={t('appPages.cards.collection')} value={uniqueOwned.toLocaleString()} />
            <StatCell label={t('appPages.cards.cards')} value={catalog.length.toLocaleString()} />
            <StatCell label={t('appPages.cards.revealedCards')} value={revealedCards.length.toLocaleString()} />
            <StatCell label={t('appPages.cards.showcase')} value={`${showcaseSlotsUsed}/3`} />
          </div>

          <div className="grid grid-cols-2 border-b-4 border-main">
            {[
              ['openPacks', 'Open Packs'],
              ['gallery', 'Gallery'],
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`border-r-4 border-main px-4 py-3 text-left font-black uppercase tracking-tight last:border-r-0 ${activeTab === tab ? 'bg-main text-inv' : 'bg-card text-main hover:bg-c1'}`}
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

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4">
                  <PackPanel
                    title={t('appPages.cards.dailyPack')}
                    description={t('appPages.cards.dailyPackDescription')}
                    packType="daily"
                    openingPack={openingPack}
                    onOpen={handleOpenPack}
                  />
                  <PackPanel
                    title={t('appPages.cards.premiumPack')}
                    description={t('appPages.cards.premiumPackDescription', {
                      count: CARD_PACKS.premium.cardCount,
                      coins: CARD_PACKS.premium.priceCoins,
                    })}
                    packType="premium"
                    openingPack={openingPack}
                    onOpen={handleOpenPack}
                  />
                </div>

                {revealedCards.length > 0 ? (
                  <section className="m-3 sm:m-4 mt-0 border-4 border-main bg-c3 shadow-[4px_4px_0_var(--color-shadow)]">
                    <h3 className="border-b-4 border-main bg-card p-3 text-lg font-black uppercase text-main">{t('appPages.cards.revealedCards')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4">
                      {revealedCards.map((ownedCard) => (
                        <CardTile key={ownedCard.id} card={ownedCard.player_cards} ownedCount={1} badge={ownedCard.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} />
                      ))}
                    </div>
                  </section>
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
    </AppShell>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r-4 border-b-4 xl:border-b-0 border-main p-3 sm:p-4 last:border-r-0 even:border-r-0 xl:even:border-r-4 xl:last:border-r-0">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-main">{value}</p>
    </div>
  );
}

function PackPanel({ title, description, packType, openingPack, onOpen }: {
  title: string;
  description: string;
  packType: PackType;
  openingPack: PackType | null;
  onOpen: (packType: PackType) => void;
}) {
  const { t } = useTranslation();
  const pack = CARD_PACKS[packType];
  return (
    <section className="border-4 border-main bg-card p-3 sm:p-4 shadow-[4px_4px_0_var(--color-shadow)]">
      <div className="flex items-center gap-2 text-main">
        <Gift size={22} />
        <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
      </div>
      <p className="mt-2 text-sm font-bold text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center gap-2 border-2 border-main bg-muted px-3 py-2 text-sm font-black uppercase text-main">
        <PointsCoin size="sm" />
        {pack.priceCoins.toLocaleString()} {t('ui.coinsShort')} · {pack.cardCount} {t('appPages.cards.cards')}
      </div>
      <button type="button" className="mt-4 w-full border-4 border-main bg-c1 px-4 py-3 font-black uppercase text-main shadow-[4px_4px_0_var(--color-shadow)] disabled:opacity-60" disabled={openingPack !== null} onClick={() => onOpen(packType)}>
        {openingPack === packType ? t('appPages.cards.opening') : t('appPages.cards.openPack')}
      </button>
    </section>
  );
}

function CardTile({ card, ownedCount, badge, onSetShowcase }: {
  key?: string;
  card: { name: string; position: string; team: string; nation_region: string; image_url: string; rarity: string };
  ownedCount: number;
  badge?: string;
  onSetShowcase?: (slot: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="border-4 border-main bg-card shadow-[4px_4px_0_var(--color-shadow)] min-w-0">
      <div className={`relative border-b-4 border-main p-2 overflow-hidden ${getRarityCardArtClass(card.rarity)}`}>
        <CardImage card={card} />
        <span className="absolute left-2 top-2 bg-main text-inv border-2 border-main px-2 py-1 font-black text-xs shadow-[2px_2px_0_var(--color-shadow)]">{card.rarity}</span>
        <span className="absolute right-2 top-2 border-2 border-main bg-c1 px-2 py-1 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">x{ownedCount}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 min-w-0">
        <h3 className="font-black uppercase text-sm sm:text-base leading-tight truncate text-main">{card.name}</h3>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
          <p className="border-2 border-main bg-muted px-2 py-1 text-main truncate">{card.position}</p>
          <p className="border-2 border-main bg-muted px-2 py-1 text-main truncate">{card.team}</p>
        </div>
        <p className="flex items-center gap-1 text-[11px] font-black uppercase text-main"><Star size={12} />{card.nation_region}</p>
        {badge && <p className="border-2 border-main bg-c2 px-2 py-1 text-center text-[11px] font-black uppercase text-main">{badge}</p>}
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

  return <img src={card.image_url} alt={card.name} className="mx-auto aspect-[3/4] w-full max-w-[180px] object-contain border-2 border-main bg-muted mix-blend-multiply" onError={() => setFailed(true)} />;
}
