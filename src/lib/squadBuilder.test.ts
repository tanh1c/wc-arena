import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignCardToSlot, clearSlot, getAssignedOwnedCardIds, getFormationSlots, getSquadSummary } from './squadBuilder';
import type { OwnedPlayerCard } from '../services/cards';

function ownedCard(id: string, rating = 80, rarity: OwnedPlayerCard['player_cards']['rarity'] = 'Common'): OwnedPlayerCard {
  return {
    id,
    user_id: 'user-1',
    card_id: `card-${id}`,
    source_pack_type: 'daily',
    opened_at: '2026-07-07T00:00:00.000Z',
    is_gif_upgrade: false,
    player_cards: {
      id: `card-${id}`,
      name: `Player ${id}`,
      position: 'ST',
      alternate_positions: null,
      team: 'Team',
      league: 'League',
      nation_region: 'Nation',
      skill_moves: null,
      footedness: null,
      height: null,
      weight: null,
      work_rate_att: null,
      work_rate_def: null,
      added_on: null,
      image_url: 'https://example.com/card.png',
      gif_url: null,
      rarity,
      rating,
    } as OwnedPlayerCard['player_cards'] & { rating: number },
  };
}

test('formation returns eleven slots', () => {
  assert.equal(getFormationSlots('4-3-3').length, 11);
});

test('assigning a card fills the selected slot', () => {
  assert.deepEqual(assignCardToSlot({}, 'st', 'owned-1'), { st: 'owned-1' });
});

test('assigning the same owned card moves it from the old slot', () => {
  assert.deepEqual(assignCardToSlot({ st: 'owned-1', lw: 'owned-2' }, 'rw', 'owned-1'), { lw: 'owned-2', rw: 'owned-1' });
});

test('clearing a slot removes only that slot', () => {
  assert.deepEqual(clearSlot({ st: 'owned-1', lw: 'owned-2' }, 'st'), { lw: 'owned-2' });
});

test('assigned owned card ids are exposed as a set', () => {
  assert.deepEqual(getAssignedOwnedCardIds({ st: 'owned-1', lw: 'owned-2' }), new Set(['owned-1', 'owned-2']));
});

test('squad summary is stable for empty and partial squads', () => {
  assert.deepEqual(getSquadSummary({}, []), { filledSlots: 0, averageRating: 0, rarityCounts: {} });

  assert.deepEqual(getSquadSummary({ st: 'owned-1', lw: 'owned-2' }, [ownedCard('owned-1', 90, 'Icon'), ownedCard('owned-2', 80, 'Rare')]), {
    filledSlots: 2,
    averageRating: 85,
    rarityCounts: { Icon: 1, Rare: 1 },
  });
});
