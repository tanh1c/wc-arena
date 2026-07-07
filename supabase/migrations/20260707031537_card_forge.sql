alter table public.user_player_cards
  drop constraint if exists user_player_cards_source_pack_type_check;

alter table public.user_player_cards
  add constraint user_player_cards_source_pack_type_check
  check (source_pack_type in ('daily', 'starter', 'premium', 'elite', 'icon', 'upgrade', 'forge'));

create or replace function public.forge_card_transaction(
  p_user_id uuid,
  p_source_card_id uuid,
  p_result_card_id uuid,
  p_price_coins integer
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
  source_rarity text;
  current_coins integer;
  consumed_count integer;
begin
  select rarity
  into source_rarity
  from public.player_cards
  where id = p_source_card_id;

  if source_rarity is null then
    raise exception 'Source card is not available.';
  end if;

  if source_rarity = 'Icon' then
    raise exception 'Icon cards cannot be forged.';
  end if;

  if not exists (select 1 from public.player_cards where id = p_result_card_id) then
    raise exception 'Forge result card is not available.';
  end if;

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

  with ranked_cards as (
    select
      user_player_cards.id,
      row_number() over (order by user_player_cards.opened_at asc, user_player_cards.id asc) as copy_rank
    from public.user_player_cards
    where user_id = p_user_id
      and card_id = p_source_card_id
      and is_gif_upgrade = false
      and not exists (
        select 1
        from public.profile_card_showcases
        where profile_card_showcases.user_player_card_id = user_player_cards.id
      )
  ), candidate_ids as (
    select id
    from ranked_cards
    where copy_rank > 1
    order by copy_rank asc
    limit 5
  ), candidate_cards as (
    select id
    from public.user_player_cards
    where id in (select id from candidate_ids)
    for update skip locked
  ), deleted_cards as (
    delete from public.user_player_cards
    where id in (select id from candidate_cards)
    returning id
  )
  select count(*) into consumed_count
  from deleted_cards;

  if consumed_count < 5 then
    raise exception 'Need 5 spare base copies to forge this card.';
  end if;

  next_coins := current_coins - p_price_coins;

  update public.point_wallets
  set balance = next_coins,
      updated_at = now()
  where user_id = p_user_id;

  return query
  with inserted_card as (
    insert into public.user_player_cards (user_id, card_id, source_pack_type, is_gif_upgrade)
    values (p_user_id, p_result_card_id, 'forge', false)
    returning *
  )
  select jsonb_build_object(
    'id', inserted_card.id,
    'user_id', inserted_card.user_id,
    'card_id', inserted_card.card_id,
    'source_pack_type', inserted_card.source_pack_type,
    'is_gif_upgrade', inserted_card.is_gif_upgrade,
    'opened_at', inserted_card.opened_at,
    'player_cards', to_jsonb(player_cards)
  ) as owned_card,
  next_coins
  from inserted_card
  join public.player_cards on player_cards.id = inserted_card.card_id;
end;
$$;

revoke all on function public.forge_card_transaction(uuid, uuid, uuid, integer) from public;
grant execute on function public.forge_card_transaction(uuid, uuid, uuid, integer) to service_role;
