import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignCardToSlot, clearSlot, getAssignedOwnedCardIds, getCardPositions, getFormationSlots, getSquadSummary, isCardEligibleForSlot, matchLabFormationKeys, pruneAssignmentsForOwnedCards, validateMatchLabSquad } from './squadBuilder';
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
      player_card_gameplay_profiles: [{ raw_stats: { OVR: rating }, effective_stats: { OVR: rating }, playstyles: [], traits: [], source_image_url: 'https://example.com/card.png' }],
      rating,
    } as OwnedPlayerCard['player_cards'] & { rating: number },
  };
}

test('formation returns eleven slots', () => {
  assert.equal(getFormationSlots('4-3-3').length, 11);
  assert.equal(getFormationSlots('4-2-3-1').length, 11);
});

test('Match Lab excludes Squad Builder-only 4-4-2', () => {
  assert.deepEqual(matchLabFormationKeys, ['4-3-3', '4-2-3-1', '3-5-2']);
});

test('card positions include clean alternate positions', () => {
  const card = ownedCard('wide');
  card.player_cards.position = 'RW';
  card.player_cards.alternate_positions = ' RM, CAM, , ';

  assert.deepEqual(getCardPositions(card.player_cards), ['RW', 'RM', 'CAM']);
  assert.ok(isCardEligibleForSlot(card, { id: 'rm', label: 'RM', line: 'mid', x: 0, y: 0 }));
});

test('match lab validation requires an eligible distinct profiled eleven', () => {
  const slots = getFormationSlots('4-3-3');
  const cards = slots.map((slot, index) => {
    const card = ownedCard(`owned-${index}`);
    card.card_id = `player-${index}`;
    card.player_cards.position = slot.label;
    return card;
  });
  const assignments = Object.fromEntries(slots.map((slot, index) => [slot.id, cards[index].id]));

  assert.deepEqual(validateMatchLabSquad('4-3-3', assignments, cards), { valid: true, reason: null });
  for (const card of cards) {
    const profile = card.player_cards.player_card_gameplay_profiles;
    if (Array.isArray(profile)) card.player_cards.player_card_gameplay_profiles = profile[0];
  }
  assert.deepEqual(validateMatchLabSquad('4-3-3', assignments, cards), { valid: true, reason: null });
  const profile = cards[0].player_cards.player_card_gameplay_profiles;
  cards[0].player_cards.player_card_gameplay_profiles = [];
  assert.deepEqual(validateMatchLabSquad('4-3-3', assignments, cards), { valid: false, reason: 'Every card needs a gameplay profile.' });
  cards[0].player_cards.player_card_gameplay_profiles = profile;
  assert.equal(validateMatchLabSquad('4-3-3', { ...assignments, rw: cards[0].id }, cards).valid, false);
  assert.equal(validateMatchLabSquad('4-3-3', Object.fromEntries(Object.entries(assignments).slice(1)), cards).valid, false);
  cards[1].card_id = cards[0].card_id;
  assert.equal(validateMatchLabSquad('4-3-3', assignments, cards).valid, false);
});

test('formation slots fit a wider shorter balanced pitch', () => {
  for (const formation of ['4-3-3', '4-4-2', '3-5-2'] as const) {
    const slots = getFormationSlots(formation);
    const minX = Math.min(...slots.map((slot) => slot.x));
    const maxX = Math.max(...slots.map((slot) => slot.x));
    const rowY = (line: 'gk' | 'def' | 'mid' | 'att') => slots.filter((slot) => slot.line === line).reduce((total, slot, index, row) => total + slot.y / row.length, 0);

    assert.ok(minX <= 14, `${formation} should use the wider left side`);
    assert.ok(maxX >= 86, `${formation} should use the wider right side`);
    assert.ok(rowY('att') >= 19 && rowY('att') <= 23, `${formation} attack row should sit higher`);
    assert.ok(rowY('mid') >= 40 && rowY('mid') <= 42, `${formation} midfield row should sit closer to attack`);
    assert.ok(rowY('def') >= 61 && rowY('def') <= 65, `${formation} defense row should sit higher`);
    assert.equal(rowY('gk'), 81);
  }
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

test('imported assignments keep only owned, eligible, distinct formation cards', () => {
  const slots = getFormationSlots('4-3-3');
  const cards = slots.map((slot, index) => {
    const card = ownedCard(`owned-${index}`);
    card.card_id = `player-${index}`;
    card.player_cards.position = slot.label;
    return card;
  });
  const duplicatePlayer = ownedCard('owned-copy');
  duplicatePlayer.card_id = cards[0].card_id;
  duplicatePlayer.player_cards.position = 'ST';
  const wrongPosition = ownedCard('owned-wrong');
  wrongPosition.card_id = 'player-wrong';
  wrongPosition.player_cards.position = 'GK';

  assert.deepEqual(pruneAssignmentsForOwnedCards('4-3-3', {
    gk: cards[0].id,
    lb: cards[1].id,
    cb1: cards[1].id,
    cb2: duplicatePlayer.id,
    rb: wrongPosition.id,
    missing: cards[2].id,
    cm1: 'missing-owned-card',
  }, [...cards, duplicatePlayer, wrongPosition]), {
    gk: cards[0].id,
    lb: cards[1].id,
  });
});

test('squad summary is stable for empty and partial squads', () => {
  assert.deepEqual(getSquadSummary({}, []), { filledSlots: 0, averageRating: 0, rarityCounts: {} });

  assert.deepEqual(getSquadSummary({ st: 'owned-1', lw: 'owned-2' }, [ownedCard('owned-1', 90, 'Icon'), ownedCard('owned-2', 80, 'Rare')]), {
    filledSlots: 2,
    averageRating: 85,
    rarityCounts: { Icon: 1, Rare: 1 },
  });
});
