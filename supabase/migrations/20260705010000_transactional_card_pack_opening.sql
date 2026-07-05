create or replace function public.open_card_pack_transaction(
  p_user_id uuid,
  p_pack_type text,
  p_card_ids uuid[],
  p_price_coins integer,
  p_opened_on_utc date
)
returns table (
  owned_card jsonb,
  next_coins integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_coins integer;
  next_balance integer;
begin
  insert into public.point_wallets (user_id, balance, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

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
      'player_cards', to_jsonb(player_cards)
    ) as owned_card,
    next_balance as next_coins
  from inserted_cards
  join public.player_cards on player_cards.id = inserted_cards.card_id;
end;
$$;

revoke all on function public.open_card_pack_transaction(uuid, text, uuid[], integer, date) from public;
grant execute on function public.open_card_pack_transaction(uuid, text, uuid[], integer, date) to service_role;
