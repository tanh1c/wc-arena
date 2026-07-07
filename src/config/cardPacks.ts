export type PackType = 'daily' | 'starter' | 'premium' | 'elite' | 'icon';
export type CardRarity = 'Common' | 'Rare' | 'Epic' | 'Icon';

export type CardPackConfig = {
  cardCount: number;
  priceCoins: number;
  oncePerUtcDay: boolean;
  rarityWeights: Record<CardRarity, number>;
};

export const ICON_CHASE_PITY_PACK_THRESHOLD = 10;
export const CARD_FORGE_COPY_COUNT = 5;

export const CARD_FORGE_RECIPES = {
  Common: { priceCoins: 100, rarityWeights: { Common: 80, Rare: 19, Epic: 1, Icon: 0 } },
  Rare: { priceCoins: 300, rarityWeights: { Common: 0, Rare: 82, Epic: 17, Icon: 1 } },
  Epic: { priceCoins: 1000, rarityWeights: { Common: 0, Rare: 0, Epic: 90, Icon: 10 } },
} satisfies Partial<Record<CardRarity, { priceCoins: number; rarityWeights: Record<CardRarity, number> }>>;

export const CARD_PACKS: Record<PackType, CardPackConfig> = {
  daily: {
    cardCount: 1,
    priceCoins: 0,
    oncePerUtcDay: true,
    rarityWeights: {
      Common: 83,
      Rare: 15,
      Epic: 1.9,
      Icon: 0.1,
    },
  },
  starter: {
    cardCount: 2,
    priceCoins: 20,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 76,
      Rare: 20,
      Epic: 3.75,
      Icon: 0.25,
    },
  },
  premium: {
    cardCount: 3,
    priceCoins: 50,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 69,
      Rare: 25,
      Epic: 5.5,
      Icon: 0.5,
    },
  },
  elite: {
    cardCount: 5,
    priceCoins: 100,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 57,
      Rare: 31,
      Epic: 10.5,
      Icon: 1.5,
    },
  },
  icon: {
    cardCount: 5,
    priceCoins: 300,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 45,
      Rare: 33,
      Epic: 18,
      Icon: 4,
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
