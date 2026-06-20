import ptsCoin from '../../assets/pts.png';

type PointsCoinProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizeClass = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-20 h-20',
};

export default function PointsCoin({ size = 'md', className = '' }: PointsCoinProps) {
  return <img src={ptsCoin} alt="" aria-hidden="true" className={`${sizeClass[size]} object-contain drop-shadow-[1px_1px_0_var(--color-main)] ${className}`} />;
}
