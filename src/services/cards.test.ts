import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getPlayerCardDisplayImageUrl, groupCatalogWithOwnership, parsePlayerCardCsv } from './cards';

test('cards service sends admin player card upserts, deletes, admin listings, and user GIF upgrades through manage_cards', () => {
  const source = readFileSync('src/services/cards.ts', 'utf8');

  assert.match(source, /export type AdminPlayerCard = PlayerCard & \{\s*drop_weight: number;\s*\}/);
  assert.match(source, /export type AdminPlayerCardInput/);
  assert.match(source, /drop_weight\?: number \| string/);
  assert.match(source, /export async function listAdminPlayerCards\(\)/);
  assert.match(source, /body: \{ action: 'listAdminPlayerCards' \}/);
  assert.match(source, /export async function upsertPlayerCards\(cards: AdminPlayerCardInput\[\]\)/);
  assert.match(source, /invoke<\{ cards: AdminPlayerCard\[\] \}>\('manage_cards'/);
  assert.match(source, /body: \{ action: 'upsertPlayerCards', cards \}/);
  assert.match(source, /export async function deletePlayerCard\(id: string\)/);
  assert.match(source, /body: \{ action: 'deletePlayerCard', id \}/);
  assert.match(source, /export type IconChasePityState/);
  assert.match(source, /iconChasePity\?: IconChasePityState/);
  assert.match(source, /export async function getIconChasePityState\(\)/);
  assert.match(source, /body: \{ action: 'getIconChasePityState' \}/);
  assert.match(source, /export async function upgradePlayerCardToGif\(cardId: string\)/);
  assert.match(source, /body: \{ action: 'upgradeCardToGif', cardId \}/);
  assert.match(source, /export type CardSourceType = PackType \| 'upgrade' \| 'forge'/);
  assert.match(source, /export type ForgePlayerCardResult/);
  assert.match(source, /export async function forgePlayerCard\(rarity: CardRarity, userPlayerCardIds: string\[\]\)/);
  assert.match(source, /body: \{ action: 'forgeCard', rarity, userPlayerCardIds \}/);
  assert.doesNotMatch(source, /body: \{ action: 'forgeCard', cardId \}/);
  assert.match(source, /getFunctionErrorMessage\(error\)/);
});

test('player card display image only uses gif_url after GIF unlock', () => {
  assert.equal(getPlayerCardDisplayImageUrl({ image_url: 'card.png', gif_url: 'card.gif' }, false), 'card.png');
  assert.equal(getPlayerCardDisplayImageUrl({ image_url: 'card.png', gif_url: 'card.gif' }, true), 'card.gif');
  assert.equal(getPlayerCardDisplayImageUrl({ image_url: 'card.png', gif_url: null }, true), 'card.png');
});

test('catalog ownership grouping tracks base copies and GIF upgrades separately', () => {
  const card = {
    id: 'card-1',
    name: 'Neymar Jr',
    position: 'LW',
    alternate_positions: null,
    team: 'Brazil',
    league: 'International',
    nation_region: 'Brazil',
    skill_moves: null,
    footedness: null,
    height: null,
    weight: null,
    work_rate_att: null,
    work_rate_def: null,
    added_on: null,
    image_url: 'card.png',
    gif_url: 'card.gif',
    rarity: 'Icon' as const,
  };
  const ownedCards = Array.from({ length: 6 }, (_, index) => ({
    id: `owned-${index}`,
    user_id: 'user-1',
    card_id: 'card-1',
    source_pack_type: index === 5 ? 'upgrade' as const : 'daily' as const,
    opened_at: `2026-07-05T00:00:0${index}Z`,
    is_gif_upgrade: index === 5,
    player_cards: card,
  }));

  assert.deepEqual(groupCatalogWithOwnership([card], ownedCards), [{
    ...card,
    ownedCount: 6,
    ownedCards,
    baseOwnedCount: 5,
    gifOwnedCount: 1,
    hasGifUpgrade: true,
    gifOwnedCards: [ownedCards[5]],
  }]);
});

test('playerCardToAdminInput carries admin drop weights', () => {
  const source = readFileSync('src/services/cards.ts', 'utf8');

  assert.match(source, /drop_weight: 'drop_weight' in card \? card\.drop_weight : 1/);
});

test('player card CSV parser maps Card_list rows into admin card inputs', () => {
  const csv = [
    'Name,Position,Alternate Positions,TEAM,LEAGUE,NATION/REGION,Skill Moves,STRONG FOOT / WEAK FOOT,Height,Weight,Work Rate (ATT) / Work Rate (DEF),Added on,PNG URL,GIF URL',
    'Neymar Jr,LW,"CAM,ST",Brazil,International,Brazil,(5) ★★★★★,RIGHT / (5) ★★★★★,"5\'9"" (175 cm)",68 kg,High/Medium,7/3/2026,https://s6.imgcdn.dev/YqwFCS.png,https://s6.imgcdn.dev/YqwFCS.gif',
  ].join('\n');

  assert.deepEqual(parsePlayerCardCsv(csv, 'Rare'), [{
    name: 'Neymar Jr',
    position: 'LW',
    alternate_positions: 'CAM,ST',
    team: 'Brazil',
    league: 'International',
    nation_region: 'Brazil',
    skill_moves: '(5) ★★★★★',
    footedness: 'RIGHT / (5) ★★★★★',
    height: '5\'9" (175 cm)',
    weight: '68 kg',
    work_rate_att: 'High',
    work_rate_def: 'Medium',
    added_on: '2026-07-03',
    image_url: 'https://s6.imgcdn.dev/YqwFCS.png',
    gif_url: 'https://s6.imgcdn.dev/YqwFCS.gif',
    rarity: 'Rare',
    drop_weight: 1,
  }]);
});
