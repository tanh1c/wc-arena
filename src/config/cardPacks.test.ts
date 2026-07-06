import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_PACKS, pickWeightedCard, pickWeightedRarity, type CardRarity } from './cardPacks';

test('card pack config uses low icon-focused rarity rates', () => {
  assert.deepEqual(CARD_PACKS.daily.rarityWeights, { Common: 83, Rare: 15, Epic: 1.9, Icon: 0.1 });
  assert.deepEqual(CARD_PACKS.starter.rarityWeights, { Common: 76, Rare: 20, Epic: 3.75, Icon: 0.25 });
  assert.deepEqual(CARD_PACKS.premium.rarityWeights, { Common: 69, Rare: 25, Epic: 5.5, Icon: 0.5 });
  assert.deepEqual(CARD_PACKS.elite.rarityWeights, { Common: 57, Rare: 31, Epic: 10.5, Icon: 1.5 });
  assert.deepEqual(CARD_PACKS.icon.rarityWeights, { Common: 45, Rare: 33, Epic: 18, Icon: 4 });
});

test('card pack config includes five balanced gacha tiers', () => {
  assert.deepEqual(Object.keys(CARD_PACKS), ['daily', 'starter', 'premium', 'elite', 'icon']);

  assert.equal(CARD_PACKS.daily.priceCoins, 0);
  assert.equal(CARD_PACKS.daily.cardCount, 1);
  assert.equal(CARD_PACKS.daily.oncePerUtcDay, true);

  assert.equal(CARD_PACKS.starter.priceCoins, 20);
  assert.equal(CARD_PACKS.premium.priceCoins, 50);
  assert.equal(CARD_PACKS.elite.priceCoins, 100);
  assert.equal(CARD_PACKS.icon.priceCoins, 300);
  assert.ok(CARD_PACKS.premium.priceCoins < CARD_PACKS.elite.priceCoins);
  assert.ok(CARD_PACKS.elite.priceCoins < CARD_PACKS.icon.priceCoins);

  for (const pack of Object.values(CARD_PACKS)) {
    assert.equal(pack.oncePerUtcDay, pack === CARD_PACKS.daily);
    assert.equal(Object.values(pack.rarityWeights).reduce((sum, weight) => sum + weight, 0), 100);
  }
});

test('weighted card selection uses per-card drop weights', () => {
  const cards = [
    { id: 'messi', drop_weight: 1 },
    { id: 'other-icon', drop_weight: 9 },
  ];

  assert.equal(pickWeightedCard(cards, () => 0.05)?.id, 'messi');
  assert.equal(pickWeightedCard(cards, () => 0.11)?.id, 'other-icon');
});

test('weighted card selection skips zero-weight cards', () => {
  const cards = [
    { id: 'disabled', drop_weight: 0 },
    { id: 'enabled', drop_weight: 1 },
  ];

  assert.equal(pickWeightedCard(cards, () => 0)?.id, 'enabled');
});

test('weighted card selection returns null when all cards have zero weight', () => {
  assert.equal(pickWeightedCard([{ id: 'disabled', drop_weight: 0 }], () => 0), null);
});

test('weighted rarity selection skips rarities unavailable in the catalog', () => {
  const weights: Record<CardRarity, number> = {
    Common: 100,
    Rare: 10,
    Epic: 5,
    Icon: 1,
  };

  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Icon']), () => 0), 'Icon');
  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Rare', 'Epic']), () => 0), 'Rare');
  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Rare', 'Epic']), () => 0.99), 'Epic');
});

test('weighted rarity selection returns null when no configured rarity is available', () => {
  const weights: Record<CardRarity, number> = {
    Common: 0,
    Rare: 0,
    Epic: 0,
    Icon: 0,
  };

  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Common']), () => 0), null);
});
