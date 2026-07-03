# Gacha Card Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal football player card gacha system with daily and Coins-paid packs, duplicate collection rows, and a three-card profile showcase.

**Architecture:** Store the card catalog and owned card instances in Supabase, enforce pack opening and showcase ownership server-side in one Edge Function, and keep the React UI read-heavy with small service wrappers. The `/cards` page uses the existing app shell and Split Arena layout: pack actions/showcase on the left, collection progress/filter/grid on the right.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Postgres/RLS, Supabase Edge Functions on Deno, `node:test` via `npm run test:frontend`.

---

## File structure

- Create: `src/config/cardPacks.ts` — small editable daily/premium pack config and pure weighted rarity helpers.
- Create: `src/config/cardPacks.test.ts` — pure tests for pack config validity and rarity selection skipping unavailable rarities.
- Create: `src/services/cards.ts` — frontend reads for catalog/owned/showcase data and Edge Function invocations.
- Create: `src/pages/Cards.tsx` — `/cards` Split Arena page with pack opening, showcase controls, filters, and album grid.
- Create: `src/pages/CardsSource.test.ts` — source regression for route/nav/page copy.
- Create: `src/pages/ProfileCardShowcase.test.ts` — source regression for profile showcase wiring.
- Modify: `src/App.tsx` — lazy-load and route `/cards`.
- Modify: `src/config/navigation.ts` — add Cards to the Play navigation group only.
- Modify: `src/i18n/resources.ts` — add English/Vietnamese card UI labels.
- Modify: `src/pages/Profile.tsx` — render compact three-card showcase section linked to `/cards`.
- Create: `supabase/migrations/20260703000000_gacha_card_collection.sql` — create catalog, owned cards, openings, showcase tables, RLS, grants, and minimal seed rows.
- Create: `supabase/functions/manage_cards/index.ts` — authenticated actions for `openCardPack` and `setShowcaseCard`.
- Modify: `src/types/supabase.ts` — update generated Supabase types after applying the migration, or add the exact new table/function-facing shapes if generation is unavailable locally.

## Task 1: Add source tests for route, nav, page copy, and profile showcase

**Files:**
- Create: `src/pages/CardsSource.test.ts`
- Create: `src/pages/ProfileCardShowcase.test.ts`

- [ ] **Step 1: Write failing route/nav/page source test**

Create `src/pages/CardsSource.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('cards page is routed from Play navigation and includes MVP card collection copy', () => {
  const appSource = readFileSync('src/App.tsx', 'utf8');
  const navigationSource = readFileSync('src/config/navigation.ts', 'utf8');
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/Cards'\)\)/);
  assert.match(appSource, /path="\/cards"/);

  assert.match(navigationSource, /to: '\/cards'/);
  assert.match(navigationSource, /nav\.items\.cards/);
  assert.doesNotMatch(navigationSource, /headerNavigation[\s\S]*to: '\/cards'/);

  assert.match(cardsSource, /appPages\.cards\.dailyPack/);
  assert.match(cardsSource, /appPages\.cards\.premiumPack/);
  assert.match(cardsSource, /appPages\.cards\.collection/);
  assert.match(cardsSource, /appPages\.cards\.showcase/);
  assert.match(cardsSource, /ui\.coinsShort/);

  assert.match(resourcesSource, /cards: 'Cards'/);
  assert.match(resourcesSource, /cardsShort: 'Cards'/);
  assert.match(resourcesSource, /dailyPack: 'Daily Pack'/);
  assert.match(resourcesSource, /premiumPack: 'Premium Pack'/);
});
```

- [ ] **Step 2: Write failing profile showcase source test**

Create `src/pages/ProfileCardShowcase.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile renders compact card showcase linked to the cards page', () => {
  const profileSource = readFileSync('src/pages/Profile.tsx', 'utf8');
  const cardsServiceSource = readFileSync('src/services/cards.ts', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(profileSource, /listCurrentUserShowcase/);
  assert.match(profileSource, /appPages\.cards\.profileShowcase/);
  assert.match(profileSource, /to="\/cards"/);
  assert.match(profileSource, /appPages\.cards\.pickShowcaseCards/);

  assert.match(cardsServiceSource, /listCurrentUserShowcase/);
  assert.match(cardsServiceSource, /profile_card_showcases/);
  assert.match(resourcesSource, /profileShowcase: 'Card Showcase'/);
  assert.match(resourcesSource, /pickShowcaseCards: 'Pick showcase cards'/);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test:frontend -- src/pages/CardsSource.test.ts src/pages/ProfileCardShowcase.test.ts
```

Expected: FAIL because `src/pages/Cards.tsx` and `src/services/cards.ts` do not exist, and `/cards` route/nav/profile showcase are not wired yet.

## Task 2: Add pure pack config and weighted rarity tests

**Files:**
- Create: `src/config/cardPacks.test.ts`
- Create: `src/config/cardPacks.ts`

- [ ] **Step 1: Write failing pack config tests**

Create `src/config/cardPacks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:frontend -- src/config/cardPacks.test.ts
```

Expected: FAIL because `src/config/cardPacks.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure config/helper**

Create `src/config/cardPacks.ts`:

```ts
export type PackType = 'daily' | 'premium';
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
  premium: {
    cardCount: 3,
    priceCoins: 250,
    oncePerUtcDay: false,
    rarityWeights: {
      Common: 55,
      Rare: 30,
      Epic: 12,
      Icon: 3,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:frontend -- src/config/cardPacks.test.ts
```

Expected: PASS.

## Task 3: Add database schema, RLS, and minimal seed data

**Files:**
- Create: `supabase/migrations/20260703000000_gacha_card_collection.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260703000000_gacha_card_collection.sql`:

```sql
create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  alternate_positions text,
  team text not null,
  league text not null,
  nation_region text not null,
  skill_moves text,
  footedness text,
  height text,
  weight text,
  work_rate_att text,
  work_rate_def text,
  added_on date,
  image_url text not null,
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic', 'Icon')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_cards_rarity_idx on public.player_cards (rarity);
create index if not exists player_cards_position_idx on public.player_cards (position);
create index if not exists player_cards_team_idx on public.player_cards (team);

create table if not exists public.user_player_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.player_cards(id) on delete cascade,
  source_pack_type text not null check (source_pack_type in ('daily', 'premium')),
  opened_at timestamptz not null default now()
);

create index if not exists user_player_cards_user_id_idx on public.user_player_cards (user_id);
create index if not exists user_player_cards_card_id_idx on public.user_player_cards (card_id);

create table if not exists public.card_pack_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_type text not null check (pack_type in ('daily', 'premium')),
  coins_spent integer not null default 0 check (coins_spent >= 0),
  cards_awarded integer not null check (cards_awarded > 0),
  opened_on_utc date not null,
  opened_at timestamptz not null default now()
);

create index if not exists card_pack_openings_user_id_idx on public.card_pack_openings (user_id);
create unique index if not exists card_pack_openings_daily_once_idx
  on public.card_pack_openings (user_id, pack_type, opened_on_utc)
  where pack_type = 'daily';

create table if not exists public.profile_card_showcases (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 3),
  user_player_card_id uuid not null references public.user_player_cards(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_number)
);

create index if not exists profile_card_showcases_user_player_card_id_idx
  on public.profile_card_showcases (user_player_card_id);

alter table public.player_cards enable row level security;
alter table public.user_player_cards enable row level security;
alter table public.card_pack_openings enable row level security;
alter table public.profile_card_showcases enable row level security;

drop policy if exists player_cards_read_all on public.player_cards;
create policy player_cards_read_all on public.player_cards
  for select to anon, authenticated using (true);

drop policy if exists user_player_cards_read_own on public.user_player_cards;
create policy user_player_cards_read_own on public.user_player_cards
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists card_pack_openings_read_own on public.card_pack_openings;
create policy card_pack_openings_read_own on public.card_pack_openings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists profile_card_showcases_read_all on public.profile_card_showcases;
create policy profile_card_showcases_read_all on public.profile_card_showcases
  for select to anon, authenticated using (true);

grant select on public.player_cards to anon, authenticated;
grant select on public.user_player_cards to authenticated;
grant select on public.card_pack_openings to authenticated;
grant select on public.profile_card_showcases to anon, authenticated;

insert into public.player_cards (
  name,
  position,
  alternate_positions,
  team,
  league,
  nation_region,
  skill_moves,
  footedness,
  height,
  weight,
  work_rate_att,
  work_rate_def,
  added_on,
  image_url,
  rarity
) values
  (
    'David Beckham',
    'CM',
    'RM',
    'Icons',
    'Icons',
    'England',
    '(4) ★★★★',
    'RIGHT / (4) ★★★★',
    '6''0" (182 cm)',
    '74 kg',
    'High',
    'High',
    date '2026-07-03',
    'https://www.fut.gg/players/250-david-beckham/',
    'Icon'
  ),
  (
    'Sample Striker',
    'ST',
    'CF',
    'We Know Ball FC',
    'World Cup',
    'Brazil',
    '(3) ★★★',
    'RIGHT / (3) ★★★',
    '5''11" (180 cm)',
    '78 kg',
    'High',
    'Medium',
    date '2026-07-03',
    'https://example.com/cards/sample-striker.png',
    'Rare'
  ),
  (
    'Sample Defender',
    'CB',
    'RB',
    'We Know Ball FC',
    'World Cup',
    'France',
    '(2) ★★',
    'LEFT / (3) ★★★',
    '6''2" (188 cm)',
    '84 kg',
    'Medium',
    'High',
    date '2026-07-03',
    'https://example.com/cards/sample-defender.png',
    'Common'
  )
on conflict do nothing;
```

- [ ] **Step 2: Verify migration SQL is parseable enough for local checks**

Run:

```bash
npm run test:frontend -- src/config/cardPacks.test.ts
```

Expected: PASS. This keeps a runnable check after adding SQL without requiring a live Supabase database.

- [ ] **Step 3: Apply migration only when a Supabase environment is intentionally available**

Run only when the user is ready to apply DB changes:

```bash
supabase db push --include-seed
```

Expected: migration applies cleanly and creates the four new tables. If no Supabase local/linked project is available, do not fake success; continue with code and report that DB application remains manual.

## Task 4: Add card service types and frontend data functions

**Files:**
- Create: `src/services/cards.ts`
- Modify: `src/types/supabase.ts`

- [ ] **Step 1: Create service module with typed functions**

Create `src/services/cards.ts`:

```ts
import { supabase } from '../lib/supabaseClient';
import type { CardRarity, PackType } from '../config/cardPacks';

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

  if (error) throw error;
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
```

- [ ] **Step 2: Update Supabase types**

If linked Supabase generation is available, run:

```bash
npm run supabase:types
```

Expected: `src/types/supabase.ts` now includes `player_cards`, `user_player_cards`, `card_pack_openings`, and `profile_card_showcases` table entries.

If generation is unavailable, manually add these tables to `Database['public']['Tables']` in `src/types/supabase.ts` using the SQL columns from Task 3. Keep row/insert/update keys aligned with existing generated style and do not touch unrelated generated entries.

- [ ] **Step 3: Run source tests to verify service references exist**

Run:

```bash
npm run test:frontend -- src/pages/ProfileCardShowcase.test.ts
```

Expected: still FAIL until Profile renders showcase, but the failure must no longer be caused by missing `src/services/cards.ts`.

## Task 5: Add server-side card Edge Function

**Files:**
- Create: `supabase/functions/manage_cards/index.ts`

- [ ] **Step 1: Create Edge Function**

Create `supabase/functions/manage_cards/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CARD_PACKS, getUtcDay, pickWeightedRarity, type CardRarity, type PackType } from '../../../src/config/cardPacks.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { requireAuthenticatedUser } from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/http.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    if (!rateLimit.allowed) return jsonResponse({ error: 'Too many card actions. Try again soon.' }, 429, corsHeaders);

    const body = await req.json() as Body;

    if (body.action === 'openCardPack') {
      return jsonResponse(await openCardPack(supabase, user.id, body.packType), 200, corsHeaders);
    }

    if (body.action === 'setShowcaseCard') {
      return jsonResponse(await setShowcaseCard(supabase, user.id, body.slotNumber, body.userPlayerCardId), 200, corsHeaders);
    }

    return jsonResponse({ error: 'Unknown card action.' }, 400, corsHeaders);
  } catch (error) {
    console.error('manage_cards failed', error);
    const message = error instanceof Error ? error.message : 'Card action failed.';
    return jsonResponse({ error: message }, 400, corsHeaders);
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
```

- [ ] **Step 2: Run pure tests after adding the Edge Function import dependency**

Run:

```bash
npm run test:frontend -- src/config/cardPacks.test.ts
```

Expected: PASS.

- [ ] **Step 3: Manually verify Edge Function only when Supabase local/linked env is available**

After applying the migration and deploying/serving the function, verify:

```bash
supabase functions serve manage_cards
```

Expected manual checks:
- daily pack returns one card and latest Coins.
- second daily request on same UTC date returns `Daily pack already opened today.`
- premium pack subtracts `CARD_PACKS.premium.priceCoins` from `point_wallets.balance`.
- `setShowcaseCard` rejects a `user_player_cards.id` owned by another user.

## Task 6: Implement `/cards` Split Arena page

**Files:**
- Create: `src/pages/Cards.tsx`

- [ ] **Step 1: Create the page with minimal working UI**

Create `src/pages/Cards.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Gift, Search, Star } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import PointsCoin from '../components/ui/PointsCoin';
import { CARD_PACKS, type CardRarity, type PackType } from '../config/cardPacks';
import type { ThemeControls } from '../App';
import {
  groupCatalogWithOwnership,
  listCurrentUserOwnedCards,
  listCurrentUserShowcase,
  listPlayerCards,
  openCardPack,
  setShowcaseCard,
  type CatalogCardWithOwnedCount,
  type OwnedPlayerCard,
  type ShowcaseCard,
} from '../services/cards';
import { getErrorMessage } from '../services/serviceTypes';

type CardsProps = {
  themeControls: ThemeControls;
};

const rarities: Array<'all' | CardRarity> = ['all', 'Common', 'Rare', 'Epic', 'Icon'];

export default function Cards({ themeControls }: CardsProps) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogCardWithOwnedCount[]>([]);
  const [ownedCards, setOwnedCards] = useState<OwnedPlayerCard[]>([]);
  const [showcase, setShowcase] = useState<ShowcaseCard[]>([]);
  const [revealedCards, setRevealedCards] = useState<Array<OwnedPlayerCard & { duplicate: boolean }>>([]);
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | CardRarity>('all');
  const [loading, setLoading] = useState(true);
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [error, setError] = useState('');

  const loadCards = async () => {
    setLoading(true);
    setError('');
    try {
      const [cards, owned, currentShowcase] = await Promise.all([
        listPlayerCards(),
        listCurrentUserOwnedCards(),
        listCurrentUserShowcase(),
      ]);
      setOwnedCards(owned);
      setCatalog(groupCatalogWithOwnership(cards, owned));
      setShowcase(currentShowcase);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCards();
  }, []);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((card) => {
      const matchesRarity = rarity === 'all' || card.rarity === rarity;
      const haystack = `${card.name} ${card.position} ${card.team} ${card.nation_region}`.toLowerCase();
      return matchesRarity && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [catalog, query, rarity]);

  const uniqueOwned = catalog.filter((card) => card.ownedCount > 0).length;

  const handleOpenPack = async (packType: PackType) => {
    setOpeningPack(packType);
    setError('');
    try {
      const result = await openCardPack(packType);
      setRevealedCards(result.cards);
      window.dispatchEvent(new CustomEvent('wc26:profile-coins-changed', { detail: { coins: result.coins } }));
      await loadCards();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setOpeningPack(null);
    }
  };

  const handleSetShowcase = async (slotNumber: number, ownedCardId: string) => {
    setError('');
    try {
      setShowcase(await setShowcaseCard(slotNumber, ownedCardId));
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    }
  };

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <section className="bg-card border-4 border-main p-4 lg:p-6 shadow-[8px_8px_0_var(--color-shadow)]">
          <p className="text-xs font-black uppercase text-muted-foreground">{t('appPages.cards.kicker')}</p>
          <h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main">{t('appPages.cards.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm font-bold text-muted-foreground">{t('appPages.cards.subtitle')}</p>
        </section>

        {error && <div className="border-4 border-main bg-c2 p-3 font-black uppercase text-sm text-main shadow-[4px_4px_0_var(--color-shadow)]">{error}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 lg:gap-6 min-h-0">
          <aside className="space-y-4">
            <PackPanel
              title={t('appPages.cards.dailyPack')}
              description={t('appPages.cards.dailyPackDescription')}
              packType="daily"
              openingPack={openingPack}
              onOpen={handleOpenPack}
            />
            <PackPanel
              title={t('appPages.cards.premiumPack')}
              description={t('appPages.cards.premiumPackDescription', {
                count: CARD_PACKS.premium.cardCount,
                coins: CARD_PACKS.premium.priceCoins,
              })}
              packType="premium"
              openingPack={openingPack}
              onOpen={handleOpenPack}
            />

            <section className="bg-card border-4 border-main p-4 shadow-[6px_6px_0_var(--color-shadow)]">
              <h2 className="text-xl font-black uppercase tracking-tight text-main">{t('appPages.cards.showcase')}</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((slot) => {
                  const card = showcase.find((item) => item.slot_number === slot)?.user_player_cards.player_cards;
                  return (
                    <div key={slot} className="min-h-28 border-2 border-main bg-muted p-2 text-center text-[10px] font-black uppercase text-main">
                      {card ? <CardImage card={card} /> : <span>{t('appPages.cards.emptySlot', { slot })}</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          <main className="bg-card border-4 border-main p-4 lg:p-6 shadow-[8px_8px_0_var(--color-shadow)] min-h-0">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b-4 border-main pb-4">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-main">{t('appPages.cards.collection')}</h2>
                <p className="text-sm font-bold text-muted-foreground">{t('appPages.cards.collectionProgress', { owned: uniqueOwned, total: catalog.length })}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="flex items-center gap-2 border-2 border-main bg-background px-3 py-2 font-bold text-sm">
                  <Search size={16} />
                  <input className="bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('appPages.cards.searchPlaceholder')} />
                </label>
                <select className="border-2 border-main bg-background px-3 py-2 font-black uppercase text-sm" value={rarity} onChange={(event) => setRarity(event.target.value as 'all' | CardRarity)}>
                  {rarities.map((nextRarity) => <option key={nextRarity} value={nextRarity}>{nextRarity === 'all' ? t('appPages.cards.allRarities') : nextRarity}</option>)}
                </select>
              </div>
            </div>

            {revealedCards.length > 0 && (
              <section className="my-4 border-4 border-main bg-c3 p-4 shadow-[4px_4px_0_var(--color-shadow)]">
                <h3 className="text-lg font-black uppercase text-main">{t('appPages.cards.revealedCards')}</h3>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {revealedCards.map((ownedCard) => (
                    <CardTile key={ownedCard.id} card={ownedCard.player_cards} ownedCount={1} badge={ownedCard.duplicate ? t('appPages.cards.duplicate') : t('appPages.cards.newCard')} />
                  ))}
                </div>
              </section>
            )}

            {loading ? (
              <p className="p-6 text-center font-black uppercase text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
                {filteredCatalog.map((card) => (
                  <CardTile key={card.id} card={card} ownedCount={card.ownedCount} onSetShowcase={card.ownedCards[0] ? (slot) => handleSetShowcase(slot, card.ownedCards[0].id) : undefined} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function PackPanel({ title, description, packType, openingPack, onOpen }: {
  title: string;
  description: string;
  packType: PackType;
  openingPack: PackType | null;
  onOpen: (packType: PackType) => void;
}) {
  const { t } = useTranslation();
  const pack = CARD_PACKS[packType];
  return (
    <section className="bg-card border-4 border-main p-4 shadow-[6px_6px_0_var(--color-shadow)]">
      <div className="flex items-center gap-2 text-main">
        <Gift size={22} />
        <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
      </div>
      <p className="mt-2 text-sm font-bold text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center gap-2 text-sm font-black uppercase text-main">
        <PointsCoin size="sm" />
        {pack.priceCoins.toLocaleString()} {t('ui.coinsShort')} · {pack.cardCount} {t('appPages.cards.cards')}
      </div>
      <button type="button" className="mt-4 w-full border-4 border-main bg-c1 px-4 py-3 font-black uppercase text-main shadow-[4px_4px_0_var(--color-shadow)] disabled:opacity-60" disabled={openingPack !== null} onClick={() => onOpen(packType)}>
        {openingPack === packType ? t('appPages.cards.opening') : t('appPages.cards.openPack')}
      </button>
    </section>
  );
}

function CardTile({ card, ownedCount, badge, onSetShowcase }: {
  card: { name: string; position: string; team: string; nation_region: string; image_url: string; rarity: string };
  ownedCount: number;
  badge?: string;
  onSetShowcase?: (slot: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="border-4 border-main bg-background p-2 shadow-[4px_4px_0_var(--color-shadow)]">
      <CardImage card={card} />
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-black uppercase text-sm text-main leading-tight">{card.name}</h3>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">{card.position} · {card.team}</p>
        </div>
        <span className="border-2 border-main bg-c1 px-2 py-1 text-xs font-black uppercase text-main">x{ownedCount}</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-black uppercase text-main"><Star size={12} />{card.rarity}</p>
      {badge && <p className="mt-2 border-2 border-main bg-c2 px-2 py-1 text-center text-[11px] font-black uppercase text-main">{badge}</p>}
      {onSetShowcase && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {[1, 2, 3].map((slot) => (
            <button key={slot} type="button" className="border-2 border-main bg-card px-1 py-1 text-[10px] font-black uppercase text-main" onClick={() => onSetShowcase(slot)}>
              {t('appPages.cards.slot', { slot })}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function CardImage({ card }: { card: { name: string; image_url: string } }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="flex aspect-[3/4] items-center justify-center border-2 border-main bg-muted p-2 text-center text-xs font-black uppercase text-main">{card.name}</div>;
  }

  return <img src={card.image_url} alt={card.name} className="aspect-[3/4] w-full object-cover border-2 border-main bg-muted" onError={() => setFailed(true)} />;
}
```

- [ ] **Step 2: Run card page source test**

Run:

```bash
npm run test:frontend -- src/pages/CardsSource.test.ts
```

Expected: still FAIL until App route/nav/i18n are added, but it should no longer fail because `src/pages/Cards.tsx` is missing.

## Task 7: Wire route, navigation, and translations

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/config/navigation.ts`
- Modify: `src/i18n/resources.ts`

- [ ] **Step 1: Add lazy route**

In `src/App.tsx`, add the lazy import near the other page imports:

```ts
const Cards = lazy(() => import('./pages/Cards'));
```

Add the route inside the authenticated app routes:

```tsx
<Route path="/cards" element={<Cards themeControls={themeControls} />} />
```

- [ ] **Step 2: Add Play navigation entry**

In `src/config/navigation.ts`, import an icon if needed:

```ts
import { Award, Bot, Gift, Medal, ScrollText, Trophy, Users } from 'lucide-react';
```

Add Cards under the Play group `items`, not in `headerNavigation`:

```ts
{ labelKey: 'nav.items.cards', shortLabelKey: 'nav.items.cardsShort', to: '/cards', icon: Gift },
```

- [ ] **Step 3: Add English and Vietnamese i18n keys**

In `src/i18n/resources.ts`, add to both locales under `nav.items`:

```ts
cards: 'Cards',
cardsShort: 'Cards',
```

For Vietnamese:

```ts
cards: 'Thẻ cầu thủ',
cardsShort: 'Thẻ',
```

Add under both locales' `appPages`:

```ts
cards: {
  kicker: 'Card Collection',
  title: 'Player Cards',
  subtitle: 'Open daily and premium packs, collect duplicates, and showcase your favorite three cards.',
  dailyPack: 'Daily Pack',
  dailyPackDescription: 'One free card per UTC day.',
  premiumPack: 'Premium Pack',
  premiumPackDescription: '{{count}} cards for {{coins}} Coins.',
  collection: 'Collection',
  collectionProgress: '{{owned}}/{{total}} unique cards collected',
  showcase: 'Showcase',
  profileShowcase: 'Card Showcase',
  pickShowcaseCards: 'Pick showcase cards',
  emptySlot: 'Slot {{slot}}',
  searchPlaceholder: 'Search name, team, nation...',
  allRarities: 'All rarities',
  revealedCards: 'Revealed Cards',
  duplicate: 'Duplicate',
  newCard: 'New',
  openPack: 'Open Pack',
  opening: 'Opening...',
  cards: 'cards',
  slot: 'Slot {{slot}}',
},
```

Vietnamese:

```ts
cards: {
  kicker: 'Bộ sưu tập thẻ',
  title: 'Thẻ cầu thủ',
  subtitle: 'Mở pack hằng ngày và premium, sưu tầm duplicate, rồi trưng bày 3 thẻ yêu thích.',
  dailyPack: 'Daily Pack',
  dailyPackDescription: 'Một thẻ miễn phí mỗi ngày UTC.',
  premiumPack: 'Premium Pack',
  premiumPackDescription: '{{count}} thẻ với {{coins}} Coins.',
  collection: 'Bộ sưu tập',
  collectionProgress: 'Đã sưu tầm {{owned}}/{{total}} thẻ unique',
  showcase: 'Showcase',
  profileShowcase: 'Card Showcase',
  pickShowcaseCards: 'Chọn thẻ showcase',
  emptySlot: 'Slot {{slot}}',
  searchPlaceholder: 'Tìm tên, đội, quốc gia...',
  allRarities: 'Tất cả rarity',
  revealedCards: 'Thẻ vừa mở',
  duplicate: 'Duplicate',
  newCard: 'Mới',
  openPack: 'Mở pack',
  opening: 'Đang mở...',
  cards: 'thẻ',
  slot: 'Slot {{slot}}',
},
```

- [ ] **Step 4: Run route/nav/page source test**

Run:

```bash
npm run test:frontend -- src/pages/CardsSource.test.ts
```

Expected: PASS.

## Task 8: Add compact profile showcase

**Files:**
- Modify: `src/pages/Profile.tsx`

- [ ] **Step 1: Load showcase cards in Profile**

In `src/pages/Profile.tsx`, import:

```ts
import { listCurrentUserShowcase, type ShowcaseCard } from '../services/cards';
```

Add state near existing profile state:

```ts
const [showcaseCards, setShowcaseCards] = useState<ShowcaseCard[]>([]);
```

When there is no authenticated user, reset it:

```ts
setShowcaseCards([]);
```

Add `listCurrentUserShowcase()` to the existing profile load `Promise.all`, and set state from the result:

```ts
setShowcaseCards(nextShowcaseCards);
```

Use a concrete destructuring order matching the existing load, for example:

```ts
Promise.all([
  ensureCurrentProfile(authUser.id, authUser.email, authUser.user_metadata.username),
  getCurrentUserCoinBalance(),
  listCurrentUserPredictions(),
  getTeamMap(),
  listCurrentUserBadges(),
  listCurrentUserLeagueMemberships(),
  listCurrentUserShowcase(),
]).then(([nextProfile, nextCoins, nextPredictions, nextTeams, nextBadges, nextLeagueMemberships, nextShowcaseCards]) => {
  if (!active) return;
  setProfile(nextProfile);
  setCoins(nextCoins ?? 0);
  setPredictions(nextPredictions);
  setTeams(nextTeams);
  setBadges(nextBadges);
  setLeagueMemberships(nextLeagueMemberships);
  setShowcaseCards(nextShowcaseCards);
});
```

- [ ] **Step 2: Render compact showcase section**

Add this section in the profile content near the identity/stat cards:

```tsx
<section className="bg-card border-4 border-main p-4 shadow-[6px_6px_0_var(--color-shadow)]">
  <div className="flex items-center justify-between gap-3 border-b-4 border-main pb-3">
    <h2 className="text-xl font-black uppercase tracking-tight text-main">{t('appPages.cards.profileShowcase')}</h2>
    <Link to="/cards" className="border-2 border-main bg-c1 px-3 py-2 text-xs font-black uppercase text-main shadow-[2px_2px_0_var(--color-shadow)]">
      {t('appPages.cards.pickShowcaseCards')}
    </Link>
  </div>
  <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
    {[1, 2, 3].map((slot) => {
      const showcaseCard = showcaseCards.find((item) => item.slot_number === slot)?.user_player_cards.player_cards;
      return (
        <div key={slot} className="min-h-32 border-2 border-main bg-muted p-2 text-center text-[10px] font-black uppercase text-main">
          {showcaseCard ? (
            <>
              <img src={showcaseCard.image_url} alt={showcaseCard.name} className="aspect-[3/4] w-full object-cover border-2 border-main bg-card" />
              <p className="mt-2 truncate">{showcaseCard.name}</p>
            </>
          ) : (
            <span>{t('appPages.cards.emptySlot', { slot })}</span>
          )}
        </div>
      );
    })}
  </div>
</section>
```

If `Link` is not already imported in `Profile.tsx`, import it from `react-router-dom`:

```ts
import { Link } from 'react-router-dom';
```

- [ ] **Step 3: Run profile showcase source test**

Run:

```bash
npm run test:frontend -- src/pages/ProfileCardShowcase.test.ts
```

Expected: PASS.

## Task 9: Verify frontend compile and all source tests

**Files:**
- Modify only files needed to fix type errors from prior tasks.

- [ ] **Step 1: Run all frontend tests**

Run:

```bash
npm run test:frontend
```

Expected: PASS with all `node:test` tests green.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run lint
```

Expected: PASS with no TypeScript errors. If the generated Supabase table types are not updated, fix `src/types/supabase.ts` or narrow service casts until TypeScript passes.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with Vite production build output and no errors.

## Task 10: Manual feature verification

**Files:**
- No planned source changes unless verification finds a bug.

- [ ] **Step 1: Start frontend dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite serves the app locally.

- [ ] **Step 2: Check `/cards` UI manually in browser**

Open the local `/cards` route and verify:
- Split Arena layout is visible.
- Daily Pack and Premium Pack panels are visible.
- Premium pack shows Coins cost and configured card count.
- Collection progress shows `owned/total` unique cards.
- Search and rarity filter narrow the album grid.
- Image load failure displays the bordered player-name placeholder.

- [ ] **Step 3: Check pack actions against a real Supabase environment**

With migration applied and `manage_cards` deployed/served, verify:
- daily pack inserts one `user_player_cards` row.
- second daily open on same UTC day returns a friendly error.
- premium pack subtracts Coins from `point_wallets.balance`.
- premium result inserts one owned row per awarded card.
- duplicate flags are true only for cards owned before that opening.

- [ ] **Step 4: Check showcase actions**

Verify:
- setting slot 1, 2, or 3 updates `profile_card_showcases`.
- profile page displays selected cards in the compact showcase.
- trying to showcase another user's `user_player_cards.id` is rejected by the Edge Function.

## Final verification

Run before reporting completion:

```bash
npm run test:frontend
npm run lint
npm run build
```

Expected: all pass.

If browser or Supabase manual checks cannot be completed in the current environment, report exactly which checks were not run and why. Do not claim full feature verification without those checks.

## Deliberate MVP skips

skipped: trading, duplicate exchange/crafting, pity timers, admin CSV upload UI, Supabase Storage mirroring, OVR parsing, and economy balancing UI; add when the card economy has real usage data.
