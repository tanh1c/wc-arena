create table if not exists public.icon_chase_pity_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  icon_miss_count integer not null default 0 check (icon_miss_count >= 0 and icon_miss_count <= 9),
  updated_at timestamptz not null default now()
);

alter table public.icon_chase_pity_states enable row level security;

revoke all on public.icon_chase_pity_states from public, anon, authenticated;
grant select, insert, update on public.icon_chase_pity_states to service_role;

drop function if exists public.open_card_pack_transaction(uuid, text, uuid[], integer, date);

create or replace function public.open_card_pack_transaction(
  p_user_id uuid,
  p_pack_type text,
  p_card_ids uuid[],
  p_price_coins integer,
  p_opened_on_utc date,
  p_expected_icon_miss_count integer
)
returns table (
  owned_card jsonb,
  next_coins integer,
  next_icon_miss_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_coins integer;
  next_balance integer;
  current_icon_miss_count integer;
  awarded_icon_count integer;
begin
  insert into public.point_wallets (user_id, balance, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  if p_pack_type = 'icon' then
    insert into public.icon_chase_pity_states (user_id, icon_miss_count, updated_at)
    values (p_user_id, 0, now())
    on conflict (user_id) do nothing;

    select icon_miss_count
    into current_icon_miss_count
    from public.icon_chase_pity_states
    where user_id = p_user_id
    for update;

    if current_icon_miss_count <> coalesce(p_expected_icon_miss_count, -1) then
      raise exception 'PITY_STATE_CHANGED';
    end if;

    select count(*)
    into awarded_icon_count
    from unnest(p_card_ids) as awarded(card_id)
    join public.player_cards on player_cards.id = awarded.card_id
    where player_cards.rarity = 'Icon';

    if current_icon_miss_count >= 9 and awarded_icon_count = 0 then
      raise exception 'Icon pity guarantee required.';
    end if;

    next_icon_miss_count := case
      when awarded_icon_count > 0 then 0
      else current_icon_miss_count + 1
    end;
  else
    next_icon_miss_count := null;
  end if;

  select coalesce(balance, 0)
  into current_coins
  from public.point_wallets
  where user_id = p_user_id
  for update;

  if current_coins < p_price_coins then
    raise exception 'Not enough Coins. Required: %. Current: %.', p_price_coins, current_coins;
  end if;

  next_balance := current_coins - p_price_coins;

  update public.point_wallets
  set balance = next_balance,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.card_pack_openings (
    user_id,
    pack_type,
    coins_spent,
    cards_awarded,
    opened_on_utc
  ) values (
    p_user_id,
    p_pack_type,
    p_price_coins,
    cardinality(p_card_ids),
    p_opened_on_utc
  );

  if p_pack_type = 'icon' then
    update public.icon_chase_pity_states
    set icon_miss_count = next_icon_miss_count,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  return query
  with inserted_cards as (
    insert into public.user_player_cards (user_id, card_id, source_pack_type)
    select p_user_id, card_id, p_pack_type
    from unnest(p_card_ids) as card_id
    returning *
  )
  select
    jsonb_build_object(
      'id', inserted_cards.id,
      'user_id', inserted_cards.user_id,
      'card_id', inserted_cards.card_id,
      'source_pack_type', inserted_cards.source_pack_type,
      'opened_at', inserted_cards.opened_at,
      'is_gif_upgrade', inserted_cards.is_gif_upgrade,
      'player_cards', to_jsonb(player_cards)
    ) as owned_card,
    next_balance as next_coins,
    next_icon_miss_count
  from inserted_cards
  join public.player_cards on player_cards.id = inserted_cards.card_id;
end;
$$;

revoke all on function public.open_card_pack_transaction(uuid, text, uuid[], integer, date, integer) from public;
grant execute on function public.open_card_pack_transaction(uuid, text, uuid[], integer, date, integer) to service_role;
