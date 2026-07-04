import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_PACKS, pickWeightedRarity, type CardRarity } from './cardPacks';

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
