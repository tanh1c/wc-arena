drop function if exists public.forge_card_transaction(uuid, uuid, uuid, integer);

create or replace function public.forge_card_transaction(
  p_user_id uuid,
  p_source_rarity text,
  p_source_owned_card_ids uuid[],
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
  v_current_balance integer;
  v_next_balance integer;
  v_result_owned_card_id uuid;
begin
  if p_source_rarity not in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary') then
    raise exception 'Card rarity cannot be forged.';
  end if;

  if array_length(p_source_owned_card_ids, 1) <> 5 then
    raise exception 'Select exactly 5 cards to forge.';
  end if;

  if (select count(distinct selected_id) <> 5 from unnest(p_source_owned_card_ids) as selected_id) then
    raise exception 'Selected cards must be unique.';
  end if;

  select balance into v_current_balance
  from public.point_wallets
  where user_id = p_user_id
  for update;

  if coalesce(v_current_balance, 0) < p_price_coins then
    raise exception 'Not enough Coins.';
  end if;

  if not exists (select 1 from public.player_cards where id = p_result_card_id) then
    raise exception 'Result card is not available.';
  end if;

  create temporary table selected_forge_cards on commit drop as
  with locked_selected_cards as (
    select
      user_player_cards.id as selected_id,
      user_player_cards.card_id
    from public.user_player_cards
    join public.player_cards on player_cards.id = user_player_cards.card_id
    left join public.profile_card_showcases on profile_card_showcases.user_player_card_id = user_player_cards.id
    where user_player_cards.id = any(p_source_owned_card_ids)
      and user_player_cards.user_id = p_user_id
      and user_player_cards.is_gif_upgrade = false
      and player_cards.rarity = p_source_rarity
      and profile_card_showcases.user_player_card_id is null
    for update of user_player_cards
  )
  select
    selected_id,
    card_id,
    count(*) over (partition by card_id) as selected_count
  from locked_selected_cards;

  if (select count(distinct selected_id) <> 5 from selected_forge_cards) then
    raise exception 'Selected cards are not eligible for forge.';
  end if;

  if exists (
    select 1
    from (
      select distinct card_id, selected_count
      from selected_forge_cards
    ) selected_counts
    join (
      select card_id, count(*) as base_count
      from public.user_player_cards
      where user_id = p_user_id
        and is_gif_upgrade = false
      group by card_id
    ) base_counts on base_counts.card_id = selected_counts.card_id
    where base_count <= selected_count
  ) then
    raise exception 'Forge must preserve one base copy of every exact card.';
  end if;

  v_next_balance := v_current_balance - p_price_coins;

  update public.point_wallets
  set balance = v_next_balance,
      updated_at = now()
  where user_id = p_user_id;

  delete from public.user_player_cards
  where id in (select selected_id from selected_forge_cards);

  insert into public.user_player_cards (user_id, card_id, source_pack_type, is_gif_upgrade)
  values (p_user_id, p_result_card_id, 'forge', false)
  returning id into v_result_owned_card_id;

  return query
  select
    to_jsonb(user_player_cards.*) || jsonb_build_object('player_cards', to_jsonb(player_cards.*)) as owned_card,
    v_next_balance as next_coins
  from public.user_player_cards
  join public.player_cards on player_cards.id = user_player_cards.card_id
  where user_player_cards.id = v_result_owned_card_id;
end;
$$;

revoke all on function public.forge_card_transaction(uuid, text, uuid[], uuid, integer) from public;
grant execute on function public.forge_card_transaction(uuid, text, uuid[], uuid, integer) to service_role;
