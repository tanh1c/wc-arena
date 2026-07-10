create table public.player_card_gameplay_profiles (
  card_id uuid primary key references public.player_cards(id) on delete cascade,
  raw_stats jsonb not null,
  playstyles text[] not null default '{}',
  traits text[] not null default '{}',
  source_image_url text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    jsonb_typeof(raw_stats -> 'OVR') = 'number'
    and jsonb_typeof(raw_stats -> 'PAC') = 'number'
    and jsonb_typeof(raw_stats -> 'SHO') = 'number'
    and jsonb_typeof(raw_stats -> 'PAS') = 'number'
    and jsonb_typeof(raw_stats -> 'DRI') = 'number'
    and jsonb_typeof(raw_stats -> 'DEF') = 'number'
    and jsonb_typeof(raw_stats -> 'PHY') = 'number'
  )
);

create index player_card_gameplay_profiles_ovr_idx
  on public.player_card_gameplay_profiles (((raw_stats ->> 'OVR')::numeric));

alter table public.player_card_gameplay_profiles enable row level security;

create policy player_card_gameplay_profiles_read_authenticated
  on public.player_card_gameplay_profiles
  for select to authenticated
  using (true);

revoke all on public.player_card_gameplay_profiles from public, anon, authenticated;
grant select on public.player_card_gameplay_profiles to authenticated;
