import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEspnTeamKey, reconcileMatchTeamsFromEspn, type ReconciliationTeamRow } from './espnMatchReconciliation.ts';

function team(id: string, name: string, shortName: string): ReconciliationTeamRow {
  return { id, name, short_name: shortName, country_code: shortName };
}

function teamMap(teams: ReconciliationTeamRow[]) {
  return new Map(teams.map((value) => [value.id, value]));
}

test('corrects a swapped wrong round32 away team from ESPN keys', () => {
  const teams = teamMap([
    team('ger', 'Germany', 'GER'),
    team('swe', 'Sweden', 'SWE'),
    team('fra', 'France', 'FRA'),
    team('par', 'Paraguay', 'PAR'),
  ]);

  assert.deepEqual(
    reconcileMatchTeamsFromEspn(
      { home_team_id: 'ger', away_team_id: 'swe' },
      {
        homeKeys: new Set(['germany']),
        awayKeys: new Set(['paraguay']),
      },
      teams,
    ),
    { away_team_id: 'par' },
  );
});

test('does not correct when ESPN team cannot be uniquely resolved', () => {
  const teams = teamMap([team('ger', 'Germany', 'GER')]);

  assert.deepEqual(
    reconcileMatchTeamsFromEspn(
      { home_team_id: 'ger', away_team_id: 'swe' },
      {
        homeKeys: new Set(['germany']),
        awayKeys: new Set(['unknown-team']),
      },
      teams,
    ),
    {},
  );
});

test('normalizes ESPN country spellings consistently', () => {
  assert.equal(normalizeEspnTeamKey('Bosnia-Herzegovina'), 'bosnia-herzegovina');
  assert.equal(normalizeEspnTeamKey("Côte d'Ivoire"), 'cote-d-ivoire');
});
