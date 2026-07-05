import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('public profile renders card showcase near the player summary', () => {
  const publicProfileSource = readFileSync('src/pages/PublicProfile.tsx', 'utf8');

  assert.match(publicProfileSource, /listProfileShowcase/);
  assert.match(publicProfileSource, /showcaseCards/);
  assert.match(publicProfileSource, /appPages\.cards\.profileShowcase/);
  assert.match(publicProfileSource, /\.\.\/\.\.\/Common_card\.png/);
  assert.match(publicProfileSource, /\.\.\/\.\.\/Rare_card\.png/);
  assert.match(publicProfileSource, /\.\.\/\.\.\/Epic_card\.png/);
  assert.match(publicProfileSource, /\.\.\/\.\.\/Icon_card\.png/);
  assert.match(publicProfileSource, /publicProfileCardBackgroundImages/);
  assert.match(publicProfileSource, /getPublicProfileCardBackgroundImage/);
  assert.match(publicProfileSource, /showcaseCard \? 'bg-cover bg-center' : 'bg-muted'/);
  assert.match(publicProfileSource, /backgroundImage: showcaseCard \? `url\(\$\{getPublicProfileCardBackgroundImage\(showcaseCard\.rarity\)\}\)` : undefined/);
  assert.match(publicProfileSource, /className="mt-2 truncate text-white"/);
});
