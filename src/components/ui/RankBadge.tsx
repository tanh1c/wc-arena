import bronze from '../../assets/rank_badge/1star/rank-bronze.svg';
import silver from '../../assets/rank_badge/1star/rank-silver.svg';
import gold from '../../assets/rank_badge/1star/rank-gold.svg';
import platinum from '../../assets/rank_badge/1star/rank-platinum.svg';
import diamond from '../../assets/rank_badge/1star/rank-diamond.svg';
import master from '../../assets/rank_badge/1star/rank-master.svg';
import grandmaster from '../../assets/rank_badge/1star/rank-grandmaster.svg';
import bronze2 from '../../assets/rank_badge/2star/rank-2star-bronze.svg';
import silver2 from '../../assets/rank_badge/2star/rank-2star-silver.svg';
import gold2 from '../../assets/rank_badge/2star/rank-2star-gold.svg';
import platinum2 from '../../assets/rank_badge/2star/rank-2star-platinum.svg';
import diamond2 from '../../assets/rank_badge/2star/rank-2star-diamond.svg';
import master2 from '../../assets/rank_badge/2star/rank-2star-master.svg';
import grandmaster2 from '../../assets/rank_badge/2star/rank-2star-grandmaster.svg';
import bronze3 from '../../assets/rank_badge/3star/rank-3star-bronze.svg';
import silver3 from '../../assets/rank_badge/3star/rank-3star-silver.svg';
import gold3 from '../../assets/rank_badge/3star/rank-3star-gold.svg';
import platinum3 from '../../assets/rank_badge/3star/rank-3star-platinum.svg';
import diamond3 from '../../assets/rank_badge/3star/rank-3star-diamond.svg';
import master3 from '../../assets/rank_badge/3star/rank-3star-master.svg';
import grandmaster3 from '../../assets/rank_badge/3star/rank-3star-grandmaster.svg';

export type RankTier = {
  name: string;
  minPoints: number;
  asset: string;
};

export const rankTiers: RankTier[] = [
  { name: 'Bronze I', minPoints: 0, asset: bronze },
  { name: 'Silver I', minPoints: 15, asset: silver },
  { name: 'Gold I', minPoints: 30, asset: gold },
  { name: 'Platinum I', minPoints: 50, asset: platinum },
  { name: 'Diamond I', minPoints: 75, asset: diamond },
  { name: 'Master I', minPoints: 105, asset: master },
  { name: 'Grandmaster I', minPoints: 140, asset: grandmaster },
  { name: 'Bronze II', minPoints: 175, asset: bronze2 },
  { name: 'Silver II', minPoints: 210, asset: silver2 },
  { name: 'Gold II', minPoints: 245, asset: gold2 },
  { name: 'Platinum II', minPoints: 280, asset: platinum2 },
  { name: 'Diamond II', minPoints: 315, asset: diamond2 },
  { name: 'Master II', minPoints: 350, asset: master2 },
  { name: 'Grandmaster II', minPoints: 385, asset: grandmaster2 },
  { name: 'Bronze III', minPoints: 415, asset: bronze3 },
  { name: 'Silver III', minPoints: 440, asset: silver3 },
  { name: 'Gold III', minPoints: 465, asset: gold3 },
  { name: 'Platinum III', minPoints: 485, asset: platinum3 },
  { name: 'Diamond III', minPoints: 500, asset: diamond3 },
  { name: 'Master III', minPoints: 510, asset: master3 },
  { name: 'Grandmaster III', minPoints: 520, asset: grandmaster3 },
];

const sizeClass = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

type RankBadgeProps = {
  points: number;
  size?: keyof typeof sizeClass;
  showLabel?: boolean;
  showPoints?: boolean;
  className?: string;
};

export function getRankTier(points: number) {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  return [...rankTiers].reverse().find((tier) => safePoints >= tier.minPoints) ?? rankTiers[0];
}

export default function RankBadge({ points, size = 'md', showLabel = true, showPoints = false, className = '' }: RankBadgeProps) {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const tier = getRankTier(safePoints);

  return (
    <span className={`inline-flex items-center gap-2 font-black ${className}`} aria-label={`${tier.name} rank, ${safePoints} points`} title={`${tier.name} • ${safePoints.toLocaleString()} points`}>
      <img src={tier.asset} alt="" className={`${sizeClass[size]} object-contain drop-shadow-[1px_1px_0_var(--color-main)]`} />
      {(showLabel || showPoints) && (
        <span className="flex flex-col leading-none">
          {showLabel && <span className="uppercase tracking-wide">{tier.name}</span>}
          {showPoints && <span className="text-[10px] uppercase opacity-75 mt-1">{safePoints.toLocaleString()} pts</span>}
        </span>
      )}
    </span>
  );
}
