import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parsePlayerCardCsv } from './cards';

test('cards service sends admin player card upserts and deletes through manage_cards', () => {
  const source = readFileSync('src/services/cards.ts', 'utf8');

  assert.match(source, /export type AdminPlayerCardInput/);
  assert.match(source, /export async function upsertPlayerCards\(cards: AdminPlayerCardInput\[\]\)/);
  assert.match(source, /body: \{ action: 'upsertPlayerCards', cards \}/);
  assert.match(source, /export async function deletePlayerCard\(id: string\)/);
  assert.match(source, /body: \{ action: 'deletePlayerCard', id \}/);
  assert.match(source, /getFunctionErrorMessage\(error\)/);
});

test('player card CSV parser maps Card_list rows into admin card inputs', () => {
  const csv = [
    'Name,Position,Alternate Positions,TEAM,LEAGUE,NATION/REGION,Skill Moves,STRONG FOOT / WEAK FOOT,Height,Weight,Work Rate (ATT) / Work Rate (DEF),Added on,Image URL',
    'Neymar Jr,LW,"CAM,ST",Brazil,International,Brazil,(5) ★★★★★,RIGHT / (5) ★★★★★,"5\'9"" (175 cm)",68 kg,High/Medium,7/3/2026,https://s6.imgcdn.dev/YqwFCS.png',
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
    rarity: 'Rare',
  }]);
});
