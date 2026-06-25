type UserAvatarProps = {
  avatarUrl?: string | null;
  avatarBgColor?: string | null;
  displayName: string;
  initials: string;
  className: string;
  imageClassName?: string;
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isClubAvatarUrl(url?: string | null) {
  return Boolean(url?.startsWith('/clubs/'));
}

export function normalizeAvatarBgColor(color?: string | null) {
  const trimmed = color?.trim();
  return trimmed && HEX_COLOR_PATTERN.test(trimmed) ? trimmed : '#FFFFFF';
}

export default function UserAvatar({ avatarUrl, avatarBgColor, displayName, initials, className, imageClassName }: UserAvatarProps) {
  const isClub = isClubAvatarUrl(avatarUrl);
  const style = isClub ? { backgroundColor: normalizeAvatarBgColor(avatarBgColor) } : undefined;
  const imgClassName = imageClassName ?? (isClub ? 'w-full h-full object-contain p-2' : 'w-full h-full object-cover');

  return (
    <div className={`${className} ${isClub ? '' : 'bg-elevated'} overflow-hidden flex items-center justify-center`} style={style}>
      {avatarUrl ? <img src={avatarUrl} alt={displayName} className={imgClassName} loading="lazy" /> : initials}
    </div>
  );
}
