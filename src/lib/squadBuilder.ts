import type { CardRarity } from '../config/cardPacks';
import type { OwnedPlayerCard } from '../services/cards';

export type FormationKey = '4-3-3' | '4-4-2' | '3-5-2';
export type SquadLine = 'gk' | 'def' | 'mid' | 'att';
export type SquadSlot = { id: string; label: string; line: SquadLine; x: number; y: number };
export type SquadAssignments = Record<string, string>;
export type SquadSummary = { filledSlots: number; averageRating: number; rarityCounts: Partial<Record<CardRarity, number>> };

const formations: Record<FormationKey, SquadSlot[]> = {
  '4-3-3': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 88 },
    { id: 'lb', label: 'LB', line: 'def', x: 18, y: 68 },
    { id: 'cb1', label: 'CB', line: 'def', x: 39, y: 70 },
    { id: 'cb2', label: 'CB', line: 'def', x: 61, y: 70 },
    { id: 'rb', label: 'RB', line: 'def', x: 82, y: 68 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 31, y: 47 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 50, y: 52 },
    { id: 'cm3', label: 'CM', line: 'mid', x: 69, y: 47 },
    { id: 'lw', label: 'LW', line: 'att', x: 22, y: 21 },
    { id: 'st', label: 'ST', line: 'att', x: 50, y: 16 },
    { id: 'rw', label: 'RW', line: 'att', x: 78, y: 21 },
  ],
  '4-4-2': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 88 },
    { id: 'lb', label: 'LB', line: 'def', x: 18, y: 68 },
    { id: 'cb1', label: 'CB', line: 'def', x: 39, y: 70 },
    { id: 'cb2', label: 'CB', line: 'def', x: 61, y: 70 },
    { id: 'rb', label: 'RB', line: 'def', x: 82, y: 68 },
    { id: 'lm', label: 'LM', line: 'mid', x: 18, y: 45 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 39, y: 49 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 61, y: 49 },
    { id: 'rm', label: 'RM', line: 'mid', x: 82, y: 45 },
    { id: 'st1', label: 'ST', line: 'att', x: 39, y: 18 },
    { id: 'st2', label: 'ST', line: 'att', x: 61, y: 18 },
  ],
  '3-5-2': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 88 },
    { id: 'cb1', label: 'CB', line: 'def', x: 30, y: 69 },
    { id: 'cb2', label: 'CB', line: 'def', x: 50, y: 72 },
    { id: 'cb3', label: 'CB', line: 'def', x: 70, y: 69 },
    { id: 'lm', label: 'LM', line: 'mid', x: 15, y: 45 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 35, y: 50 },
    { id: 'cam', label: 'CAM', line: 'mid', x: 50, y: 42 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 65, y: 50 },
    { id: 'rm', label: 'RM', line: 'mid', x: 85, y: 45 },
    { id: 'st1', label: 'ST', line: 'att', x: 39, y: 18 },
    { id: 'st2', label: 'ST', line: 'att', x: 61, y: 18 },
  ],
};

export const formationKeys = Object.keys(formations) as FormationKey[];

export function getFormationSlots(formation: FormationKey) {
  return formations[formation];
}

export function assignCardToSlot(assignments: SquadAssignments, slotId: string, ownedCardId: string) {
  return Object.fromEntries([...Object.entries(assignments).filter(([slot, card]) => slot === slotId || card !== ownedCardId), [slotId, ownedCardId]]);
}

export function clearSlot(assignments: SquadAssignments, slotId: string) {
  return Object.fromEntries(Object.entries(assignments).filter(([slot]) => slot !== slotId));
}

export function getAssignedOwnedCardIds(assignments: SquadAssignments) {
  return new Set(Object.values(assignments));
}

export function getSquadSummary(assignments: SquadAssignments, ownedCards: OwnedPlayerCard[]): SquadSummary {
  const cardById = new Map(ownedCards.map((card) => [card.id, card]));
  const cards = Object.values(assignments).map((id) => cardById.get(id)).filter((card): card is OwnedPlayerCard => Boolean(card));
  const ratingTotal = cards.reduce((total, card) => total + (Number((card.player_cards as { rating?: number }).rating) || 0), 0);
  const rarityCounts: Partial<Record<CardRarity, number>> = {};

  cards.forEach((card) => {
    rarityCounts[card.player_cards.rarity] = (rarityCounts[card.player_cards.rarity] ?? 0) + 1;
  });

  return {
    filledSlots: cards.length,
    averageRating: cards.length ? Math.round(ratingTotal / cards.length) : 0,
    rarityCounts,
  };
}
