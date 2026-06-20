import level0 from '../../assets/streak_badge/level0.svg';
import level1 from '../../assets/streak_badge/level1.svg';
import level2 from '../../assets/streak_badge/level2.svg';
import level3 from '../../assets/streak_badge/level3.svg';
import level4 from '../../assets/streak_badge/level4.svg';
import level5 from '../../assets/streak_badge/level5.svg';
import level6 from '../../assets/streak_badge/level6.svg';

const streakBadgeLevels = [level0, level1, level2, level3, level4, level5, level6];

type StreakBadgeProps = {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
};

const sizeClass = {
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
};

export default function StreakBadge({ streak, size = 'md', showValue = true, className = '' }: StreakBadgeProps) {
  const safeStreak = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const level = Math.min(safeStreak, streakBadgeLevels.length - 1);

  return (
    <span className={`inline-flex items-center justify-center gap-1 font-black ${className}`} aria-label={`${safeStreak} match streak`} title={`${safeStreak} match streak`}>
      <img src={streakBadgeLevels[level]} alt="" className={`${sizeClass[size]} object-contain drop-shadow-[1px_1px_0_var(--color-main)]`} />
      {showValue && <span>{safeStreak}</span>}
    </span>
  );
}
