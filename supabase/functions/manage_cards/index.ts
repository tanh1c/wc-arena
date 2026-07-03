import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CARD_PACKS, getUtcDay, pickWeightedRarity, type CardRarity, type PackType } from '../../../src/config/cardPacks.ts';
import { jsonResponse as sharedJsonResponse, requireAuthenticatedUser } from '../_shared/authGuards.ts';
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
  | { action: 'setShowcaseCard'; slotNumber: number; userPlayerCardId: string };

type PlayerCard = {
  id: string;
  rarity: CardRarity;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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

    const body = await req.json() as Body;

    if (body.action === 'openCardPack') {
      return jsonResponse(await openCardPack(supabase, user.id, body.packType));
    }

    if (body.action === 'setShowcaseCard') {
      return jsonResponse(await setShowcaseCard(supabase, user.id, body.slotNumber, body.userPlayerCardId));
    }

    return jsonResponse({ error: 'Unknown card action.' }, 400);
  } catch (error) {
    console.error('manage_cards failed', error);
    const message = error instanceof Error ? error.message : 'Card action failed.';
    return jsonResponse({ error: message }, 400);
  }
});

async function openCardPack(supabase: SupabaseClient, userId: string, packType: PackType) {
  const pack = CARD_PACKS[packType];
  if (!pack) throw new Error('Unknown pack type.');

  const openedOnUtc = getUtcDay();

  if (pack.oncePerUtcDay) {
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
  if (currentCoins < pack.priceCoins) throw new Error(`Not enough Coins. Required: ${pack.priceCoins}. Current: ${currentCoins}.`);

  const { data: ownedBefore, error: ownedError } = await supabase
    .from('user_player_cards')
    .select('card_id')
    .eq('user_id', userId);
  if (ownedError) throw ownedError;

  const ownedCardIdsBefore = new Set((ownedBefore ?? []).map((card: { card_id: string }) => card.card_id));
  const awardedCards = await drawCards(supabase, pack.cardCount, pack.rarityWeights);
  if (awardedCards.length !== pack.cardCount) throw new Error('Not enough cards are available for this pack.');

  const nextCoins = currentCoins - pack.priceCoins;
  if (pack.priceCoins > 0) await setUserCoins(supabase, userId, nextCoins);

  const { data: ownedRows, error: insertOwnedError } = await supabase
    .from('user_player_cards')
    .insert(awardedCards.map((card) => ({
      user_id: userId,
      card_id: card.id,
      source_pack_type: packType,
    })))
    .select('*, player_cards(*)');
  if (insertOwnedError) throw insertOwnedError;

  const { error: openingError } = await supabase.from('card_pack_openings').insert({
    user_id: userId,
    pack_type: packType,
    coins_spent: pack.priceCoins,
    cards_awarded: awardedCards.length,
    opened_on_utc: openedOnUtc,
  });
  if (openingError) throw openingError;

  return {
    cards: (ownedRows ?? []).map((row: { card_id: string }) => ({
      ...row,
      duplicate: ownedCardIdsBefore.has(row.card_id),
    })),
    coins: nextCoins,
    openedOnUtc,
  };
}

async function drawCards(
  supabase: SupabaseClient,
  count: number,
  rarityWeights: Record<CardRarity, number>,
) {
  const { data, error } = await supabase.from('player_cards').select('*');
  if (error) throw error;

  const cards = (data ?? []) as PlayerCard[];
  const cardsByRarity = new Map<CardRarity, PlayerCard[]>();
  for (const card of cards) {
    const current = cardsByRarity.get(card.rarity) ?? [];
    current.push(card);
    cardsByRarity.set(card.rarity, current);
  }

  const availableRarities = new Set(cardsByRarity.keys());
  const picked: PlayerCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const rarity = pickWeightedRarity(rarityWeights, availableRarities);
    if (!rarity) break;
    const options = cardsByRarity.get(rarity) ?? [];
    picked.push(options[Math.floor(Math.random() * options.length)]);
  }

  return picked;
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

async function getUserCoins(supabase: SupabaseClient, userId: string) {
  const { data: wallet, error } = await supabase
    .from('point_wallets')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Math.max(0, wallet?.balance ?? 0);
}

async function setUserCoins(supabase: SupabaseClient, userId: string, coins: number) {
  const { error } = await supabase.from('point_wallets').upsert({
    user_id: userId,
    balance: coins,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) throw error;
}
