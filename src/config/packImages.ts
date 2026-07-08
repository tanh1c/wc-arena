import dailyPackImage from '../../Daily.png';
import elitePackImage from '../../Elite.png';
import iconPackImage from '../../Icon.png';
import premiumPackImage from '../../Premium.png';
import starterPackImage from '../../Starter.png';
import defensiveLinePackImage from '../../packs/Defensive Line.png';
import goalkeeperWallPackImage from '../../packs/Goalkeeper Wall.png';
import midfieldMaestroPackImage from '../../packs/Midfield Maestro.png';
import nationPrideArgentinaPackImage from '../../packs/Nation Pride Argentina.png';
import nationPrideBrazilPackImage from '../../packs/Nation Pride Brazil.png';
import nationPrideFrancePackImage from '../../packs/Nation Pride France.png';
import nationPridePortugalPackImage from '../../packs/Nation Pride Portugal.png';
import nationPrideSpainPackImage from '../../packs/Nation Pride Spain.png';
import strikerHuntPackImage from '../../packs/Striker Hunt.png';

export const PACK_IMAGE_OPTIONS = [
  { path: 'Daily.png', label: 'Daily', image: dailyPackImage, imageClass: '' },
  { path: 'Starter.png', label: 'Starter', image: starterPackImage, imageClass: 'scale-[1.10]' },
  { path: 'Premium.png', label: 'Premium', image: premiumPackImage, imageClass: '' },
  { path: 'Elite.png', label: 'Elite', image: elitePackImage, imageClass: '' },
  { path: 'Icon.png', label: 'Icon', image: iconPackImage, imageClass: '' },
  { path: 'packs/Defensive Line.png', label: 'Defensive Line', image: defensiveLinePackImage, imageClass: '' },
  { path: 'packs/Goalkeeper Wall.png', label: 'Goalkeeper Wall', image: goalkeeperWallPackImage, imageClass: '' },
  { path: 'packs/Midfield Maestro.png', label: 'Midfield Maestro', image: midfieldMaestroPackImage, imageClass: '' },
  { path: 'packs/Nation Pride Argentina.png', label: 'Nation Pride Argentina', image: nationPrideArgentinaPackImage, imageClass: '' },
  { path: 'packs/Nation Pride Brazil.png', label: 'Nation Pride Brazil', image: nationPrideBrazilPackImage, imageClass: '' },
  { path: 'packs/Nation Pride France.png', label: 'Nation Pride France', image: nationPrideFrancePackImage, imageClass: '' },
  { path: 'packs/Nation Pride Portugal.png', label: 'Nation Pride Portugal', image: nationPridePortugalPackImage, imageClass: '' },
  { path: 'packs/Nation Pride Spain.png', label: 'Nation Pride Spain', image: nationPrideSpainPackImage, imageClass: '' },
  { path: 'packs/Striker Hunt.png', label: 'Striker Hunt', image: strikerHuntPackImage, imageClass: '' },
] as const;

export function getPackImageOption(path: string) {
  return PACK_IMAGE_OPTIONS.find((option) => option.path === path) ?? PACK_IMAGE_OPTIONS[0];
}
