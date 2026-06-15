const fs = require('fs');

const files = ['./src/Landing.tsx', './src/Picks.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Custom colors
  content = content.replace(/bg-\[#DDE3EB\]/g, 'bg-page');
  content = content.replace(/bg-\[#E4FF00\]/g, 'bg-c1');
  content = content.replace(/bg-\[#0D47FF\]/g, 'bg-c2');
  content = content.replace(/bg-\[#00E65B\]/g, 'bg-c3');
  content = content.replace(/bg-\[#FF6B00\]/g, 'bg-c4');
  content = content.replace(/bg-\[#FF2323\]/g, 'bg-c5');
  content = content.replace(/bg-\[#F3F6F8\]/g, 'bg-muted');
  
  content = content.replace(/text-\[#E4FF00\]/g, 'text-c1');
  content = content.replace(/text-\[#0D47FF\]/g, 'text-c2');
  content = content.replace(/text-\[#00E65B\]/g, 'text-c3');
  content = content.replace(/text-\[#FF6B00\]/g, 'text-c4');
  content = content.replace(/text-\[#FF2323\]/g, 'text-c5');

  // Hardcoded black/white equivalents mapped to --color-main / --color-card
  content = content.replace(/bg-white/g, 'bg-card');
  content = content.replace(/bg-black/g, 'bg-main');
  content = content.replace(/border-black/g, 'border-main');
  content = content.replace(/text-black/g, 'text-main');
  content = content.replace(/text-white/g, 'text-inv');
  
  // Use transition-opacity on hover instead of specific colors that conflict with vintage
  content = content.replace(/hover:bg-\[#002cb1\]/g, 'hover:opacity-80 transition-opacity');
  content = content.replace(/hover:bg-\[#002db3\]/g, 'hover:opacity-80 transition-opacity');
  
  // Update box shadows to use var(--color-main) to make the shadow match ink color
  content = content.replace(/#000]/g, 'var(--color-main)]');
  content = content.replace(/'#000'/g, "'currentColor'");

  fs.writeFileSync(file, content);
}
console.log('Colors replaced successfully');
