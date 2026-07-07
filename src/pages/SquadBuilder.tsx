import { useEffect, useMemo, useState } from 'react';
import { Search, Shield, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ThemeControls } from '../App';
import AppShell from '../components/layout/AppShell';
import { CARD_RARITIES, type CardRarity } from '../config/cardPacks';
import { assignCardToSlot, clearSlot, formationKeys, getAssignedOwnedCardIds, getFormationSlots, getSquadSummary, type FormationKey, type SquadAssignments } from '../lib/squadBuilder';
import { getPlayerCardDisplayImageUrl, listCurrentUserOwnedCards, type OwnedPlayerCard } from '../services/cards';
import { getErrorMessage } from '../services/serviceTypes';
import emptySlotImage from '../../squadbuilder_empty_slot.svg';

type SquadBuilderProps = {
  themeControls: ThemeControls;
};

type RarityFilter = CardRarity | 'all';

const rarityBadgeClasses: Record<CardRarity, string> = {
  Common: 'bg-[#d8ff65] text-main',
  Uncommon: 'bg-[#a7f3d0] text-main',
  Rare: 'bg-[#00d4ff] text-main',
  Epic: 'bg-[#ff2bd6] text-white',
  Legendary: 'bg-[#f59e0b] text-main',
  Heroes: 'bg-[#10b981] text-white',
  Icon: 'bg-[#fff0b8] text-main',
  GOAT: 'bg-[#111827] text-[#fde68a]',
};

function PlayerMiniCard({ card, assigned, onClick }: { card: OwnedPlayerCard; assigned: boolean; onClick: () => void }) {
  const imageUrl = getPlayerCardDisplayImageUrl(card.player_cards, card.is_gif_upgrade);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid grid-cols-[64px_1fr] gap-2 border-2 border-main p-2 text-left shadow-[3px_3px_0_var(--color-shadow)] transition-all ${assigned ? 'bg-muted opacity-60' : 'bg-card hover:bg-c1 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'}`}
    >
      <span className="flex h-20 items-end justify-center overflow-hidden border-2 border-main bg-muted">
        <img src={imageUrl} alt={card.player_cards.name} loading="lazy" className="max-h-full max-w-full object-contain" />
      </span>
      <span className="min-w-0 self-center">
        <span className="block truncate text-sm font-black uppercase leading-tight text-main">{card.player_cards.name}</span>
        <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-black uppercase">
          <span className="border-2 border-main bg-c1 px-1.5 py-0.5 text-main">{card.player_cards.position}</span>
          <span className={`border-2 border-main px-1.5 py-0.5 ${rarityBadgeClasses[card.player_cards.rarity]}`}>{card.player_cards.rarity}</span>
        </span>
        <span className="mt-1 block truncate text-[10px] font-bold uppercase text-subtle">{card.player_cards.team}</span>
      </span>
    </button>
  );
}

export default function SquadBuilder({ themeControls }: SquadBuilderProps) {
  const { t } = useTranslation();
  const [ownedCards, setOwnedCards] = useState<OwnedPlayerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [assignments, setAssignments] = useState<SquadAssignments>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string>('st');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listCurrentUserOwnedCards()
      .then((cards) => {
        if (active) setOwnedCards(cards);
      })
      .catch((nextError) => {
        if (active) setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const slots = getFormationSlots(formation);
  const ownedCardById = useMemo(() => new Map(ownedCards.map((card) => [card.id, card])), [ownedCards]);
  const assignedOwnedCardIds = getAssignedOwnedCardIds(assignments);
  const summary = getSquadSummary(assignments, ownedCards);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0];

  const filteredOwnedCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ownedCards.filter((card) => {
      if (rarityFilter !== 'all' && card.player_cards.rarity !== rarityFilter) return false;
      if (!query) return true;
      return `${card.player_cards.name} ${card.player_cards.team} ${card.player_cards.nation_region} ${card.player_cards.position}`.toLowerCase().includes(query);
    });
  }, [ownedCards, rarityFilter, search]);

  function placeCard(ownedCardId: string) {
    const targetSlotId = selectedSlotId || slots.find((slot) => !assignments[slot.id])?.id;
    if (!targetSlotId) return;
    setAssignments((current) => assignCardToSlot(current, targetSlotId, ownedCardId));
    setSelectedSlotId(targetSlotId);
  }

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex min-h-0 flex-col gap-3 p-3 sm:p-4 lg:gap-6 lg:p-6">
        <section className="flex w-full flex-col gap-3 border-4 border-main bg-card p-3 shadow-[6px_6px_0_0_var(--color-shadow)] sm:p-4 lg:p-6 lg:shadow-[8px_8px_0_0_var(--color-shadow)] xl:w-1/2">
          <div className="inline-flex w-fit items-center gap-2 border-2 border-main bg-c3 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-main shadow-[2px_2px_0_var(--color-shadow)]">
            <Shield size={14} strokeWidth={3} /> {t('appPages.squadBuilder.kicker')}
          </div>
          <h1 className="text-3xl font-black uppercase leading-none tracking-tighter text-main sm:text-4xl lg:text-5xl">{t('appPages.squadBuilder.title')}</h1>
          <p className="max-w-3xl text-sm font-bold text-subtle sm:text-base">{t('appPages.squadBuilder.description')}</p>
        </section>

        <section className="grid overflow-hidden border-4 border-main bg-card shadow-[8px_8px_0_0_var(--color-shadow)] xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 border-b-4 border-main bg-muted xl:border-b-0 xl:border-r-4">
            <div className="flex flex-col gap-3 border-b-4 border-main bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {formationKeys.map((key) => (
                  <button key={key} type="button" onClick={() => setFormation(key)} className={`border-2 border-main px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${formation === key ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}>
                    {key}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAssignments({})} className="inline-flex items-center gap-2 border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)] hover:bg-c5">
                  <Trash2 size={14} strokeWidth={3} /> {t('appPages.squadBuilder.clearSquad')}
                </button>
                {selectedSlot && assignments[selectedSlot.id] && (
                  <button type="button" onClick={() => setAssignments((current) => clearSlot(current, selectedSlot.id))} className="border-2 border-main bg-c1 px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">
                    {t('appPages.squadBuilder.clearSlot')}
                  </button>
                )}
              </div>
            </div>

            <div className="relative min-h-[640px] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,var(--color-c3),var(--color-c2)_38%,#083b2d_39%,#0b5d3b_100%)]">
              <div className="absolute inset-4 border-4 border-white/80" />
              <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" />
              <div className="absolute left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 bg-white/60" />
              {slots.map((slot) => {
                const assignedCard = ownedCardById.get(assignments[slot.id]);
                const selected = selectedSlotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`absolute w-[88px] -translate-x-1/2 -translate-y-1/2 text-center transition-transform sm:w-[104px] ${selected ? 'z-20 scale-110' : 'z-10 hover:scale-105'}`}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  >
                    {assignedCard ? (
                      <span className="block overflow-hidden border-4 border-main bg-card shadow-[4px_4px_0_var(--color-shadow)]">
                        <span className="flex h-24 items-end justify-center bg-muted sm:h-28">
                          <img src={getPlayerCardDisplayImageUrl(assignedCard.player_cards, assignedCard.is_gif_upgrade)} alt={assignedCard.player_cards.name} className="max-h-full max-w-full object-contain" />
                        </span>
                        <span className="block border-t-2 border-main bg-card px-1 py-1 text-[9px] font-black uppercase leading-tight text-main sm:text-[10px]">
                          <span className="block truncate">{assignedCard.player_cards.name}</span>
                          <span className="text-subtle">{slot.label}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="block">
                        <img src={emptySlotImage} alt="" className="mx-auto h-20 w-20 object-contain drop-shadow-[4px_4px_0_var(--color-shadow)] sm:h-24 sm:w-24" />
                        <span className={`mt-1 inline-block border-2 border-main px-2 py-0.5 text-[10px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${selected ? 'bg-c1 text-main' : 'bg-card text-main'}`}>{slot.label}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </main>

          <aside className="flex min-h-0 flex-col bg-card">
            <div className="grid grid-cols-3 border-b-4 border-main text-center">
              <div className="border-r-4 border-main bg-c1 p-3 text-main">
                <div className="text-[10px] font-black uppercase">{t('appPages.squadBuilder.filled')}</div>
                <div className="text-2xl font-black">{summary.filledSlots}/11</div>
              </div>
              <div className="border-r-4 border-main bg-c2 p-3 text-inv">
                <div className="text-[10px] font-black uppercase">{t('appPages.squadBuilder.avg')}</div>
                <div className="text-2xl font-black">{summary.averageRating || '—'}</div>
              </div>
              <div className="bg-c3 p-3 text-main">
                <div className="text-[10px] font-black uppercase">{t('appPages.squadBuilder.cards')}</div>
                <div className="text-2xl font-black">{ownedCards.length}</div>
              </div>
            </div>

            <div className="border-b-4 border-main bg-muted p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-lg font-black uppercase leading-none text-main">{t('appPages.squadBuilder.cardPool')}</h2>
                  <p className="mt-1 truncate text-xs font-bold uppercase text-subtle">{t('appPages.squadBuilder.selectedSlot', { slot: selectedSlot?.label ?? '—' })}</p>
                </div>
                <Users size={22} strokeWidth={3} />
              </div>
              <label className="mb-2 flex items-center gap-2 border-2 border-main bg-card px-3 py-2 shadow-[2px_2px_0_var(--color-shadow)]">
                <Search size={16} strokeWidth={3} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('appPages.squadBuilder.searchPlaceholder')} className="w-full bg-transparent text-xs font-black uppercase outline-none placeholder:text-subtle" />
              </label>
              <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)} className="w-full border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)] outline-none">
                <option value="all">{t('appPages.squadBuilder.allRarities')}</option>
                {CARD_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
              </select>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {loading && <div className="border-2 border-main bg-card p-4 text-sm font-black uppercase text-main">{t('appPages.squadBuilder.loading')}</div>}
              {error && <div className="border-2 border-main bg-c5 p-4 text-sm font-black uppercase text-main">{error}</div>}
              {!loading && !error && filteredOwnedCards.length === 0 && <div className="border-2 border-main bg-card p-4 text-sm font-black uppercase text-main">{t('appPages.squadBuilder.emptyState')}</div>}
              {!loading && !error && filteredOwnedCards.map((card) => (
                <div key={card.id}>
                  <PlayerMiniCard card={card} assigned={assignedOwnedCardIds.has(card.id)} onClick={() => placeCard(card.id)} />
                </div>
              ))}
            </div>

            <div className="border-t-4 border-main bg-card p-3">
              <div className="mb-2 text-xs font-black uppercase text-main">{t('appPages.squadBuilder.rarityMix')}</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.rarityCounts).length === 0 ? <span className="text-xs font-bold uppercase text-subtle">—</span> : Object.entries(summary.rarityCounts).map(([rarity, count]) => (
                  <span key={rarity} className={`border-2 border-main px-2 py-1 text-[10px] font-black uppercase ${rarityBadgeClasses[rarity as CardRarity]}`}>{rarity} × {count}</span>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
