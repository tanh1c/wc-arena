import assert from 'node:assert/strict';
import test from 'node:test';
import { CARD_FORGE_COPY_COUNT, CARD_FORGE_RECIPES, CARD_PACKS, CARD_RARITIES, ICON_CHASE_PITY_PACK_THRESHOLD, getIconChasePityPacksUntilGuaranteed, isIconChasePityDue, pickWeightedCard, pickWeightedRarity, type CardRarity } from './cardPacks';

test('card rarity ladder uses six gacha tiers', () => {
  assert.deepEqual(CARD_RARITIES, ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Icon']);
});

test('card pack config uses six-tier gacha rarity rates', () => {
  assert.deepEqual(CARD_PACKS.daily.rarityWeights, { Common: 55, Uncommon: 30, Rare: 12, Epic: 2.5, Legendary: 0.45, Icon: 0.05 });
  assert.deepEqual(CARD_PACKS.starter.rarityWeights, { Common: 42, Uncommon: 34, Rare: 18, Epic: 5, Legendary: 0.9, Icon: 0.1 });
  assert.deepEqual(CARD_PACKS.premium.rarityWeights, { Common: 25, Uncommon: 32, Rare: 28, Epic: 12, Legendary: 2.6, Icon: 0.4 });
  assert.deepEqual(CARD_PACKS.elite.rarityWeights, { Common: 8, Uncommon: 18, Rare: 34, Epic: 30, Legendary: 8.5, Icon: 1.5 });
  assert.deepEqual(CARD_PACKS.icon.rarityWeights, { Common: 0, Uncommon: 0, Rare: 35, Epic: 45, Legendary: 15, Icon: 5 });
});

test('card pack config includes five pack types', () => {
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

test('Icon Chase pity is due on the tenth missed pack', () => {
  assert.equal(ICON_CHASE_PITY_PACK_THRESHOLD, 10);
  assert.equal(isIconChasePityDue(8), false);
  assert.equal(isIconChasePityDue(9), true);
  assert.equal(getIconChasePityPacksUntilGuaranteed(0), 10);
  assert.equal(getIconChasePityPacksUntilGuaranteed(9), 1);
});

test('card forge recipes sink five spare cards with six-tier upgrade odds', () => {
  assert.equal(CARD_FORGE_COPY_COUNT, 5);
  assert.equal(CARD_FORGE_RECIPES.Common.priceCoins, 100);
  assert.deepEqual(CARD_FORGE_RECIPES.Common.rarityWeights, { Common: 75, Uncommon: 22, Rare: 3, Epic: 0, Legendary: 0, Icon: 0 });
  assert.equal(CARD_FORGE_RECIPES.Uncommon.priceCoins, 200);
  assert.deepEqual(CARD_FORGE_RECIPES.Uncommon.rarityWeights, { Common: 0, Uncommon: 72, Rare: 24, Epic: 4, Legendary: 0, Icon: 0 });
  assert.equal(CARD_FORGE_RECIPES.Rare.priceCoins, 300);
  assert.deepEqual(CARD_FORGE_RECIPES.Rare.rarityWeights, { Common: 0, Uncommon: 0, Rare: 75, Epic: 22, Legendary: 3, Icon: 0 });
  assert.equal(CARD_FORGE_RECIPES.Epic.priceCoins, 1000);
  assert.deepEqual(CARD_FORGE_RECIPES.Epic.rarityWeights, { Common: 0, Uncommon: 0, Rare: 0, Epic: 80, Legendary: 18, Icon: 2 });
  assert.equal(CARD_FORGE_RECIPES.Legendary.priceCoins, 2500);
  assert.deepEqual(CARD_FORGE_RECIPES.Legendary.rarityWeights, { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 90, Icon: 10 });
  assert.equal('Icon' in CARD_FORGE_RECIPES, false);
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
    Uncommon: 25,
    Rare: 10,
    Epic: 5,
    Legendary: 2,
    Icon: 1,
  };

  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Icon']), () => 0), 'Icon');
  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Rare', 'Epic']), () => 0), 'Rare');
  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Rare', 'Epic']), () => 0.99), 'Epic');
});

test('weighted rarity selection returns null when no configured rarity is available', () => {
  const weights: Record<CardRarity, number> = {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
    Icon: 0,
  };

  assert.equal(pickWeightedRarity(weights, new Set<CardRarity>(['Common']), () => 0), null);
});
