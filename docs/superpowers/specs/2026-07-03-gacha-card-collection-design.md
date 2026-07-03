# Gacha Card Collection Design

## Goal

Add a minimal football player card gacha system where users can open one free daily pack and spend Coins on premium packs, collect duplicate cards, and showcase three selected cards on their profile.

## Scope

Build the first playable slice only:

- `/cards` page using the Split Arena layout.
- Daily free pack: 1 card per UTC day.
- Premium pack: configurable Coins price, card count, and rarity rates.
- Server-side pack opening through a Supabase Edge Function.
- CSV-seeded player card catalog with direct image URLs and metadata.
- Duplicate cards are stored as separate owned-card rows.
- User-selected 3-card profile showcase.

Do not build trading, duplicate exchange, crafting, pity, admin CSV upload UI, Supabase Storage mirroring, or OVR parsing in this version.

## Player card data

The catalog is seeded from CSV/migration data provided by the owner. Each card has:

- name
- position
- alternate positions
- team
- league
- nation/region
- skill moves
- strong foot / weak foot
- height
- weight
- attacking / defensive work rates
- added date
- direct image URL
- rarity

The app does not store OVR separately because the card image already contains OVR and visual stats.

## Data model

### `player_cards`

Master catalog table. One row per collectible player card.

Important fields:

- `id`
- `name`
- `position`
- `alternate_positions`
- `team`
- `league`
- `nation_region`
- `skill_moves`
- `footedness`
- `height`
- `weight`
- `work_rate_att`
- `work_rate_def`
- `added_on`
- `image_url`
- `rarity`
- timestamps

### `user_player_cards`

Owned card instances. Every pack result inserts one row here. Duplicates are allowed.

Important fields:

- `id`
- `user_id`
- `card_id`
- `source_pack_type`
- `opened_at`

### `card_pack_openings`

Pack opening ledger used for history and daily-pack enforcement.

Important fields:

- `id`
- `user_id`
- `pack_type`
- `coins_spent`
- `cards_awarded`
- `opened_on_utc`
- `opened_at`

Daily free pack uses a unique constraint on `(user_id, pack_type, opened_on_utc)` for `pack_type = 'daily'`.

### `profile_card_showcases`

Three selected showcase slots per user.

Important fields:

- `user_id`
- `slot_number` from 1 to 3
- `user_player_card_id`
- `updated_at`

Showcase points to `user_player_cards.id`, not `player_cards.id`, so users showcase an owned instance.

## Pack config

Pack configuration lives in code, not admin UI:

- `daily`: 1 card, 0 Coins, UTC once-per-day limit.
- `premium`: configurable card count, Coins price, and rarity weights.

The config should be small and easy to edit. Rates are based on the owner-provided `rarity` field.

## Backend flow

### `open_card_pack` Edge Function

Auth required.

Input:

```json
{ "packType": "daily" }
```

or

```json
{ "packType": "premium" }
```

Flow:

1. Resolve authenticated user.
2. Load pack config.
3. For daily pack, enforce one opening per UTC day.
4. For premium pack, read `point_wallets.balance`, require enough Coins, and subtract cost server-side.
5. Select cards server-side using weighted rarity selection.
6. Insert `user_player_cards` rows for awarded cards.
7. Insert `card_pack_openings` ledger row.
8. Return revealed card rows, duplicate flags, and latest Coins balance.

### Showcase update action

Auth required.

Input should identify `slotNumber` and `userPlayerCardId`.

Flow:

1. Confirm the owned card row belongs to the authenticated user.
2. Upsert `profile_card_showcases` for slot 1-3.
3. Return the updated showcase cards.

This can be a separate Edge Function or a second action in the same card function, whichever keeps the implementation smaller.

## UI design

### Navigation

Add `/cards` to app navigation under the Play group. It does not need to be a primary header tab for MVP; appearing in More/mobile navigation is enough.

### `/cards` page: Split Arena

Left panel:

- Daily Pack card with open button and UTC daily status.
- Premium Pack card with cost, card count, and open button.
- Three showcase slots with current selected cards or empty placeholders.

Right panel:

- Collection progress summary, e.g. `12/240` unique cards.
- Filters/search for rarity, position, team/nation/name.
- Album grid grouped by catalog card.
- Owned count per card, e.g. `x3`.
- Card detail modal/drawer with metadata and actions to set showcase slot 1, 2, or 3.

Pack reveal:

- After opening, show the revealed cards.
- Mark a result as duplicate when the user already owned that catalog card before this opening.

### Profile preview

Add a compact Card Showcase section with three selected cards. Empty slots link to `/cards` and prompt the user to pick showcase cards.

## Error handling

- If the daily pack was already opened, show a friendly disabled state and backend error message if forced.
- If Coins are insufficient for premium, do not call it successful; show current Coins and required cost.
- If a card image fails to load, show a bordered placeholder with the player name.
- If a user tries to showcase someone else's owned card, backend rejects it.

## Testing

Add tests before implementation where feasible:

- Navigation/source test confirms `/cards` route/nav entry exists.
- `/cards` source test confirms daily pack, premium pack, Coins, collection, and showcase copy exist.
- Profile source test confirms Card Showcase appears on profile.
- Pure unit tests for pack config validity.
- Pure unit tests for weighted rarity selection to ensure unavailable rarities are skipped.
- Edge Function/manual verification for daily limit, premium Coins deduction, owned card insertions, and showcase ownership checks.

## Deferred work

- Trading cards between users.
- Duplicate exchange, shards, or crafting.
- Pity timer or guaranteed rarity rules.
- Admin CSV upload/import UI.
- Mirroring external images into Supabase Storage.
- Parsing or storing card OVR separately.
