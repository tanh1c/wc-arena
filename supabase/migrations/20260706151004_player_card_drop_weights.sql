create table if not exists public.player_card_drop_weights (
  card_id uuid primary key references public.player_cards(id) on delete cascade,
  drop_weight numeric not null default 1 check (drop_weight >= 0 and drop_weight <= 1000000)
);

alter table public.player_card_drop_weights enable row level security;

revoke all on public.player_card_drop_weights from public, anon, authenticated;
grant select, insert, update, delete on public.player_card_drop_weights to service_role;

insert into public.player_card_drop_weights (card_id, drop_weight)
select id, 1
from public.player_cards
on conflict (card_id) do nothing;
