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

test('cards page follows the attached-card shell layout contract', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /relative z-10 flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 min-h-0/);
  assert.match(cardsSource, /bg-card border-4 border-main p-4 lg:p-6 flex flex-col w-full xl:w-1\/2 shadow-\[8px_8px_0_0_var\(--color-shadow\)\]/);
  assert.match(cardsSource, /<h1 className="text-3xl lg:text-5xl font-black uppercase tracking-tighter text-main">\{t\('nav\.items\.cards'\)\}<\/h1>/);
  assert.doesNotMatch(cardsSource, /<p className="mb-2 inline-flex[^\n]+appPages\.cards\.kicker/);
  assert.doesNotMatch(cardsSource, /<p className="mt-2 text-sm font-bold text-muted-foreground">\{t\('appPages\.cards\.collectionProgress'[\s\S]*?catalog\.length/);
  assert.match(cardsSource, /bg-card border-4 border-main p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 shadow-\[8px_8px_0_0_var\(--color-shadow\)\] rounded-sm/);
  assert.match(cardsSource, /border-b-4 border-main/);
  assert.match(cardsSource, /lg:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
  assert.match(cardsSource, /SelectedPackHero/);
  assert.match(cardsSource, /PackInfoPanel/);
  assert.match(cardsSource, /Potential Rewards/);
  assert.match(cardsSource, /Recent Pulls/);
  assert.match(cardsSource, /PLAY\. COLLECT\. DOMINATE\./);
  assert.doesNotMatch(cardsSource, /relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 min-h-0/);
  assert.doesNotMatch(cardsSource, /<section className="overflow-hidden rounded-sm border-4 border-main bg-card shadow-\[8px_8px_0_var\(--color-shadow\)\]"/);
});

test('cards page separates pack opening from gallery browsing with tabs', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /activeTab/);
  assert.match(cardsSource, /openPacks/);
  assert.match(cardsSource, /gallery/);
  assert.match(cardsSource, /Open Packs/);
  assert.match(cardsSource, /Gallery/);
  assert.match(cardsSource, /setActiveTab/);
});

test('card art panels use imported rarity background PNGs', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /\.\.\/\.\.\/Common_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Rare_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Epic_card\.png/);
  assert.match(cardsSource, /\.\.\/\.\.\/Icon_card\.png/);
  assert.match(cardsSource, /rarityCardBackgroundImages/);
  assert.match(cardsSource, /Common: commonCardBackground/);
  assert.match(cardsSource, /Rare: rareCardBackground/);
  assert.match(cardsSource, /Epic: epicCardBackground/);
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
  assert.match(cardsSource, /Rare: 'wc-card-frame-rare'/);
  assert.match(cardsSource, /Epic: 'wc-card-frame-epic'/);
  assert.match(cardsSource, /Icon: 'wc-card-frame-icon'/);
  assert.match(cardsSource, /getRarityCardFrameClass\(card\.rarity\)/);
  assert.match(cssSource, /@keyframes wc-card-rare-scan/);
  assert.match(cssSource, /@keyframes wc-card-epic-pulse/);
  assert.match(cssSource, /@keyframes wc-card-icon-shimmer/);
});

test('card rarity badges use rarity colors and clipped rounded cards', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /getRarityBadgeClass/);
  assert.match(cardsSource, /Common: 'bg-\[#d8ff65\] text-main/);
  assert.match(cardsSource, /Rare: 'bg-\[#00d4ff\] text-main/);
  assert.match(cardsSource, /Epic: 'bg-\[#ff2bd6\] text-white/);
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

test('card pack panels show rarity drop rates like a gacha game', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');
  const resourcesSource = readFileSync('src/i18n/resources.ts', 'utf8');

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

test('pack artwork renders in a fixed Daily-standard display box', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /h-64 sm:h-72/);
  assert.match(cardsSource, /max-h-full max-w-full object-contain/);
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
  assert.match(cardsSource, /pack\.priceCoins === 0 \? 'FREE' : pack\.priceCoins\.toLocaleString\(\)/);
  assert.match(cardsSource, /style=\{\{ width: `\$\{pack\.rarityWeights\[rarity\]\}%` \}\}/);
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
  assert.match(cardsSource, /Showcase/);
  assert.match(cardsSource, /Search \+ Filter/);
  assert.match(cardsSource, /No cards match your current filters\./);
  assert.match(cardsSource, /ownershipFilter/);
  assert.match(cardsSource, /useState<'owned' | 'missing'>\('owned'\)/);
  assert.match(cardsSource, /card\.ownedCount > 0/);
  assert.match(cardsSource, /card\.ownedCount === 0/);
  assert.match(cardsSource, /\['owned', 'missing'\]/);
  assert.match(cardsSource, /setOwnershipFilter/);
  assert.match(cardsSource, /Owned Cards/);
  assert.match(cardsSource, /Missing Cards/);
  assert.match(cardsSource, /rounded-sm px-3 py-2 text-xs font-black uppercase/);
  assert.match(cardsSource, /dimmed/);
  assert.match(cardsSource, /LOCKED/);
  assert.match(cardsSource, /opacity-45 grayscale/);
  assert.match(cardsSource, /isMissing/);
  assert.match(cardsSource, /card \? 'bg-cover bg-center' : 'bg-muted'/);
  assert.match(cardsSource, /backgroundImage: card \? `url\(\$\{getRarityCardBackgroundImage\(card\.rarity\)\}\)` : undefined/);
  assert.doesNotMatch(cardsSource, /\['owned', 'all', 'missing'\]/);
  assert.doesNotMatch(cardsSource, /ownershipFilter === 'all'/);
  assert.doesNotMatch(cardsSource, />All</);
  assert.match(cardsSource, /rounded-sm border-2 border-main bg-card px-3 py-2/);
  assert.match(cardsSource, /rounded-sm border-4 border-main bg-card p-3/);
  assert.doesNotMatch(cardsSource, /<h2 className="text-2xl font-black uppercase tracking-tight">Gallery<\/h2>/);
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

test('revealed cards review is hidden by default behind a rounded toggle panel', () => {
  const cardsSource = readFileSync('src/pages/Cards.tsx', 'utf8');

  assert.match(cardsSource, /showRevealedReview/);
  assert.match(cardsSource, /setShowRevealedReview\(false\)/);
  assert.match(cardsSource, /setShowRevealedReview\(\(current\) => !current\)/);
  assert.match(cardsSource, /revealedCards\.length > 0 && showRevealedReview/);
  assert.match(cardsSource, /rounded-t-sm border-b-4 border-main bg-card/);
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
