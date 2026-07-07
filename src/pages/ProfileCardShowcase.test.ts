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
  assert.match(profileSource, /\.\.\/\.\.\/Common_card\.png/);
  assert.match(profileSource, /\.\.\/\.\.\/Uncommon\.png/);
  assert.match(profileSource, /\.\.\/\.\.\/Rare_card\.png/);
  assert.match(profileSource, /\.\.\/\.\.\/Epic_card\.png/);
  assert.match(profileSource, /\.\.\/\.\.\/Legendary\.png/);
  assert.match(profileSource, /\.\.\/\.\.\/Icon_card\.png/);
  assert.match(profileSource, /Uncommon: uncommonCardBackground/);
  assert.match(profileSource, /Legendary: legendaryCardBackground/);
  assert.match(profileSource, /profileCardBackgroundImages/);
  assert.match(profileSource, /getProfileCardBackgroundImage/);
  assert.match(profileSource, /showcaseCard \? 'bg-cover bg-center' : 'bg-muted'/);
  assert.match(profileSource, /backgroundImage: showcaseCard \? `url\(\$\{getProfileCardBackgroundImage\(showcaseCard\.rarity\)\}\)` : undefined/);
  assert.match(profileSource, /className="mt-2 truncate text-white"/);

  assert.match(cardsServiceSource, /listCurrentUserShowcase/);
  assert.match(cardsServiceSource, /profile_card_showcases/);
  assert.match(resourcesSource, /profileShowcase: 'Card Showcase'/);
  assert.match(resourcesSource, /pickShowcaseCards: 'Pick showcase cards'/);
});
