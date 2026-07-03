import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_PACKS, pickWeightedRarity, type CardRarity } from './cardPacks';

test('card pack config keeps daily free and premium paid with editable counts and rates', () => {
  assert.equal(CARD_PACKS.daily.priceCoins, 0);
  assert.equal(CARD_PACKS.daily.cardCount, 1);
  assert.equal(CARD_PACKS.daily.oncePerUtcDay, true);

  assert.ok(CARD_PACKS.premium.priceCoins > 0);
  assert.ok(CARD_PACKS.premium.cardCount === 3 || CARD_PACKS.premium.cardCount === 5);
  assert.equal(CARD_PACKS.premium.oncePerUtcDay, false);
  assert.ok(Object.values(CARD_PACKS.premium.rarityWeights).some((weight) => weight > 0));
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
