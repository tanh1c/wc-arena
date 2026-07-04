export type PackType = 'daily' | 'starter' | 'premium' | 'elite' | 'icon';
export type CardRarity = 'Common' | 'Rare' | 'Epic' | 'Icon';

export type CardPackConfig = {
  cardCount: number;
  priceCoins: number;
  oncePerUtcDay: boolean;
  rarityWeights: Record<CardRarity, number>;
};

export const CARD_PACKS: Record<PackType, CardPackConfig> = {
  daily: {
    cardCount: 1,
    priceCoins: 0,
    oncePerUtcDay: true,
    rarityWeights: {
      Common: 75,
      Rare: 20,
      Epic: 4,
      Icon: 1,
    },
  },
  starter: {
    cardCount: 2,
    priceCoins: 75,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 68,
      Rare: 24,
      Epic: 7,
      Icon: 1,
    },
  },
  premium: {
    cardCount: 3,
    priceCoins: 150,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 60,
      Rare: 30,
      Epic: 8,
      Icon: 2,
    },
  },
  elite: {
    cardCount: 5,
    priceCoins: 400,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 45,
      Rare: 35,
      Epic: 16,
      Icon: 4,
    },
  },
  icon: {
    cardCount: 5,
    priceCoins: 1000,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 25,
      Rare: 35,
      Epic: 28,
      Icon: 12,
    },
  },
};

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

export function getUtcDay(value = new Date()) {
  return value.toISOString().slice(0, 10);
}
