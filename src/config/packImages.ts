import dailyPackImage from '../../Daily.png';
import elitePackImage from '../../Elite.png';
import iconPackImage from '../../Icon.png';
import premiumPackImage from '../../Premium.png';
import starterPackImage from '../../Starter.png';

export const PACK_IMAGE_OPTIONS = [
  { path: 'Daily.png', label: 'Daily', image: dailyPackImage, imageClass: '' },
  { path: 'Starter.png', label: 'Starter', image: starterPackImage, imageClass: 'scale-[1.10]' },
  { path: 'Premium.png', label: 'Premium', image: premiumPackImage, imageClass: '' },
  { path: 'Elite.png', label: 'Elite', image: elitePackImage, imageClass: '' },
  { path: 'Icon.png', label: 'Icon', image: iconPackImage, imageClass: '' },
] as const;

export function getPackImageOption(path: string) {
  return PACK_IMAGE_OPTIONS.find((option) => option.path === path) ?? PACK_IMAGE_OPTIONS[0];
}
