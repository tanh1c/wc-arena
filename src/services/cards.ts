import { supabase } from '../lib/supabaseClient';
import type { CardRarity, PackType } from '../config/cardPacks';
import { getFunctionErrorMessage } from './functionErrors';

export function getPlayerCardDisplayImageUrl(card: { image_url: string; gif_url?: string | null }, useGif = false) {
  return useGif && card.gif_url ? card.gif_url : card.image_url;
}

export type CardSourceType = PackType | 'upgrade' | 'forge';

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
  gif_url: string | null;
  rarity: CardRarity;
};

export type AdminPlayerCard = PlayerCard & {
  drop_weight: number;
};

export type OwnedPlayerCard = {
  id: string;
  user_id: string;
  card_id: string;
  source_pack_type: CardSourceType;
  opened_at: string;
  is_gif_upgrade: boolean;
  player_cards: PlayerCard;
};

export type CatalogCardWithOwnedCount = PlayerCard & {
  ownedCount: number;
  ownedCards: OwnedPlayerCard[];
  baseOwnedCount: number;
  gifOwnedCount: number;
  hasGifUpgrade: boolean;
  gifOwnedCards: OwnedPlayerCard[];
};

export type ShowcaseCard = {
  user_id: string;
  slot_number: number;
  user_player_card_id: string;
  updated_at: string;
  user_player_cards: OwnedPlayerCard;
};

export type IconChasePityState = {
  iconMissCount: number;
  threshold: number;
  packsUntilGuaranteed: number;
  nextGuaranteed: boolean;
};

export type OpenCardPackResult = {
  cards: Array<OwnedPlayerCard & { duplicate: boolean }>;
  coins: number;
  openedOnUtc: string;
  iconChasePity?: IconChasePityState;
};

export type ForgePlayerCardResult = {
  card: OwnedPlayerCard & { duplicate: boolean };
  coins: number;
};

export type AdminPlayerCardInput = {
  id?: string;
  name: string;
  position: string;
  alternate_positions?: string | null;
  team: string;
  league: string;
  nation_region: string;
  skill_moves?: string | null;
  footedness?: string | null;
  height?: string | null;
  weight?: string | null;
  work_rate_att?: string | null;
  work_rate_def?: string | null;
  added_on?: string | null;
  image_url: string;
  gif_url?: string | null;
  rarity: CardRarity;
  drop_weight?: number | string;
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"') {
      if (quoted && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeCsvDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return emptyToNull(trimmed);
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parsePlayerCardCsv(csv: string, rarity: CardRarity): AdminPlayerCardInput[] {
  const [headers, ...rows] = parseCsvRows(csv);
  if (!headers || rows.length === 0) return [];

  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const read = (row: string[], header: string) => row[headerIndex.get(header) ?? -1]?.trim() ?? '';

  return rows.map((row) => {
    const [workRateAtt, workRateDef] = read(row, 'Work Rate (ATT) / Work Rate (DEF)').split('/').map((value) => value.trim());

    return {
      name: read(row, 'Name'),
      position: read(row, 'Position'),
      alternate_positions: emptyToNull(read(row, 'Alternate Positions')),
      team: read(row, 'TEAM'),
      league: read(row, 'LEAGUE'),
      nation_region: read(row, 'NATION/REGION'),
      skill_moves: emptyToNull(read(row, 'Skill Moves')),
      footedness: emptyToNull(read(row, 'STRONG FOOT / WEAK FOOT')),
      height: emptyToNull(read(row, 'Height')),
      weight: emptyToNull(read(row, 'Weight')),
      work_rate_att: emptyToNull(workRateAtt ?? ''),
      work_rate_def: emptyToNull(workRateDef ?? ''),
      added_on: normalizeCsvDate(read(row, 'Added on')),
      image_url: read(row, 'PNG URL'),
      gif_url: emptyToNull(read(row, 'GIF URL')),
      rarity,
      drop_weight: 1,
    };
  });
}

export function playerCardToAdminInput(card: PlayerCard | AdminPlayerCard): AdminPlayerCardInput {
  return {
    id: card.id,
    name: card.name,
    position: card.position,
    alternate_positions: card.alternate_positions,
    team: card.team,
    league: card.league,
    nation_region: card.nation_region,
    skill_moves: card.skill_moves,
    footedness: card.footedness,
    height: card.height,
    weight: card.weight,
    work_rate_att: card.work_rate_att,
    work_rate_def: card.work_rate_def,
    added_on: card.added_on,
    image_url: card.image_url,
    gif_url: card.gif_url,
    rarity: card.rarity,
    drop_weight: 'drop_weight' in card ? card.drop_weight : 1,
  };
}

export async function listAdminPlayerCards() {
  const { data, error } = await supabase.functions.invoke<{ cards: AdminPlayerCard[] }>('manage_cards', {
    body: { action: 'listAdminPlayerCards' },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data.cards;
}

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

export async function getIconChasePityState() {
  const { data, error } = await supabase.functions.invoke<{ iconChasePity: IconChasePityState }>('manage_cards', {
    body: { action: 'getIconChasePityState' },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data.iconChasePity;
}

export async function getCurrentUserDailyPackOpenedToday() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return false;

  const { data, error } = await supabase
    .from('card_pack_openings')
    .select('id')
    .eq('user_id', user.id)
    .eq('pack_type', 'daily')
    .eq('opened_on_utc', new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
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

export async function upgradePlayerCardToGif(cardId: string) {
  const { data, error } = await supabase.functions.invoke<{ card: OwnedPlayerCard }>('manage_cards', {
    body: { action: 'upgradeCardToGif', cardId },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data.card;
}

export async function forgePlayerCard(rarity: CardRarity, userPlayerCardIds: string[]) {
  const { data, error } = await supabase.functions.invoke<ForgePlayerCardResult>('manage_cards', {
    body: { action: 'forgeCard', rarity, userPlayerCardIds },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data as ForgePlayerCardResult;
}

export async function upsertPlayerCards(cards: AdminPlayerCardInput[]) {
  const { data, error } = await supabase.functions.invoke<{ cards: AdminPlayerCard[] }>('manage_cards', {
    body: { action: 'upsertPlayerCards', cards },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data.cards;
}

export async function deletePlayerCard(id: string) {
  const { data, error } = await supabase.functions.invoke<{ id: string }>('manage_cards', {
    body: { action: 'deletePlayerCard', id },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  return data.id;
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
    const gifOwnedCards = owned.filter((ownedCard) => ownedCard.is_gif_upgrade);
    return {
      ...card,
      ownedCount: owned.length,
      ownedCards: owned,
      baseOwnedCount: owned.length - gifOwnedCards.length,
      gifOwnedCount: gifOwnedCards.length,
      hasGifUpgrade: gifOwnedCards.length > 0,
      gifOwnedCards,
    };
  });
}
