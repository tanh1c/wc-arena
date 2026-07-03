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
