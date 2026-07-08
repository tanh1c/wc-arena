import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CARD_FORGE_COPY_COUNT, CARD_FORGE_RECIPES, CARD_PACKS, CARD_RARITIES, getIconChasePityPacksUntilGuaranteed, getUtcDay, ICON_CHASE_PITY_PACK_THRESHOLD, isIconChasePityDue, pickWeightedCard, pickWeightedRarity, type CardRarity, type PackType } from '../../../src/config/cardPacks.ts';
import { jsonResponse as sharedJsonResponse, requireAdminUser, requireAuthenticatedUser } from '../_shared/authGuards.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return sharedJsonResponse(corsHeaders, body, status);
}

type SupabaseClient = ReturnType<typeof createClient>;

type Body =
  | { action: 'openCardPack'; packType: PackType }
  | { action: 'setShowcaseCard'; slotNumber: number; userPlayerCardId: string }
  | { action: 'upgradeCardToGif'; cardId: string }
  | { action: 'forgeCard'; rarity: CardRarity; userPlayerCardIds: string[] }
  | { action: 'getIconChasePityState' }
  | { action: 'listCardPackCatalog' }
  | { action: 'upsertCardPackCatalog'; pack: CardPackCatalogInput }
  | { action: 'listAdminPlayerCards' }
  | { action: 'upsertPlayerCards'; cards: AdminPlayerCardInput[] }
  | { action: 'deletePlayerCard'; id: string };

type CardPackPoolType = 'all' | 'manual' | 'team' | 'nation_region' | 'league' | 'position';

type PlayerCard = {
  id: string;
  rarity: CardRarity;
  position: string;
  alternate_positions: string | null;
  team: string;
  league: string;
  nation_region: string;
  drop_weight: number;
};

type CardPackCatalogRow = {
  pack_type: string;
  title: string;
  description: string;
  image_path: string;
  card_count: number;
  price_coins: number;
  once_per_utc_day: boolean;
  rarity_weights: Record<CardRarity, number>;
  pool_type: CardPackPoolType;
  pool_values: string[];
  enabled: boolean;
  sort_order: number;
};

type CardPackCatalogInput = Record<string, unknown>;

type AdminPlayerCardInput = {
  id?: unknown;
  name?: unknown;
  position?: unknown;
  alternate_positions?: unknown;
  team?: unknown;
  league?: unknown;
  nation_region?: unknown;
  skill_moves?: unknown;
  footedness?: unknown;
  height?: unknown;
  weight?: unknown;
  work_rate_att?: unknown;
  work_rate_def?: unknown;
  added_on?: unknown;
  image_url?: unknown;
  gif_url?: unknown;
  rarity?: unknown;
  drop_weight?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as Body;

    if (body.action === 'listAdminPlayerCards') {
      const adminAuth = await requireAdminUser(req, corsHeaders);
      if (adminAuth instanceof Response) return adminAuth;
      return jsonResponse(await listAdminPlayerCards(adminAuth.supabase));
    }

    if (body.action === 'upsertPlayerCards') {
      const adminAuth = await requireAdminUser(req, corsHeaders);
      if (adminAuth instanceof Response) return adminAuth;
      return jsonResponse(await upsertPlayerCards(adminAuth.supabase, body.cards));
    }

    if (body.action === 'deletePlayerCard') {
      const adminAuth = await requireAdminUser(req, corsHeaders);
      if (adminAuth instanceof Response) return adminAuth;
      return jsonResponse(await deletePlayerCard(adminAuth.supabase, body.id));
    }

    if (body.action === 'listCardPackCatalog') {
      const adminAuth = await requireAdminUser(req, corsHeaders);
      if (adminAuth instanceof Response) return adminAuth;
      return jsonResponse(await listCardPackCatalog(adminAuth.supabase));
    }

    if (body.action === 'upsertCardPackCatalog') {
      const adminAuth = await requireAdminUser(req, corsHeaders);
      if (adminAuth instanceof Response) return adminAuth;
      return jsonResponse(await upsertCardPackCatalog(adminAuth.supabase, body.pack));
    }

    const auth = await requireAuthenticatedUser(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const { supabase, user } = auth;

    const rateLimit = await checkRateLimit({
      key: user.id,
      action: 'manage_cards',
      windowSeconds: 300,
      maxCount: 60,
    });
    if (!rateLimit.allowed) return jsonResponse({ error: 'Too many card actions. Try again soon.' }, 429);

    if (body.action === 'openCardPack') {
      return jsonResponse(await openCardPack(supabase, user.id, body.packType));
    }

    if (body.action === 'getIconChasePityState') {
      return jsonResponse({ iconChasePity: await getIconChasePityState(supabase, user.id) });
    }

    if (body.action === 'setShowcaseCard') {
      return jsonResponse(await setShowcaseCard(supabase, user.id, body.slotNumber, body.userPlayerCardId));
    }

    if (body.action === 'upgradeCardToGif') {
      return jsonResponse(await upgradeCardToGif(supabase, user.id, body.cardId));
    }

    if (body.action === 'forgeCard') {
      return jsonResponse(await forgeCard(supabase, user.id, body.rarity, body.userPlayerCardIds));
    }

    return jsonResponse({ error: 'Unknown card action.' }, 400);
  } catch (error) {
    console.error('manage_cards failed', error);
    const message = error instanceof Error ? error.message : 'Card action failed.';
    return jsonResponse({ error: message }, 400);
  }
});

async function openCardPack(supabase: SupabaseClient, userId: string, packType: PackType) {
  const pack = await getPackConfig(supabase, packType);
  if (!pack?.enabled) throw new Error('Unknown pack type.');

  const openedOnUtc = getUtcDay();

  if (pack.once_per_utc_day) {
    const { data: existing, error } = await supabase
      .from('card_pack_openings')
      .select('id')
      .eq('user_id', userId)
      .eq('pack_type', packType)
      .eq('opened_on_utc', openedOnUtc)
      .maybeSingle();

    if (error) throw error;
    if (existing) throw new Error('Daily pack already opened today.');
  }

  const currentCoins = await getUserCoins(supabase, userId);
  if (currentCoins < pack.price_coins) throw new Error(`Not enough Coins. Required: ${pack.price_coins}. Current: ${currentCoins}.`);

  const { data: ownedBefore, error: ownedError } = await supabase
    .from('user_player_cards')
    .select('card_id')
    .eq('user_id', userId);
  if (ownedError) throw ownedError;

  const ownedCardIdsBefore = new Set((ownedBefore ?? []).map((card: { card_id: string }) => card.card_id));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const iconChasePity = packType === 'icon' ? await getIconChasePityState(supabase, userId) : null;
    const awardedCards = await drawCards(supabase, pack.card_count, pack.rarity_weights, { forceIcon: iconChasePity?.nextGuaranteed ?? false, poolType: pack.pool_type, poolValues: pack.pool_values });
    if (awardedCards.length !== pack.card_count) throw new Error('Not enough cards are available for this pack.');

    const { data: openedRows, error: openError } = await supabase.rpc('open_card_pack_transaction', {
      p_user_id: userId,
      p_pack_type: packType,
      p_card_ids: awardedCards.map((card) => card.id),
      p_price_coins: pack.price_coins,
      p_opened_on_utc: openedOnUtc,
      p_expected_icon_miss_count: iconChasePity?.iconMissCount ?? null,
    });
    if (openError) {
      if (String(openError.message).includes('PITY_STATE_CHANGED') && attempt === 0) continue;
      throw openError;
    }

    const rows = openedRows ?? [];
    const nextIconMissCount = rows[0]?.next_icon_miss_count;
    return {
      cards: rows.map((row: { owned_card: { card_id: string } }) => ({
        ...row.owned_card,
        duplicate: ownedCardIdsBefore.has(row.owned_card.card_id),
      })),
      coins: rows[0]?.next_coins ?? currentCoins - pack.price_coins,
      openedOnUtc,
      ...(packType === 'icon' && typeof nextIconMissCount === 'number' ? { iconChasePity: formatIconChasePityState(nextIconMissCount) } : {}),
    };
  }

  throw new Error('Card pack opening failed. Try again.');
}

async function getPackConfig(supabase: SupabaseClient, packType: PackType): Promise<CardPackCatalogRow | null> {
  const { data, error } = await supabase
    .from('card_pack_catalog')
    .select('*')
    .eq('pack_type', packType)
    .maybeSingle();

  if (!error && data) return data as CardPackCatalogRow;

  const fallback = CARD_PACKS[packType];
  if (!fallback) return null;
  return {
    pack_type: packType,
    title: packType,
    description: '',
    image_path: `${packType}.png`,
    card_count: fallback.cardCount,
    price_coins: fallback.priceCoins,
    once_per_utc_day: fallback.oncePerUtcDay,
    rarity_weights: fallback.rarityWeights,
    pool_type: 'all',
    pool_values: [],
    enabled: true,
    sort_order: 0,
  };
}

async function listCardPackCatalog(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('card_pack_catalog').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return { packs: data ?? [] };
}

async function upsertCardPackCatalog(supabase: SupabaseClient, pack: CardPackCatalogInput) {
  const row = normalizePackCatalogInput(pack);
  const { data, error } = await supabase.from('card_pack_catalog').upsert(row).select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return { packs: data ?? [] };
}

function normalizePackCatalogInput(pack: CardPackCatalogInput) {
  const poolType = normalizePoolType(pack.pool_type);
  return {
    pack_type: normalizeRequiredString(pack.pack_type, 'pack_type'),
    title: normalizeRequiredString(pack.title, 'title'),
    description: normalizeRequiredString(pack.description, 'description'),
    image_path: normalizeRequiredString(pack.image_path, 'image_path'),
    card_count: normalizeInteger(pack.card_count, 'card_count', 1, 20),
    price_coins: normalizeInteger(pack.price_coins, 'price_coins', 0, 1000000),
    once_per_utc_day: Boolean(pack.once_per_utc_day),
    rarity_weights: normalizeRarityWeights(pack.rarity_weights),
    pool_type: poolType,
    pool_values: normalizePoolValues(poolType, pack.pool_values),
    enabled: pack.enabled !== false,
    sort_order: normalizeInteger(pack.sort_order, 'sort_order', -1000000, 1000000),
    updated_at: new Date().toISOString(),
  };
}

function normalizeRarityWeights(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pack rarity_weights are required.');
  return Object.fromEntries(CARD_RARITIES.map((rarity) => [rarity, normalizeWeight((value as Record<string, unknown>)[rarity])]));
}

function normalizePoolType(value: unknown): CardPackPoolType {
  const poolType = value == null || value === '' ? 'all' : String(value);
  if (!['all', 'manual', 'team', 'nation_region', 'league', 'position'].includes(poolType)) throw new Error('Pack pool_type is invalid.');
  return poolType as CardPackPoolType;
}

function normalizePoolValues(poolType: CardPackPoolType, value: unknown) {
  if (poolType === 'all') return [];
  if (!Array.isArray(value)) throw new Error('Pack pool_values are required.');
  const values = [...new Set(value.map((item) => normalizeRequiredString(item, 'pool_value')))];
  if (values.length === 0) throw new Error('Pack pool_values are required.');
  return values;
}

function normalizeInteger(value: unknown, field: string, min: number, max: number) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Pack ${field} must be an integer from ${min} to ${max}.`);
  return number;
}

function normalizeWeight(value: unknown) {
  const weight = value == null || value === '' ? 0 : typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000000) throw new Error('Pack rarity weights must be numbers from 0 to 1000000.');
  return weight;
}

async function drawCards(
  supabase: SupabaseClient,
  count: number,
  rarityWeights: Record<CardRarity, number>,
  options: { forceIcon?: boolean; poolType?: CardPackPoolType; poolValues?: string[] } = {},
) {
  const [{ data, error }, { data: weightRows, error: weightsError }] = await Promise.all([
    supabase.from('player_cards').select('*'),
    supabase.from('player_card_drop_weights').select('card_id, drop_weight'),
  ]);
  if (error) throw error;
  if (weightsError) throw weightsError;

  const weightsByCardId = new Map((weightRows ?? []).map((row: { card_id: string; drop_weight: number }) => [row.card_id, Number(row.drop_weight)]));
  const cards = ((data ?? []) as Array<Omit<PlayerCard, 'drop_weight'>>)
    .filter((card) => cardMatchesPackPool(card, options.poolType ?? 'all', options.poolValues ?? []))
    .map((card) => ({
      ...card,
      drop_weight: weightsByCardId.get(card.id) ?? 1,
    }));
  const cardsByRarity = new Map<CardRarity, PlayerCard[]>();
  for (const card of cards) {
    if (card.drop_weight <= 0) continue;
    const current = cardsByRarity.get(card.rarity) ?? [];
    current.push(card);
    cardsByRarity.set(card.rarity, current);
  }

  const availableRarities = new Set(cardsByRarity.keys());
  const picked: PlayerCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const rarity = options.forceIcon && index === 0 ? 'Icon' : pickWeightedRarity(rarityWeights, availableRarities);
    if (!rarity) break;
    const card = pickWeightedCard(cardsByRarity.get(rarity) ?? []);
    if (!card) {
      if (rarity === 'Icon') throw new Error('No Icon cards are available for Icon Chase pity.');
      break;
    }
    picked.push(card);
  }

  return picked;
}

function cardMatchesPackPool(card: Omit<PlayerCard, 'drop_weight'>, poolType: CardPackPoolType, poolValues: string[]) {
  if (poolType === 'all') return true;
  const values = new Set(poolValues);
  if (poolType === 'manual') return values.has(card.id);
  if (poolType === 'team') return values.has(card.team);
  if (poolType === 'nation_region') return values.has(card.nation_region);
  if (poolType === 'league') return values.has(card.league);
  if (poolType === 'position') return [card.position, ...splitAlternatePositions(card.alternate_positions)].some((position) => values.has(position));
  return false;
}

function splitAlternatePositions(value: string | null) {
  return (value ?? '').split(',').map((position) => position.trim()).filter(Boolean);
}

async function setShowcaseCard(supabase: SupabaseClient, userId: string, slotNumber: number, userPlayerCardId: string) {
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 3) {
    throw new Error('Showcase slot must be 1, 2, or 3.');
  }

  const { data: ownedCard, error: ownedError } = await supabase
    .from('user_player_cards')
    .select('id')
    .eq('id', userPlayerCardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (ownedError) throw ownedError;
  if (!ownedCard) throw new Error('You can only showcase your own cards.');

  const { error: upsertError } = await supabase.from('profile_card_showcases').upsert({
    user_id: userId,
    slot_number: slotNumber,
    user_player_card_id: userPlayerCardId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,slot_number' });
  if (upsertError) throw upsertError;

  const { data: showcase, error: showcaseError } = await supabase
    .from('profile_card_showcases')
    .select('*, user_player_cards(*, player_cards(*))')
    .eq('user_id', userId)
    .order('slot_number', { ascending: true });

  if (showcaseError) throw showcaseError;
  return { showcase: showcase ?? [] };
}

async function upgradeCardToGif(supabase: SupabaseClient, userId: string, id: string) {
  const cardId = normalizeRequiredString(id, 'id');
  const { data, error } = await supabase.rpc('upgrade_card_to_gif_transaction', {
    p_user_id: userId,
    p_card_id: cardId,
  });
  if (error) throw error;
  return { card: data?.[0]?.owned_card ?? null };
}

async function forgeCard(supabase: SupabaseClient, userId: string, rarity: CardRarity, userPlayerCardIds: string[]) {
  if (!CARD_RARITIES.includes(rarity)) throw new Error('Card rarity must be Common, Uncommon, Rare, Epic, Legendary, Heroes, Icon, or GOAT.');
  if (rarity === 'GOAT') throw new Error('GOAT cards cannot be forged.');
  const recipe = CARD_FORGE_RECIPES[rarity as keyof typeof CARD_FORGE_RECIPES];
  if (!recipe) throw new Error('Card rarity cannot be forged.');

  const selectedIds = Array.isArray(userPlayerCardIds) ? userPlayerCardIds.map((id) => normalizeRequiredString(id, 'userPlayerCardId')) : [];
  if (selectedIds.length !== CARD_FORGE_COPY_COUNT) throw new Error(`Select exactly ${CARD_FORGE_COPY_COUNT} cards to forge.`);
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('Selected cards must be unique.');

  const currentCoins = await getUserCoins(supabase, userId);
  if (currentCoins < recipe.priceCoins) throw new Error(`Not enough Coins. Required: ${recipe.priceCoins}. Current: ${currentCoins}.`);

  const awardedCards = await drawCards(supabase, 1, recipe.rarityWeights);
  if (awardedCards.length !== 1) throw new Error('No cards are available for forge.');

  const { data, error } = await supabase.rpc('forge_card_transaction', {
    p_user_id: userId,
    p_source_rarity: rarity,
    p_source_owned_card_ids: selectedIds,
    p_result_card_id: awardedCards[0].id,
    p_price_coins: recipe.priceCoins,
  });
  if (error) throw error;
  return { card: data?.[0]?.owned_card ?? null, coins: data?.[0]?.next_coins ?? currentCoins - recipe.priceCoins };
}

async function getIconChasePityState(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('icon_chase_pity_states')
    .select('icon_miss_count')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return formatIconChasePityState(data?.icon_miss_count ?? 0);
}

function formatIconChasePityState(iconMissCount: number) {
  return {
    iconMissCount,
    threshold: ICON_CHASE_PITY_PACK_THRESHOLD,
    packsUntilGuaranteed: getIconChasePityPacksUntilGuaranteed(iconMissCount),
    nextGuaranteed: isIconChasePityDue(iconMissCount),
  };
}

async function listAdminPlayerCards(supabase: SupabaseClient) {
  const [{ data: cards, error: cardsError }, { data: weights, error: weightsError }] = await Promise.all([
    supabase.from('player_cards').select('*').order('rarity', { ascending: true }).order('name', { ascending: true }),
    supabase.from('player_card_drop_weights').select('card_id, drop_weight'),
  ]);
  if (cardsError) throw cardsError;
  if (weightsError) throw weightsError;

  return { cards: mergeDropWeights(cards ?? [], weights ?? []) };
}

async function upsertPlayerCards(supabase: SupabaseClient, cards: AdminPlayerCardInput[]) {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('Cards must be a non-empty array.');

  const weights: number[] = [];
  const rows = cards.map((card) => {
    const rarity = normalizeRequiredString(card.rarity, 'rarity') as CardRarity;
    if (!CARD_RARITIES.includes(rarity)) throw new Error('Card rarity must be Common, Uncommon, Rare, Epic, Legendary, Heroes, Icon, or GOAT.');
    weights.push(normalizeDropWeight(card.drop_weight));

    return {
      ...(card.id == null ? {} : { id: normalizeRequiredString(card.id, 'id') }),
      name: normalizeRequiredString(card.name, 'name'),
      position: normalizeRequiredString(card.position, 'position'),
      alternate_positions: normalizeOptionalString(card.alternate_positions),
      team: normalizeRequiredString(card.team, 'team'),
      league: normalizeRequiredString(card.league, 'league'),
      nation_region: normalizeRequiredString(card.nation_region, 'nation_region'),
      skill_moves: normalizeOptionalString(card.skill_moves),
      footedness: normalizeOptionalString(card.footedness),
      height: normalizeOptionalString(card.height),
      weight: normalizeOptionalString(card.weight),
      work_rate_att: normalizeOptionalString(card.work_rate_att),
      work_rate_def: normalizeOptionalString(card.work_rate_def),
      added_on: normalizeOptionalString(card.added_on),
      image_url: normalizeRequiredString(card.image_url, 'image_url'),
      gif_url: normalizeOptionalString(card.gif_url),
      rarity,
    };
  });

  const { data, error } = await supabase.from('player_cards').upsert(rows).select('*');
  if (error) throw error;

  const weightRows = (data ?? []).map((card: { id: string }, index: number) => ({ card_id: card.id, drop_weight: weights[index] ?? 1 }));
  if (weightRows.length > 0) {
    const { error: weightsError } = await supabase.from('player_card_drop_weights').upsert(weightRows);
    if (weightsError) throw weightsError;
  }

  return { cards: mergeDropWeights(data ?? [], weightRows) };
}

function mergeDropWeights(cards: unknown[], weights: Array<{ card_id: string; drop_weight: number }>) {
  const weightsByCardId = new Map(weights.map((row) => [row.card_id, Number(row.drop_weight)]));
  return cards.map((card) => ({
    ...(card as Record<string, unknown>),
    drop_weight: weightsByCardId.get((card as { id: string }).id) ?? 1,
  }));
}

async function deletePlayerCard(supabase: SupabaseClient, id: string) {
  const cardId = normalizeRequiredString(id, 'id');
  const { error } = await supabase.from('player_cards').delete().eq('id', cardId);
  if (error) throw error;
  return { id: cardId };
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Card ${field} is required.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Card ${field} is required.`);
  return trimmed;
}

function normalizeOptionalString(value: unknown) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('Optional card fields must be strings or null.');
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeDropWeight(value: unknown) {
  if (value == null || value === '') return 1;
  const weight = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1000000) throw new Error('Card drop weight must be a number from 0 to 1000000.');
  return weight;
}

async function getUserCoins(supabase: SupabaseClient, userId: string) {
  const { data: wallet, error } = await supabase
    .from('point_wallets')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Math.max(0, wallet?.balance ?? 0);
}

