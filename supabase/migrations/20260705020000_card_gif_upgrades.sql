alter table public.user_player_cards
  add column if not exists is_gif_upgrade boolean not null default false;

alter table public.user_player_cards
  drop constraint if exists user_player_cards_source_pack_type_check;

alter table public.user_player_cards
  add constraint user_player_cards_source_pack_type_check
  check (source_pack_type in ('daily', 'starter', 'premium', 'elite', 'icon', 'upgrade'));

create index if not exists user_player_cards_user_card_gif_idx
  on public.user_player_cards (user_id, card_id, is_gif_upgrade);

create unique index if not exists user_player_cards_one_gif_upgrade_idx
  on public.user_player_cards (user_id, card_id)
  where is_gif_upgrade;

create or replace function public.upgrade_card_to_gif_transaction(
  p_user_id uuid,
  p_card_id uuid
)
returns table (
  owned_card jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_gif_url text;
  consumed_count integer;
begin
  select player_cards.gif_url
  into target_gif_url
  from public.player_cards
  where player_cards.id = p_card_id;

  if target_gif_url is null or btrim(target_gif_url) = '' then
    raise exception 'Card GIF upgrade is not available.';
  end if;

  if exists (
    select 1
    from public.user_player_cards
    where user_id = p_user_id
      and card_id = p_card_id
      and is_gif_upgrade
  ) then
    raise exception 'User already has GIF upgrade for this card.';
  end if;

  with candidate_cards as (
    select user_player_cards.id
    from public.user_player_cards
    where user_id = p_user_id
      and card_id = p_card_id
      and is_gif_upgrade = false
      and not exists (
        select 1
        from public.profile_card_showcases
        where profile_card_showcases.user_player_card_id = user_player_cards.id
      )
    order by opened_at asc
    limit 5
    for update skip locked
  ), deleted_cards as (
    delete from public.user_player_cards
    where id in (select id from candidate_cards)
    returning id
  )
  select count(*) into consumed_count
  from deleted_cards;

  if consumed_count < 5 then
    raise exception 'Need 5 available base copies to upgrade this card.';
  end if;

  return query
  with inserted_card as (
    insert into public.user_player_cards (user_id, card_id, source_pack_type, is_gif_upgrade)
    values (p_user_id, p_card_id, 'upgrade', true)
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
  ) as owned_card
  from inserted_card
  join public.player_cards on player_cards.id = inserted_card.card_id;
end;
$$;

revoke all on function public.upgrade_card_to_gif_transaction(uuid, uuid) from public;
grant execute on function public.upgrade_card_to_gif_transaction(uuid, uuid) to service_role;
