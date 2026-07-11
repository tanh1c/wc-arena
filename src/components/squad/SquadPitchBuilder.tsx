import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CARD_RARITIES, type CardRarity } from '../../config/cardPacks';
import { assignCardToSlot, clearSlot, formationKeys, getAssignedOwnedCardIds, getFormationSlots, getSquadSummary, type FormationKey, type SquadAssignments } from '../../lib/squadBuilder';
import { getPlayerCardDisplayImageUrl, type OwnedPlayerCard } from '../../services/cards';
import emptySlotImage from '../../../squadbuilder_empty_slot.svg';

type RarityFilter = CardRarity | 'all';
type PositionFilter = 'all' | string;
type PlayerSort = 'position' | 'rarity';
type PlayerCardPoolItem = OwnedPlayerCard & { duplicateCount: number; ownedCards: OwnedPlayerCard[] };

type Props = {
  formation: FormationKey;
  assignments: SquadAssignments;
  ownedCards: OwnedPlayerCard[];
  availableFormations?: FormationKey[];
  loading?: boolean;
  error?: string | null;
  onFormationChange: (formation: FormationKey) => void;
  onAssignmentsChange: (assignments: SquadAssignments) => void;
};

const PLAYER_PAGE_SIZE = 12;
const POSITION_ORDER = ['GK', 'LB', 'LWB', 'CB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];
const RARITY_ORDER = [...CARD_RARITIES].reverse();
const POSITION_FILTERS: PositionFilter[] = ['all', ...POSITION_ORDER];

const rarityBadgeClasses: Record<CardRarity, string> = {
  Common: 'bg-[#d8ff65] text-main', Uncommon: 'bg-[#a7f3d0] text-main', Rare: 'bg-[#00d4ff] text-main', Epic: 'bg-[#ff2bd6] text-white', Legendary: 'bg-[#f59e0b] text-main', Heroes: 'bg-[#10b981] text-white', Icon: 'bg-[#fff0b8] text-main', GOAT: 'bg-[#111827] text-[#fde68a]',
};

function positionRank(position: string) {
  const rank = POSITION_ORDER.indexOf(position);
  return rank === -1 ? POSITION_ORDER.length : rank;
}

function rarityRank(rarity: CardRarity) {
  return RARITY_ORDER.indexOf(rarity);
}

function PlayerMiniCard({ card, assigned, onClick }: { card: PlayerCardPoolItem; assigned: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`grid h-24 w-full grid-cols-[64px_minmax(0,1fr)_44px] gap-2 border-2 border-main p-2 text-left shadow-[3px_3px_0_var(--color-shadow)] transition-all ${assigned ? 'bg-muted opacity-60' : 'bg-card hover:bg-c1 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'}`}>
    <span className="flex h-full items-end justify-center overflow-hidden border-2 border-main bg-muted"><img src={getPlayerCardDisplayImageUrl(card.player_cards, card.is_gif_upgrade)} alt={card.player_cards.name} loading="lazy" className="max-h-full max-w-full object-contain" /></span>
    <span className="min-w-0 self-center"><span className="block truncate text-sm font-black uppercase leading-tight text-main">{card.player_cards.name}</span><span className="mt-1 flex flex-wrap gap-1 text-[10px] font-black uppercase"><span className="border-2 border-main bg-c1 px-1.5 py-0.5 text-main">{card.player_cards.position}</span><span className={`border-2 border-main px-1.5 py-0.5 ${rarityBadgeClasses[card.player_cards.rarity]}`}>{card.player_cards.rarity}</span></span><span className="mt-1 block truncate text-[10px] font-bold uppercase text-subtle">{card.player_cards.team}</span></span>
    {card.duplicateCount > 1 && <span className="self-start border-2 border-main bg-c3 px-1.5 py-0.5 text-[10px] font-black uppercase text-main">×{card.duplicateCount}</span>}
  </button>;
}

export default function SquadPitchBuilder({ formation, assignments, ownedCards, availableFormations = formationKeys, loading = false, error = null, onFormationChange, onAssignmentsChange }: Props) {
  const { t } = useTranslation();
  const [selectedSlotId, setSelectedSlotId] = useState('st');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [playerSort, setPlayerSort] = useState<PlayerSort>('position');
  const [playerPage, setPlayerPage] = useState(0);
  const [showAnimatedCards, setShowAnimatedCards] = useState(false);
  const slots = getFormationSlots(formation);
  const ownedCardById = useMemo(() => new Map(ownedCards.map((card) => [card.id, card])), [ownedCards]);
  const assignedOwnedCardIds = getAssignedOwnedCardIds(assignments);
  const summary = getSquadSummary(assignments, ownedCards);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);
  const groupedOwnedCards = useMemo(() => {
    const groups = new Map<string, OwnedPlayerCard[]>();
    ownedCards.forEach((card) => groups.set(card.card_id, [...(groups.get(card.card_id) ?? []), card]));
    return [...groups.values()].map((cards) => ({ ...cards[0], duplicateCount: cards.length, ownedCards: cards }));
  }, [ownedCards]);
  const filteredOwnedCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groupedOwnedCards.filter((card) => (rarityFilter === 'all' || card.player_cards.rarity === rarityFilter) && (positionFilter === 'all' || card.player_cards.position === positionFilter) && (!query || `${card.player_cards.name} ${card.player_cards.team} ${card.player_cards.nation_region} ${card.player_cards.position}`.toLowerCase().includes(query))).sort((first, second) => playerSort === 'rarity' ? rarityRank(first.player_cards.rarity) - rarityRank(second.player_cards.rarity) || first.player_cards.name.localeCompare(second.player_cards.name) : positionRank(first.player_cards.position) - positionRank(second.player_cards.position) || first.player_cards.name.localeCompare(second.player_cards.name));
  }, [groupedOwnedCards, playerSort, positionFilter, rarityFilter, search]);
  const playerPageCount = Math.max(1, Math.ceil(filteredOwnedCards.length / PLAYER_PAGE_SIZE));
  const safePlayerPage = Math.min(playerPage, playerPageCount - 1);
  const paginatedOwnedCards = filteredOwnedCards.slice(safePlayerPage * PLAYER_PAGE_SIZE, (safePlayerPage + 1) * PLAYER_PAGE_SIZE);

  useEffect(() => setPlayerPage(0), [playerSort, positionFilter, rarityFilter, search]);

  function placeCard(card: PlayerCardPoolItem) {
    const slotId = selectedSlotId || slots.find((slot) => !assignments[slot.id])?.id;
    const ownedCardId = card.ownedCards.find((ownedCard) => !assignedOwnedCardIds.has(ownedCard.id))?.id;
    if (!slotId || !ownedCardId) return;
    onAssignmentsChange(assignCardToSlot(assignments, slotId, ownedCardId));
  }

  return <section className="grid overflow-hidden border-4 border-main bg-card shadow-[8px_8px_0_0_var(--color-shadow)] xl:grid-cols-[minmax(0,1fr)_360px]">
    <main className="min-w-0 border-b-4 border-main bg-muted xl:border-b-0 xl:border-r-4">
      <div className="flex flex-col gap-3 border-b-4 border-main bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{availableFormations.map((key) => <button key={key} type="button" onClick={() => { onFormationChange(key); onAssignmentsChange({}); }} className={`border-2 border-main px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${formation === key ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}>{key}</button>)}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowAnimatedCards((current) => !current)} className={`border-2 border-main px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${showAnimatedCards ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-c1'}`}>{t(showAnimatedCards ? 'appPages.squadBuilder.animationOn' : 'appPages.squadBuilder.animationOff')}</button><button type="button" onClick={() => onAssignmentsChange({})} className="inline-flex items-center gap-2 border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)] hover:bg-c5"><Trash2 size={14} strokeWidth={3} /> {t('appPages.squadBuilder.clearSquad')}</button>{selectedSlot && assignments[selectedSlot.id] && <button type="button" onClick={() => onAssignmentsChange(clearSlot(assignments, selectedSlot.id))} className="border-2 border-main bg-c1 px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">Clear slot</button>}</div></div>
      <div onClick={() => setSelectedSlotId('')} className="bg-[#0b5d3b] p-3 sm:p-5"><div className="relative mx-auto aspect-[12/13] min-h-[620px] max-w-[820px] overflow-hidden border-4 border-white/80 bg-[#147a48] shadow-[6px_6px_0_var(--color-shadow)]"><div className="absolute inset-4 border-4 border-white/75" /><div className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 bg-white/60" /><div className="absolute left-1/2 top-4 h-20 w-28 -translate-x-1/2 border-x-4 border-b-4 border-white/60" /><div className="absolute bottom-4 left-1/2 h-20 w-28 -translate-x-1/2 border-x-4 border-t-4 border-white/60" />{slots.map((slot) => { const card = ownedCardById.get(assignments[slot.id]); const selected = selectedSlotId === slot.id; return <button key={slot.id} type="button" onClick={(event) => { event.stopPropagation(); setSelectedSlotId(slot.id); setPositionFilter(slot.label); }} className={`absolute w-[96px] -translate-x-1/2 -translate-y-1/2 text-center transition-transform sm:w-[132px] ${selected ? 'z-20 scale-110' : 'z-10 hover:scale-105'}`} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>{card ? <span className="block"><img src={getPlayerCardDisplayImageUrl(card.player_cards, showAnimatedCards || card.is_gif_upgrade)} alt={card.player_cards.name} className="mx-auto h-32 w-32 object-contain drop-shadow-[4px_4px_0_rgba(0,0,0,0.35)] sm:h-40 sm:w-40" /><span className="mt-1 inline-block min-w-12 border-2 border-main bg-[#101827] px-2 py-0.5 text-[10px] font-black uppercase leading-tight text-c3 shadow-[2px_2px_0_rgba(0,0,0,0.4)] sm:text-xs">{slot.label}</span></span> : <span className="block"><img src={emptySlotImage} alt="" className="mx-auto h-16 w-16 object-contain drop-shadow-[4px_4px_0_var(--color-shadow)] sm:h-20 sm:w-20" /><span className={`mt-1 inline-block border-2 border-main px-2 py-0.5 text-[10px] font-black uppercase shadow-[2px_2px_0_var(--color-shadow)] ${selected ? 'bg-c1 text-main' : 'bg-card text-main'}`}>{slot.label}</span></span>}</button>; })}</div></div>
    </main>
    <aside className="flex min-h-0 flex-col bg-card"><div className="grid grid-cols-3 border-b-4 border-main text-center"><div className="border-r-4 border-main bg-c1 p-3 text-main"><div className="text-[10px] font-black uppercase">Filled</div><div className="text-2xl font-black">{summary.filledSlots}/11</div></div><div className="border-r-4 border-main bg-c2 p-3 text-inv"><div className="text-[10px] font-black uppercase">Avg</div><div className="text-2xl font-black">{summary.averageRating || '—'}</div></div><div className="bg-c3 p-3 text-main"><div className="text-[10px] font-black uppercase">Cards</div><div className="text-2xl font-black">{ownedCards.length}</div></div></div><div className="border-b-4 border-main bg-muted p-3"><div className="mb-3 flex items-center justify-between gap-2"><div className="min-w-0"><h2 className="text-lg font-black uppercase leading-none text-main">Card pool</h2><p className="mt-1 truncate text-xs font-bold uppercase text-subtle">Selected: {selectedSlot?.label ?? '—'}</p></div><Users size={22} strokeWidth={3} /></div><label className="mb-2 flex items-center gap-2 border-2 border-main bg-card px-3 py-2 shadow-[2px_2px_0_var(--color-shadow)]"><Search size={16} strokeWidth={3} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cards" className="w-full bg-transparent text-xs font-black uppercase outline-none placeholder:text-subtle" /></label><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)} className="w-full border-2 border-main bg-card px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)] outline-none"><option value="all">All rarities</option>{CARD_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}</select><div className="grid grid-cols-2 gap-1"><button type="button" onClick={() => setPlayerSort('position')} className={`border-2 border-main px-2 py-2 text-[10px] font-black uppercase ${playerSort === 'position' ? 'bg-c2 text-inv' : 'bg-card text-main'}`}>Position</button><button type="button" onClick={() => setPlayerSort('rarity')} className={`border-2 border-main px-2 py-2 text-[10px] font-black uppercase ${playerSort === 'rarity' ? 'bg-c2 text-inv' : 'bg-card text-main'}`}>Rarity</button></div></div><div className="mt-2 flex gap-1 overflow-x-auto pb-1">{POSITION_FILTERS.map((position) => <button key={position} type="button" onClick={() => setPositionFilter(position)} className={`shrink-0 border-2 border-main px-2 py-1 text-[10px] font-black uppercase ${positionFilter === position ? 'bg-c2 text-inv' : 'bg-card text-main'}`}>{position === 'all' ? 'All positions' : position}</button>)}</div></div><div className="min-h-0 flex-1 p-3"><div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{loading && <div className="border-2 border-main bg-card p-4 text-sm font-black uppercase text-main">Loading cards…</div>}{error && <div className="border-2 border-main bg-c5 p-4 text-sm font-black uppercase text-main">{error}</div>}{!loading && !error && filteredOwnedCards.length === 0 && <div className="border-2 border-main bg-card p-4 text-sm font-black uppercase text-main">No cards found.</div>}{!loading && !error && paginatedOwnedCards.map((card) => <div key={card.id}><PlayerMiniCard card={card} assigned={card.ownedCards.every((ownedCard) => assignedOwnedCardIds.has(ownedCard.id))} onClick={() => placeCard(card)} /></div>)}</div>{!loading && !error && filteredOwnedCards.length > PLAYER_PAGE_SIZE && <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-black uppercase text-main"><button type="button" onClick={() => setPlayerPage((page) => Math.max(0, page - 1))} disabled={safePlayerPage === 0} className="border-2 border-main bg-card px-2 py-2 disabled:opacity-40">Previous</button><span className="whitespace-nowrap text-subtle">{safePlayerPage + 1}/{playerPageCount}</span><button type="button" onClick={() => setPlayerPage((page) => Math.min(playerPageCount - 1, page + 1))} disabled={safePlayerPage >= playerPageCount - 1} className="border-2 border-main bg-card px-2 py-2 disabled:opacity-40">Next</button></div>}</div></aside>
  </section>;
}
