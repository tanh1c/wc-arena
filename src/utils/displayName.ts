type ProfileNameSource = {
  display_name?: string | null;
  username?: string | null;
};

function cleanName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function getPublicDisplayName(profile?: ProfileNameSource | null, fallback = '—') {
  return cleanName(profile?.display_name) ?? cleanName(profile?.username) ?? fallback;
}

export function getPublicInitials(profile?: ProfileNameSource | null, fallback = '—') {
  return getPublicDisplayName(profile, fallback).slice(0, 2).toUpperCase();
}

export function getPublicAvatarUrl(profile?: { avatar_url?: string | null } | null) {
  const trimmed = profile?.avatar_url?.trim();
  return trimmed || null;
}
