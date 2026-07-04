import { supabase } from '../lib/supabaseClient';
import type { CardRarity, PackType } from '../config/cardPacks';
import { getFunctionErrorMessage } from './functionErrors';

export type PlayerCard = {
  id: string;
  name: string;
  position: string;
  alternate_positions: string | null;
  team: string;
  league: string;
  nation_region: string;
  skill_moves: string | null;
  footedness: string | null;
  height: string | null;
  weight: string | null;
  work_rate_att: string | null;
  work_rate_def: string | null;
  added_on: string | null;
  image_url: string;
  rarity: CardRarity;
};

export type OwnedPlayerCard = {
  id: string;
  user_id: string;
  card_id: string;
  source_pack_type: PackType;
  opened_at: string;
  player_cards: PlayerCard;
};

export type CatalogCardWithOwnedCount = PlayerCard & {
  ownedCount: number;
  ownedCards: OwnedPlayerCard[];
};

export type ShowcaseCard = {
  user_id: string;
  slot_number: number;
  user_player_card_id: string;
  updated_at: string;
  user_player_cards: OwnedPlayerCard;
};

export type OpenCardPackResult = {
  cards: Array<OwnedPlayerCard & { duplicate: boolean }>;
  coins: number;
  openedOnUtc: string;
};

export async function listPlayerCards() {
  const { data, error } = await supabase
    .from('player_cards')
    .select('*')
    .order('rarity', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlayerCard[];
}

export async function listCurrentUserOwnedCards() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_player_cards')
    .select('*, player_cards(*)')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as OwnedPlayerCard[];
}

export async function listCurrentUserShowcase() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from('profile_card_showcases')
    .select('*, user_player_cards(*, player_cards(*))')
    .eq('user_id', user.id)
    .order('slot_number', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShowcaseCard[];
}

export async function listProfileShowcase(userId: string) {
  const { data, error } = await supabase
    .from('profile_card_showcases')
    .select('*, user_player_cards(*, player_cards(*))')
    .eq('user_id', userId)
    .order('slot_number', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShowcaseCard[];
}

export async function openCardPack(packType: PackType) {
  const { data, error } = await supabase.functions.invoke<OpenCardPackResult>('manage_cards', {
    body: { action: 'openCardPack', packType },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data as OpenCardPackResult;
}

export async function setShowcaseCard(slotNumber: number, userPlayerCardId: string) {
  const { data, error } = await supabase.functions.invoke<{ showcase: ShowcaseCard[] }>('manage_cards', {
    body: { action: 'setShowcaseCard', slotNumber, userPlayerCardId },
  });

  if (error) throw error;
  return data.showcase;
}

export function groupCatalogWithOwnership(cards: PlayerCard[], ownedCards: OwnedPlayerCard[]) {
  const ownedByCardId = new Map<string, OwnedPlayerCard[]>();
  for (const ownedCard of ownedCards) {
    const current = ownedByCardId.get(ownedCard.card_id) ?? [];
    current.push(ownedCard);
    ownedByCardId.set(ownedCard.card_id, current);
  }

  return cards.map((card) => {
    const owned = ownedByCardId.get(card.id) ?? [];
    return { ...card, ownedCount: owned.length, ownedCards: owned };
  });
}
