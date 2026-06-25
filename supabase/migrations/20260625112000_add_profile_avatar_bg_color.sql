alter table public.profiles
  add column if not exists avatar_bg_color text;

alter table public.profiles
  drop constraint if exists profiles_avatar_bg_color_hex;

alter table public.profiles
  add constraint profiles_avatar_bg_color_hex
  check (avatar_bg_color is null or avatar_bg_color ~ '^#[0-9A-Fa-f]{6}$');
