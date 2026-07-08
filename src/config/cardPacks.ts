export type PackType = string;
export const CARD_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Heroes', 'Icon', 'GOAT'] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

export type CardPackConfig = {
  cardCount: number;
  priceCoins: number;
  oncePerUtcDay: boolean;
  rarityWeights: Record<CardRarity, number>;
};

export const ICON_CHASE_PITY_PACK_THRESHOLD = 10;
export const CARD_FORGE_COPY_COUNT = 5;

export const CARD_FORGE_RECIPES = {
  Common: { priceCoins: 10, rarityWeights: { Common: 75, Uncommon: 22, Rare: 3, Epic: 0, Legendary: 0, Heroes: 0, Icon: 0, GOAT: 0 } },
  Uncommon: { priceCoins: 20, rarityWeights: { Common: 0, Uncommon: 72, Rare: 24, Epic: 4, Legendary: 0, Heroes: 0, Icon: 0, GOAT: 0 } },
  Rare: { priceCoins: 30, rarityWeights: { Common: 0, Uncommon: 0, Rare: 75, Epic: 22, Legendary: 3, Heroes: 0, Icon: 0, GOAT: 0 } },
  Epic: { priceCoins: 100, rarityWeights: { Common: 0, Uncommon: 0, Rare: 0, Epic: 80, Legendary: 18, Heroes: 2, Icon: 0, GOAT: 0 } },
  Legendary: { priceCoins: 250, rarityWeights: { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 88, Heroes: 10, Icon: 2, GOAT: 0 } },
  Heroes: { priceCoins: 500, rarityWeights: { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0, Heroes: 90, Icon: 9, GOAT: 1 } },
  Icon: { priceCoins: 1000, rarityWeights: { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0, Heroes: 0, Icon: 96, GOAT: 4 } },
} satisfies Partial<Record<CardRarity, { priceCoins: number; rarityWeights: Record<CardRarity, number> }>>;

export const CARD_PACKS: Record<PackType, CardPackConfig> = {
  daily: {
    cardCount: 1,
    priceCoins: 0,
    oncePerUtcDay: true,
    rarityWeights: {
      Common: 55,
      Uncommon: 30,
      Rare: 12,
      Epic: 2.5,
      Legendary: 0.4,
      Heroes: 0.08,
      Icon: 0.02,
      GOAT: 0,
    },
  },
  starter: {
    cardCount: 2,
    priceCoins: 20,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 42,
      Uncommon: 34,
      Rare: 18,
      Epic: 5,
      Legendary: 0.8,
      Heroes: 0.15,
      Icon: 0.05,
      GOAT: 0,
    },
  },
  premium: {
    cardCount: 3,
    priceCoins: 50,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 25,
      Uncommon: 32,
      Rare: 28,
      Epic: 12,
      Legendary: 2.4,
      Heroes: 0.45,
      Icon: 0.13,
      GOAT: 0.02,
    },
  },
  elite: {
    cardCount: 5,
    priceCoins: 100,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 8,
      Uncommon: 18,
      Rare: 34,
      Epic: 30,
      Legendary: 8,
      Heroes: 1.5,
      Icon: 0.45,
      GOAT: 0.05,
    },
  },
  icon: {
    cardCount: 5,
    priceCoins: 300,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 0,
      Uncommon: 0,
      Rare: 32,
      Epic: 43,
      Legendary: 17,
      Heroes: 5,
      Icon: 2.8,
      GOAT: 0.2,
    },
  },
};

export function isIconChasePityDue(iconMissCount: number) {
  return iconMissCount >= ICON_CHASE_PITY_PACK_THRESHOLD - 1;
}

export function getIconChasePityPacksUntilGuaranteed(iconMissCount: number) {
  return Math.max(1, ICON_CHASE_PITY_PACK_THRESHOLD - iconMissCount);
}

export function pickWeightedRarity(
  weights: Record<CardRarity, number>,
  availableRarities: Set<CardRarity>,
  random = Math.random,
) {
  const entries = (Object.entries(weights) as Array<[CardRarity, number]>).filter(
    ([rarity, weight]) => weight > 0 && availableRarities.has(rarity),
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;

  let roll = random() * total;
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }

  return entries.at(-1)?.[0] ?? null;
}

export function pickWeightedCard<T extends { drop_weight: number }>(cards: T[], random = Math.random) {
  const entries = cards.filter((card) => card.drop_weight > 0);
  const total = entries.reduce((sum, card) => sum + card.drop_weight, 0);
  if (total <= 0) return null;

  let roll = random() * total;
  for (const card of entries) {
    if (roll < card.drop_weight) return card;
    roll -= card.drop_weight;
  }

  return entries.at(-1) ?? null;
}

export function getUtcDay(value = new Date()) {
  return value.toISOString().slice(0, 10);
}
