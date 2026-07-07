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
  const headerNavigationBlock = navigationSource.slice(
    navigationSource.indexOf('export const headerNavigation'),
    navigationSource.indexOf('export const appNavigationGroups'),
  );
  assert.doesNotMatch(headerNavigationBlock, /to: '\/cards'/);

  assert.match(cardsSource, /appPages\.cards\.dailyPack/);
  assert.match(cardsSource, /appPages\.cards\.premiumPack/);
  assert.match(cardsSource, /appPages\.cards\.showcase/);
  assert.match(cardsSource, /ui\.coinsShort/);

  assert.match(resourcesSource, /cards: 'Cards'/);
  assert.match(resourcesSource, /cardsShort: 'Cards'/);
  assert.match(resourcesSource, /dailyPack: 'Daily Pack'/);
  assert.match(resourcesSource, /premiumPack: 'Premium Pack'/);
});

test('card migration seeds the provided real card list instead of placeholders', () => {
  const migrationSource = readFileSync('supabase/migrations/20260703000000_gacha_card_collection.sql', 'utf8');

  assert.doesNotMatch(migrationSource, /Sample Striker|Sample Defender|example\.com/);
  assert.match(migrationSource, /'Beckham'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'C\. Ronaldo'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'Mbappé'[\s\S]*'Icon'/);
  assert.match(migrationSource, /'https:\/\/s6\.imgcdn\.dev\/YqjcNo\.png'/);
});

test('manage_cards uses deployable shared Supabase auth helpers', () => {
  const functionSource = readFileSync('supabase/functions/manage_cards/index.ts', 'utf8');

  assert.match(functionSource, /\.\.\/_shared\/authGuards\.ts/);
  assert.doesNotMatch(functionSource, /\.\.\/_shared\/(auth|http)\.ts/);
});

test('card image URLs use the direct s6 image host format', () => {
  const cardListSource = readFileSync('Card_list.txt', 'utf8');
  const migrationSource = readFileSync('supabase/migrations/20260703000000_gacha_card_collection.sql', 'utf8');

  assert.doesNotMatch(cardListSource, /https:\/\/imgcdn\.dev\/i\//);
  assert.doesNotMatch(migrationSource, /https:\/\/imgcdn\.dev\/i\//);
  assert.match(cardListSource, /https:\/\/s6\.imgcdn\.dev\/YquayN\.png/);
  assert.match(migrationSource, /https:\/\/s6\.imgcdn\.dev\/YquayN\.png/);
});

test('card art renders at a capped width instead of stretching low-resolution images', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const profileSource = readFileSync('src/pages/Profile.tsx', 'utf8');

  assert.match(cardsSource, /max-w-\[180px\]/);
  assert.match(cardsSource, /mx-auto/);
  assert.doesNotMatch(cardsSource, /aspect-\[3\/4\] w-full object-cover/);
  assert.match(profileSource, /max-w-\[120px\]/);
});

test('player cards render GIF only after upgrade unlock and expose a five-copy upgrade action', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const profileSource = readFileSync('src/pages/Profile.tsx', 'utf8');
  const publicProfileSource = readFileSync('src/pages/PublicProfile.tsx', 'utf8');

  assert.match(cardsSource, /upgradePlayerCardToGif/);
  assert.match(cardsSource, /upgradingGifCardId/);
  assert.match(cardsSource, /card\.gif_url && !card\.hasGifUpgrade && card\.baseOwnedCount >= 5/);
  assert.match(cardsSource, /handleUpgradeToGif\(card\.id\)/);
  assert.match(cardsSource, /previewGifCard/);
  assert.match(cardsSource, /onPreviewGif=\{card\.gif_url \? \(\) => setPreviewGifCard\(card\) : undefined\}/);
  assert.match(cardsSource, /GIF Available/);
  assert.match(cardsSource, /Math\.min\(baseOwnedCount \?\? 0, 5\)/);
  assert.match(cardsSource, /baseOwnedCount=\{card\.baseOwnedCount\}/);
  assert.match(cardsSource, /Preview GIF/);
  assert.match(cardsSource, /getPlayerCardDisplayImageUrl\(previewGifCard, true\)/);
  assert.match(cardsSource, /loading="lazy" decoding="async"/);
  assert.match(cardsSource, /max-w-\[220px\]/);
  assert.match(cardsSource, /getPlayerCardDisplayImageUrl\(card, useGif\)/);
  assert.match(cardsSource, /useGif=\{card\.hasGifUpgrade\}/);
  assert.match(cardsSource, /useGif=\{ownedCard\.is_gif_upgrade\}/);
  assert.match(cardsSource, /useGif=\{cardShowcase\.user_player_cards\.is_gif_upgrade\}/);
  assert.match(profileSource, /getPlayerCardDisplayImageUrl\(showcaseCard, showcase\.user_player_cards\.is_gif_upgrade\)/);
  assert.match(publicProfileSource, /getPlayerCardDisplayImageUrl\(showcaseCard, showcase\.user_player_cards\.is_gif_upgrade\)/);
});

test('cards page follows the attached-card shell layout contract', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 lg:gap-6 min-h-0/);
  assert.match(cardsSource, /bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full xl:w-1\/2 shadow-\[8px_8px_0_0_var\(--color-shadow\)\]/);
  assert.match(cardsSource, /<h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main">\{t\('nav\.items\.cards'\)\}<\/h1>/);
  assert.doesNotMatch(cardsSource, /<p className="mb-2 inline-flex[^\n]+appPages\.cards\.kicker/);
  assert.doesNotMatch(cardsSource, /<p className="mt-2 text-sm font-bold text-muted-foreground">\{t\('appPages\.cards\.collectionProgress'[\s\S]*?catalog\.length/);
  assert.match(cardsSource, /bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col shadow-\[8px_8px_0_0_var\(--color-shadow\)\] rounded-sm overflow-hidden/);
  assert.match(cardsSource, /<div className="overflow-hidden">/);
  assert.doesNotMatch(cardsSource, /<div className="overflow-hidden rounded-sm/);
  assert.match(cardsSource, /grid grid-cols-3 border-b-4 border-main bg-card/);
  assert.match(cardsSource, /border-r-4 border-main px-4 py-4 text-center font-black uppercase tracking-tight last:border-r-0/);
  assert.match(cardsSource, /<main className="min-w-0 bg-card pt-4 sm:pt-5 lg:pt-6">/);
  assert.match(cardsSource, /<main className="bg-card min-w-0 flex flex-col pt-4 sm:pt-5 lg:pt-6">/);
  assert.doesNotMatch(cardsSource, /<main className="min-w-0 bg-muted pt-4 sm:pt-5 lg:pt-6">/);
  assert.doesNotMatch(cardsSource, /<main className="bg-muted min-w-0 flex flex-col pt-4 sm:pt-5 lg:pt-6">/);
  assert.match(cardsSource, /grid lg:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
  assert.doesNotMatch(cardsSource, /flex flex-wrap gap-2 border-b-4 border-main bg-card p-3/);
  assert.doesNotMatch(cardsSource, /border-4 border-main px-4 py-3 font-black uppercase text-xs shadow-\[4px_4px_0_var\(--color-shadow\)\]/);
  assert.match(cardsSource, /border-b-4 lg:border-b-0 lg:border-r-4 border-main bg-card p-2 overflow-x-auto lg:overflow-visible/);
  assert.match(cardsSource, /border-b-4 lg:border-b-0 lg:border-r-4 border-main bg-\[radial-gradient/);
  assert.match(cardsSource, /<aside className="bg-card p-3">/);
  assert.match(cardsSource, /grid border-t-4 border-main xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.25fr\)\]/);
  assert.match(cardsSource, /xl:border-r-4/);
  assert.match(cardsSource, /SelectedPackHero/);
  assert.match(cardsSource, /PackInfoPanel/);
  assert.match(cardsSource, /appPages\.cards\.potentialRewards/);
  assert.match(cardsSource, /appPages\.cards\.recentPulls/);
  assert.doesNotMatch(cardsSource, /grid gap-3 lg:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
  assert.doesNotMatch(cardsSource, /mt-3 grid gap-3 xl:grid-cols/);
  assert.doesNotMatch(cardsSource, /appPages\.cards\.packTip/);
  assert.doesNotMatch(cardsSource, /relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0/);
});

test('cards page separates pack opening, forge, and gallery browsing with tabs', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /activeTab/);
  assert.match(cardsSource, /'openPacks' \| 'forge' \| 'gallery'/);
  assert.match(cardsSource, /grid grid-cols-3 border-b-4 border-main bg-card/);
  assert.match(cardsSource, /appPages\.cards\.openPacks/);
  assert.match(cardsSource, /appPages\.cards\.forgeTab/);
  assert.match(cardsSource, /appPages\.cards\.gallery/);
  assert.match(cardsSource, /setActiveTab/);
});

test('card art panels use imported rarity background PNGs', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /\.\.\/\.\.\/Common_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Uncommon\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Rare_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Epic_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Legendary\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Icon_card\.png/);
  assert.match(cardsSource, /rarityCardBackgroundImages/);
  assert.match(cardsSource, /Common: commonCardBackground/);
  assert.match(cardsSource, /Uncommon: uncommonCardBackground/);
  assert.match(cardsSource, /Rare: rareCardBackground/);
  assert.match(cardsSource, /Epic: epicCardBackground/);
  assert.match(cardsSource, /Legendary: legendaryCardBackground/);
  assert.match(cardsSource, /Icon: iconCardBackground/);
  assert.match(cardsSource, /getRarityCardBackgroundImage/);
  assert.match(cardsSource, /backgroundImage: `url\(\$\{getRarityCardBackgroundImage\(card\.rarity\)\}\)`/);
  assert.match(cardsSource, /backgroundImage: `url\(\$\{getRarityCardBackgroundImage\(rarity\)\}\)`/);
  assert.match(cardsSource, /bg-cover bg-center/);
  assert.doesNotMatch(cardsSource, /getRarityCardArtClass/);
});

test('card PNG art keeps CDN rendering unblended inside rarity panels', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.doesNotMatch(cardsSource, /mix-blend-multiply/);
  assert.doesNotMatch(cardsSource, /getRarityInnerBackdrop/);
});

test('card tiles use rarity-specific animated frame effects', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const cssSource = readFileSync('src/index.css', 'utf8');

  assert.match(cardsSource, /getRarityCardFrameClass/);
  assert.match(cardsSource, /Common: 'wc-card-frame-common'/);
  assert.match(cardsSource, /Uncommon: 'wc-card-frame-uncommon'/);
  assert.match(cardsSource, /Rare: 'wc-card-frame-rare'/);
  assert.match(cardsSource, /Epic: 'wc-card-frame-epic'/);
  assert.match(cardsSource, /Legendary: 'wc-card-frame-legendary'/);
  assert.match(cardsSource, /Icon: 'wc-card-frame-icon'/);
  assert.match(cardsSource, /getRarityCardFrameClass\(card\.rarity\)/);
  assert.match(cssSource, /@keyframes wc-card-uncommon-glow/);
  assert.match(cssSource, /@keyframes wc-card-rare-scan/);
  assert.match(cssSource, /@keyframes wc-card-epic-pulse/);
  assert.doesNotMatch(cssSource, /wc-card-legendary-aura/);
  assert.doesNotMatch(cssSource, /\.wc-card-frame-legendary \{[^}]*animation:/);
  assert.match(cssSource, /@keyframes wc-card-icon-shimmer/);
});

test('card rarity badges use rarity colors and clipped rounded cards', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /getRarityBadgeClass/);
  assert.match(cardsSource, /Common: 'bg-\[#d8ff65\] text-main/);
  assert.match(cardsSource, /Uncommon: 'bg-\[#a7f3d0\] text-main/);
  assert.match(cardsSource, /Rare: 'bg-\[#00d4ff\] text-main/);
  assert.match(cardsSource, /Epic: 'bg-\[#ff2bd6\] text-white/);
  assert.match(cardsSource, /Legendary: 'bg-\[#f59e0b\] text-main'/);
  assert.doesNotMatch(cardsSource, /Legendary: 'bg-\[#f59e0b\] text-main shadow/);
  assert.match(cardsSource, /Icon: 'bg-\[#fff0b8\] text-main/);
  assert.match(cardsSource, /getRarityBadgeClass\(card\.rarity\)/);
  assert.match(cardsSource, /min-w-0 overflow-hidden/);
});

test('card metadata centers names and uses colored position and flag badges', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /\.\.\/utils\/teamFlags/);
  assert.match(cardsSource, /getTeamFlag/);
  assert.match(cardsSource, /getNationFlag/);
  assert.match(cardsSource, /text-center/);
  assert.match(cardsSource, /bg-c1 text-main/);
  assert.match(cardsSource, /bg-card text-main/);
  assert.match(cardsSource, /Flag && <Flag/);
  assert.match(cardsSource, /'Saudi Arabia': 'KSA'/);
  assert.match(cardsSource, /Belgium: 'BEL'/);
  assert.match(cardsSource, /Colombia: 'COL'/);
  assert.match(cardsSource, /'Ivory Coast': 'CIV'/);
  assert.match(cardsSource, /Scotland: 'SCO'/);
  assert.match(cardsSource, /'Korea Republic': 'KOR'/);
  assert.match(cardsSource, /'Czech Republic': 'CZE'/);
  assert.match(cardsSource, /'South Africa': 'RSA'/);
  assert.match(cardsSource, /Switzerland: 'SUI'/);
  assert.match(cardsSource, /'Bosnia Herzegovina': 'BIH'/);
  assert.match(cardsSource, /Morocco: 'MAR'/);
  assert.match(cardsSource, /Haiti: 'HAI'/);
  assert.match(cardsSource, /Türkiye: 'TUR'/);
  assert.match(cardsSource, /Paraguay: 'PAR'/);
  assert.match(cardsSource, /Ecuador: 'ECU'/);
  assert.match(cardsSource, /Japan: 'JPN'/);
  assert.match(cardsSource, /Egypt: 'EGY'/);
  assert.match(cardsSource, /'New Zealand': 'NZL'/);
  assert.match(cardsSource, /Uruguay: 'URU'/);
  assert.match(cardsSource, /Senegal: 'SEN'/);
  assert.match(cardsSource, /Austria: 'AUT'/);
  assert.match(cardsSource, /Ghana: 'GHA'/);
  assert.match(cardsSource, /Qatar: 'QAT'/);
  assert.match(cardsSource, /Australia: 'AUS'/);
  assert.match(cardsSource, /'Cape Verde Islands': 'CPV'/);
  assert.match(cardsSource, /'DR Congo': 'COD'/);
  assert.match(cardsSource, /Panama: 'PAN'/);
  assert.match(cardsSource, /Tunisia: 'TUN'/);
  assert.match(cardsSource, /Uzbekistan: 'UZB'/);
  assert.doesNotMatch(cardsSource, /<Star size=\{12\}/);
});

test('cards page card boxes and metadata chips are rounded consistently', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /rounded-sm border-4 bg-card/);
  assert.match(cardsSource, /rounded-sm border-b-4 border-main/);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-muted/);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-c1 text-main/);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-card text-main/);
  assert.match(cardsSource, /rounded-sm border-2 border-main px-2 py-1 text-center text-\[11px\]/);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-card px-1 py-1/);
});

test('open pack panels render expanded pack tiers with artwork and an opening effect', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const cssSource = readFileSync('src/index.css', 'utf8');

  assert.match(cardsSource, /\.\.\/\.\.\/Daily\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Starter\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Premium\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Elite\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Icon\.png/);
  assert.match(cardsSource, /starter: \{ image: starterPackImage, imageClass: 'scale-\[1\.10\]' \}/);
  assert.match(cardsSource, /elite: \{ image: elitePackImage \}/);
  assert.match(cardsSource, /icon: \{ image: iconPackImage \}/);
  assert.match(cardsSource, /packTypes/);
  assert.match(cardsSource, /starter/);
  assert.match(cardsSource, /elite/);
  assert.match(cardsSource, /icon/);
  assert.match(cardsSource, /pack\.image/);
  assert.match(cardsSource, /wc-pack-opening/);
  assert.match(cardsSource, /openingPack === packType/);
  assert.match(cssSource, /@keyframes wc-pack-opening/);
});

test('Icon Chase pack shows compact i18n pity progress only in the pack side panel', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(cardsSource, /getIconChasePityState/);
  assert.match(cardsSource, /iconChasePity/);
  assert.match(cardsSource, /appPages\.cards\.iconPity/);
  assert.doesNotMatch(cardsSource, /Icon guaranteed next Icon Chase pack/);
  assert.doesNotMatch(cardsSource, /guaranteed in/);
  assert.doesNotMatch(cardsSource, /packsUntilGuaranteed/);
  assert.doesNotMatch(cardsSource, /nextGuaranteed/);
  assert.match(resourcesSource, /iconPity: 'Icon pity'/);
  assert.match(resourcesSource, /iconPity: 'Pity Icon'/);
});

test('card pack panels show rarity drop rates like a gacha game', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(cardsSource, /CARD_RARITIES/);
  assert.match(cardsSource, /rarityWeights/);
  assert.match(cardsSource, /appPages\.cards\.dropRates/);
  assert.match(cardsSource, /getRarityBadgeClass\(rarity\)/);
  assert.match(cardsSource, /h-4 rounded-sm border-2 border-main bg-card/);
  assert.match(cardsSource, /h-full rounded-sm \$\{getRarityBadgeClass\(rarity\)\}/);
  assert.match(resourcesSource, /starterPack: 'Starter Pack'/);
  assert.match(resourcesSource, /elitePack: 'Elite Pack'/);
  assert.match(resourcesSource, /iconPack: 'Icon Chase Pack'/);
  assert.match(resourcesSource, /dropRates: 'Drop Rates'/);
});

test('pack artwork renders in a compact mobile Daily-standard display box', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /h-48 sm:h-72/);
  assert.match(cardsSource, /max-h-full max-w-full object-contain/);
  assert.doesNotMatch(cardsSource, /h-64 sm:h-72/);
  assert.doesNotMatch(cardsSource, /mx-auto h-52 object-contain/);
});

test('starter pack artwork gets a specific zoom to match Daily scale', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /imageClass: 'scale-\[1\.10\]'/);
  assert.match(cardsSource, /pack\.imageClass/);
});

test('open pack tab uses a screenshot-style pack rail and selected pack dashboard', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /selectedPackType/);
  assert.match(cardsSource, /setSelectedPackType/);
  assert.match(cardsSource, /useState<PackType>\('daily'\)/);
  assert.match(cardsSource, /packTypes\.map\(\(packType\) =>/);
  assert.match(cardsSource, /const pack = CARD_PACKS\[packType\]/);
  assert.match(cardsSource, /const artwork = packArtwork\[packType\]/);
  assert.match(cardsSource, /src=\{artwork\.image\}/);
  assert.match(cardsSource, /onClick=\{\(\) => setSelectedPackType\(packType\)\}/);
  assert.match(cardsSource, /packType=\{selectedPackType\}/);
  assert.match(cardsSource, /CARD_PACKS\[selectedPackType\]\.cardCount/);
  assert.match(cardsSource, /selectedPackType === 'daily' && dailyPackOpenedToday/);
  assert.match(cardsSource, /pack\.priceCoins === 0 \? t\('appPages\.cards\.free'\)/);
  assert.match(cardsSource, /style=\{\{ width: `\$\{pack\.rarityWeights\[rarity\]\}%` \}\}/);
  assert.match(cardsSource, /overflow-x-auto lg:overflow-visible/);
  assert.match(cardsSource, /grid auto-cols-\[minmax\(210px,72vw\)\] grid-flow-col gap-2 lg:auto-cols-auto lg:grid-flow-row/);
  assert.match(cardsSource, /relative min-h-\[420px\] sm:min-h-\[520px\]/);
  assert.match(cardsSource, /h-48 sm:h-72/);
  assert.doesNotMatch(cardsSource, /relative min-h-\[520px\]/);
  assert.doesNotMatch(cardsSource, /flex h-64 sm:h-72/);
  assert.doesNotMatch(cardsSource, /grid grid-cols-1 lg:grid-cols-\[220px_minmax\(0,1fr\)\]/);
});

test('cards page uses squad-gallery style colorful chrome', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.doesNotMatch(cardsSource, /bg-c3[^\n]*appPages\.cards\.kicker/);
  assert.match(cardsSource, /bg-c1 text-main/);
  assert.match(cardsSource, /bg-c2 text-inv/);
  assert.match(cardsSource, /bg-c3 text-main/);
  assert.match(cardsSource, /bg-c4 text-main/);
  assert.match(cardsSource, /activeTab === tab \? 'bg-c2 text-inv'/);
  assert.match(cardsSource, /selectedPackType === packType \? 'bg-c2 text-inv'/);
});

test('gallery tab presents compact filters and owned or missing card browsing', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.doesNotMatch(cardsSource, /COLLECTION VAULT/);
  assert.doesNotMatch(cardsSource, /collectionProgress/);
  assert.doesNotMatch(cardsSource, /uniqueOwned/);
  assert.doesNotMatch(cardsSource, /Total Cards/);
  assert.match(cardsSource, /showcaseSlotsUsed/);
  assert.match(cardsSource, /filteredCatalog\.length/);
  assert.match(cardsSource, /appPages\.cards\.showcase/);
  assert.match(cardsSource, /appPages\.cards\.searchFilter/);
  assert.match(cardsSource, /appPages\.cards\.noCardsMatch/);
  assert.match(cardsSource, /ownershipFilter/);
  assert.match(cardsSource, /useState<'owned' | 'missing'>\('owned'\)/);
  assert.match(cardsSource, /gallerySort/);
  assert.match(cardsSource, /useState<'name' | 'duplicates' | 'mergeReady'>\('name'\)/);
  assert.match(cardsSource, /card\.ownedCount > 0/);
  assert.match(cardsSource, /card\.ownedCount === 0/);
  assert.match(cardsSource, /baseOwnedCount >= 5/);
  assert.match(cardsSource, /nextSort === 'duplicates'/);
  assert.match(cardsSource, /nextSort === 'mergeReady'/);
  assert.match(cardsSource, /\['owned', 'missing'\]/);
  assert.match(cardsSource, /setOwnershipFilter/);
  assert.match(cardsSource, /setGallerySort/);
  assert.match(cardsSource, /appPages\.cards\.ownedCards/);
  assert.match(cardsSource, /appPages\.cards\.missingCards/);
  assert.match(cardsSource, /appPages\.cards\.sortBy/);
  assert.match(cardsSource, /appPages\.cards\.sortName/);
  assert.match(cardsSource, /appPages\.cards\.sortDuplicates/);
  assert.match(cardsSource, /appPages\.cards\.sortMergeReady/);
  assert.match(cardsSource, /appPages\.cards\.forgedCard/);
  assert.match(cardsSource, /rounded-sm px-3 py-2 text-xs font-black uppercase/);
  assert.match(cardsSource, /dimmed/);
  assert.match(cardsSource, /appPages\.cards\.locked/);
  assert.match(cardsSource, /opacity-45 grayscale/);
  assert.match(cardsSource, /isMissing/);
  assert.match(cardsSource, /card \? 'bg-cover bg-center' : 'bg-muted'/);
  assert.match(cardsSource, /backgroundImage: card \? `url\(\$\{getRarityCardBackgroundImage\(card\.rarity\)\}\)` : undefined/);
  assert.doesNotMatch(cardsSource, /\['owned', 'all', 'missing'\]/);
  assert.doesNotMatch(cardsSource, /ownershipFilter === 'all'/);
  assert.doesNotMatch(cardsSource, />All</);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-card px-3 py-2/);
  assert.match(cardsSource, /bg-card p-3/);
  assert.doesNotMatch(cardsSource, /<h2 className="text-2xl font-black uppercase tracking-tight">Gallery<\/h2>/);
});

test('forge tab lets players manually select five eligible base cards', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(cardsSource, /selectedForgeRarity/);
  assert.match(cardsSource, /selectedForgeOwnedCardIds/);
  assert.match(cardsSource, /setSelectedForgeOwnedCardIds/);
  assert.match(cardsSource, /forgeRarities/);
  assert.match(cardsSource, /CARD_FORGE_COPY_COUNT/);
  assert.match(cardsSource, /selectedForgeOwnedCardIds\.size === CARD_FORGE_COPY_COUNT/);
  assert.match(cardsSource, /forgePlayerCard\(selectedForgeRarity, Array\.from\(selectedForgeOwnedCardIds\)\)/);
  assert.match(cardsSource, /Object\.entries\(selectedForgeRecipe\.rarityWeights\)/);
  assert.match(cardsSource, /showcasedOwnedCardIds/);
  assert.match(cardsSource, /is_gif_upgrade/);
  assert.match(cardsSource, /appPages\.cards\.forgeTab/);
  assert.match(cardsSource, /appPages\.cards\.forgeChooseRarity/);
  assert.match(cardsSource, /appPages\.cards\.forgeSelectCards/);
  assert.match(cardsSource, /appPages\.cards\.forgeSelectedProgress/);
  assert.match(cardsSource, /appPages\.cards\.forgeNoEligibleCards/);
  assert.match(cardsSource, /appPages\.cards\.forgeSelectedCopiesCost/);
  assert.match(cardsSource, /appPages\.cards\.forgePreserveExactCopy/);
  assert.match(cardsSource, /appPages\.cards\.forgeConfirmSelected/);
  assert.match(cardsSource, /selectedForgeCards/);
  assert.match(cardsSource, /Array\.from\(\{ length: CARD_FORGE_COPY_COUNT \}/);
  assert.match(cardsSource, /grid grid-cols-5 gap-2/);
  assert.match(cardsSource, /forgeIngredientGroups\.length > 0 \? \(\s*<div className="grid gap-3 xl:grid-cols-3 sm:grid-cols-2"/);
  assert.match(cardsSource, /<CardImage card=\{card\} useGif=\{false\} \/>/);
  assert.match(cardsSource, /backgroundImage: `url\(\$\{getRarityCardBackgroundImage\(card\.rarity\)\}\)`/);
  assert.match(cardsSource, /appPages\.cards\.forgeOddsTitle/);
  assert.match(cardsSource, /appPages\.cards\.forgeResultTitle/);
  assert.doesNotMatch(cardsSource, /new Date\(ownedCard\.opened_at\)\.toLocaleDateString\(\)/);
  assert.doesNotMatch(cardsSource, /flex items-start justify-between[\s\S]*?getRarityBadgeClass\(card\.rarity\)/);
  assert.match(resourcesSource, /forgeTab: 'Forge'/);
  assert.match(resourcesSource, /forgeTab: 'Đập thẻ'/);
  assert.doesNotMatch(cardsSource, /pendingForgeCard/);
  assert.doesNotMatch(cardsSource, /setPendingForgeCard\(card\)/);
  assert.doesNotMatch(cardsSource, /handleForgeCard\(pendingForgeCard\.id\)/);
  assert.doesNotMatch(cardsSource, /onForgeCard=\{/);
});

test('daily pack already-opened state is shown inside the pack panel with UTC reset countdown', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(cardsSource, /dailyPackOpenedToday/);
  assert.match(cardsSource, /getCurrentUserDailyPackOpenedToday/);
  assert.match(cardsSource, /Daily pack already opened today\./);
  assert.match(cardsSource, /dailyResetCountdown/);
  assert.match(cardsSource, /formatUtcResetCountdown/);
  assert.match(cardsSource, /setInterval/);
  assert.match(cardsSource, /appPages\.cards\.dailyPackResetIn/);
  assert.match(cardsSource, /isOpenedToday && dailyResetCountdown/);
  assert.match(cardsSource, /isOpenedToday \? t\('appPages\.cards\.dailyPackOpenedToday'\)/);
  assert.match(cardsSource, /disabled=\{openingPack !== null \|\| isOpenedToday\}/);
  assert.match(resourcesSource, /dailyPackResetIn: 'Resets in \{\{time\}\} UTC'/);
  assert.match(resourcesSource, /dailyPackResetIn: 'Reset sau \{\{time\}\} UTC'/);
});

test('opened cards appear in a flip reveal popup using the Backcard art', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /\.\.\/\.\.\/Backcard\.png/);
  assert.match(cardsSource, /backCardImage/);
  assert.match(cardsSource, /revealModalOpen/);
  assert.match(cardsSource, /setRevealModalOpen\(result\.cards\.length > 0\)/);
  assert.match(cardsSource, /flippedRevealCardIds/);
  assert.match(cardsSource, /setFlippedRevealCardIds\(new Set<string>\(\)\)/);
  assert.match(cardsSource, /toggleRevealCard/);
  assert.match(cardsSource, /aria-label=\{`Reveal \$\{card\.player_cards\.name\}`\}/);
  assert.match(cardsSource, /src=\{backCardImage\}/);
  assert.match(cardsSource, /revealedCards\.map\(\(card\) =>/);
  assert.match(cardsSource, /rounded-sm/);
  assert.match(cardsSource, /setRevealModalOpen\(false\)/);
});

test('open packs page keeps recent pulls and omits the revealed review toggle panel', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

  assert.match(cardsSource, /recentPullCards/);
  assert.match(cardsSource, /closeRevealModal/);
  assert.match(cardsSource, /setRecentPullCards\(revealedCards\)/);
  assert.doesNotMatch(cardsSource, /flippedRevealCardIds\.size === revealedCards\.length/);
  assert.match(cardsSource, /recentPullCards\.length > 0/);
  assert.match(cardsSource, /recentPullCards\.map\(\(ownedCard\) =>/);
  assert.match(cardsSource, /appPages\.cards\.recentPulls/);
  assert.match(cardsSource, /appPages\.cards\.emptyRecentPulls/);
  assert.match(resourcesSource, /recentPulls:/);
  assert.match(resourcesSource, /emptyRecentPulls:/);
  assert.doesNotMatch(cardsSource, /showRevealedReview/);
  assert.doesNotMatch(cardsSource, /setShowRevealedReview/);
  assert.doesNotMatch(cardsSource, /revealedCards\.length > 0 && showRevealedReview/);
  assert.doesNotMatch(cardsSource, /rounded-t-sm border-b-4 border-main bg-card/);
  assert.doesNotMatch(cardsSource, /appPages\.cards\.packTip/);
  assert.doesNotMatch(resourcesSource, /packTip:/);
});

test('reveal modal card flips use a 3d animated effect', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const cssSource = readFileSync('src/index.css', 'utf8');

  assert.match(cardsSource, /wc-card-flip/);
  assert.match(cardsSource, /wc-card-flip-inner/);
  assert.match(cardsSource, /wc-card-flip-revealed/);
  assert.match(cardsSource, /wc-card-flip-face/);
  assert.match(cssSource, /\.wc-card-flip/);
  assert.match(cssSource, /perspective: 1000px/);
  assert.match(cssSource, /transform-style: preserve-3d/);
  assert.match(cssSource, /backface-visibility: hidden/);
  assert.match(cssSource, /@keyframes wc-card-reveal-pop/);
});

test('opened card status badges use distinct readable colors', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /badgeClass/);
  assert.match(cardsSource, /bg-c1 text-main/);
  assert.match(cardsSource, /bg-c4 text-main/);
  assert.match(cardsSource, /duplicate \? 'bg-c4 text-main' : 'bg-c1 text-main'/);
  assert.doesNotMatch(cardsSource, /bg-c2 px-2 py-1 text-center text-\[11px\] font-black uppercase text-main/);
});

test('reveal popup is compact and can show five cards per row without the inert open-pack placeholder', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /max-w-\[1280px\]/);
  assert.match(cardsSource, /max-h-\[92vh\]/);
  assert.match(cardsSource, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(cardsSource, /overflow-hidden/);
  assert.match(cardsSource, /min-h-0/);
  assert.match(cardsSource, /flex flex-wrap justify-center/);
  assert.match(cardsSource, /w-full max-w-\[190px\]/);
  assert.doesNotMatch(cardsSource, /sm:grid-cols-2 lg:grid-cols-5/);
  assert.match(cardsSource, /min-h-\[400px\]/);
  assert.doesNotMatch(cardsSource, /h-\[94vh\]/);
  assert.doesNotMatch(cardsSource, /overflow-auto/);
  assert.doesNotMatch(cardsSource, /max-w-\[1600px\]/);
  assert.doesNotMatch(cardsSource, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.doesNotMatch(cardsSource, /max-w-\[220px\] min-h-\[360px\]/);
  assert.doesNotMatch(cardsSource, /max-w-\[320px\] min-h-\[520px\]/);
  assert.doesNotMatch(cardsSource, /m-3 sm:m-4 mt-0 border-4 border-main bg-card p-6 text-center font-black uppercase text-muted-foreground/);
  assert.doesNotMatch(cardsSource, /\{t\('appPages\.cards\.openPack'\)\}\n\s*<\/div>\n\s*\)\}/);
});
