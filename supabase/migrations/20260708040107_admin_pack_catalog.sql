create table if not exists public.card_pack_catalog (
  pack_type text primary key,
  title text not null,
  description text not null,
  image_path text not null,
  card_count integer not null check (card_count > 0 and card_count <= 20),
  price_coins integer not null default 0 check (price_coins >= 0),
  once_per_utc_day boolean not null default false,
  rarity_weights jsonb not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_pack_catalog enable row level security;

drop policy if exists card_pack_catalog_read_all on public.card_pack_catalog;
create policy card_pack_catalog_read_all on public.card_pack_catalog
  for select to anon, authenticated using (true);

revoke all on public.card_pack_catalog from public, anon, authenticated;
grant select on public.card_pack_catalog to anon, authenticated;
grant select, insert, update on public.card_pack_catalog to service_role;

alter table public.user_player_cards drop constraint if exists user_player_cards_source_pack_type_check;
alter table public.card_pack_openings drop constraint if exists card_pack_openings_pack_type_check;

insert into public.card_pack_catalog (
  pack_type,
  title,
  description,
  image_path,
  card_count,
  price_coins,
  once_per_utc_day,
  rarity_weights,
  enabled,
  sort_order
) values
  ('daily', 'Daily Pack', 'A free daily card pack with one player card.', 'Daily.png', 1, 0, true, '{"Common":55,"Uncommon":30,"Rare":12,"Epic":2.5,"Legendary":0.4,"Heroes":0.08,"Icon":0.02,"GOAT":0}'::jsonb, true, 10),
  ('starter', 'Starter Pack', 'Two cards with a balanced chance to grow your squad.', 'Starter.png', 2, 20, false, '{"Common":42,"Uncommon":34,"Rare":18,"Epic":5,"Legendary":0.8,"Heroes":0.15,"Icon":0.05,"GOAT":0}'::jsonb, true, 20),
  ('premium', 'Premium Pack', 'Three cards with improved rare and epic odds.', 'Premium.png', 3, 50, false, '{"Common":25,"Uncommon":32,"Rare":28,"Epic":12,"Legendary":2.4,"Heroes":0.45,"Icon":0.13,"GOAT":0.02}'::jsonb, true, 30),
  ('elite', 'Elite Pack', 'Five cards with strong epic and legendary odds.', 'Elite.png', 5, 100, false, '{"Common":8,"Uncommon":18,"Rare":34,"Epic":30,"Legendary":8,"Heroes":1.5,"Icon":0.45,"GOAT":0.05}'::jsonb, true, 40),
  ('icon', 'Icon Chase Pack', 'Five premium cards with Icon Chase pity progress.', 'Icon.png', 5, 300, false, '{"Common":0,"Uncommon":0,"Rare":32,"Epic":43,"Legendary":17,"Heroes":5,"Icon":2.8,"GOAT":0.2}'::jsonb, true, 50)
on conflict (pack_type) do update set
  title = excluded.title,
  description = excluded.description,
  image_path = excluded.image_path,
  card_count = excluded.card_count,
  price_coins = excluded.price_coins,
  once_per_utc_day = excluded.once_per_utc_day,
  rarity_weights = excluded.rarity_weights,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order,
  updated_at = now();
