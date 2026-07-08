import type { CardRarity } from '../config/cardPacks';
import type { OwnedPlayerCard } from '../services/cards';

export type FormationKey = '4-3-3' | '4-4-2' | '3-5-2';
export type SquadLine = 'gk' | 'def' | 'mid' | 'att';
export type SquadSlot = { id: string; label: string; line: SquadLine; x: number; y: number };
export type SquadAssignments = Record<string, string>;
export type SquadSummary = { filledSlots: number; averageRating: number; rarityCounts: Partial<Record<CardRarity, number>> };

const formations: Record<FormationKey, SquadSlot[]> = {
  '4-3-3': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 86 },
    { id: 'lb', label: 'LB', line: 'def', x: 14, y: 67 },
    { id: 'cb1', label: 'CB', line: 'def', x: 38, y: 69 },
    { id: 'cb2', label: 'CB', line: 'def', x: 62, y: 69 },
    { id: 'rb', label: 'RB', line: 'def', x: 86, y: 67 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 28, y: 49 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 50, y: 52 },
    { id: 'cm3', label: 'CM', line: 'mid', x: 72, y: 49 },
    { id: 'lw', label: 'LW', line: 'att', x: 16, y: 27 },
    { id: 'st', label: 'ST', line: 'att', x: 50, y: 24 },
    { id: 'rw', label: 'RW', line: 'att', x: 84, y: 27 },
  ],
  '4-4-2': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 86 },
    { id: 'lb', label: 'LB', line: 'def', x: 14, y: 67 },
    { id: 'cb1', label: 'CB', line: 'def', x: 38, y: 69 },
    { id: 'cb2', label: 'CB', line: 'def', x: 62, y: 69 },
    { id: 'rb', label: 'RB', line: 'def', x: 86, y: 67 },
    { id: 'lm', label: 'LM', line: 'mid', x: 14, y: 48 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 38, y: 51 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 62, y: 51 },
    { id: 'rm', label: 'RM', line: 'mid', x: 86, y: 48 },
    { id: 'st1', label: 'ST', line: 'att', x: 38, y: 25 },
    { id: 'st2', label: 'ST', line: 'att', x: 62, y: 25 },
  ],
  '3-5-2': [
    { id: 'gk', label: 'GK', line: 'gk', x: 50, y: 86 },
    { id: 'cb1', label: 'CB', line: 'def', x: 26, y: 68 },
    { id: 'cb2', label: 'CB', line: 'def', x: 50, y: 70 },
    { id: 'cb3', label: 'CB', line: 'def', x: 74, y: 68 },
    { id: 'lm', label: 'LM', line: 'mid', x: 14, y: 49 },
    { id: 'cm1', label: 'CM', line: 'mid', x: 34, y: 52 },
    { id: 'cam', label: 'CAM', line: 'mid', x: 50, y: 46 },
    { id: 'cm2', label: 'CM', line: 'mid', x: 66, y: 52 },
    { id: 'rm', label: 'RM', line: 'mid', x: 86, y: 49 },
    { id: 'st1', label: 'ST', line: 'att', x: 38, y: 25 },
    { id: 'st2', label: 'ST', line: 'att', x: 62, y: 25 },
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
