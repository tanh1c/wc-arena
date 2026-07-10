alter table public.player_card_gameplay_profiles
  add column effective_stats jsonb not null default '{}'::jsonb;

create index player_card_gameplay_profiles_effective_ovr_idx
  on public.player_card_gameplay_profiles (((effective_stats ->> 'OVR')::numeric));

create schema if not exists private;

create or replace function private.recompute_player_card_effective_stats()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  with profile_stats as (
    select
      profile.card_id,
      card.rarity,
      stat.key,
      least(100::numeric, greatest(0::numeric, (stat.value #>> '{}')::numeric)) as value
    from public.player_card_gameplay_profiles as profile
    join public.player_cards as card on card.id = profile.card_id
    cross join lateral pg_catalog.jsonb_each(profile.raw_stats) as stat(key, value)
    where pg_catalog.jsonb_typeof(stat.value) = 'number'
  ), bounds as (
    select key, min(value) as minimum_value, max(value) as maximum_value
    from profile_stats
    group by key
  ), effective as (
    select
      stats.card_id,
      pg_catalog.jsonb_object_agg(
        stats.key,
        round(
          least(
            100::numeric,
            greatest(
              0::numeric,
              case
                when bounds.maximum_value = bounds.minimum_value then 50::numeric
                else (stats.value - bounds.minimum_value) * 100 / (bounds.maximum_value - bounds.minimum_value)
              end + case stats.rarity
                when 'Uncommon' then 0.5
                when 'Rare' then 1
                when 'Epic' then 1.5
                when 'Legendary' then 2
                when 'Heroes' then 2.5
                when 'Icon' then 3
                when 'GOAT' then 3.5
                else 0
              end
            )
          ),
          2
        )
      ) as effective_stats
    from profile_stats as stats
    join bounds on bounds.key = stats.key
    group by stats.card_id
  )
  update public.player_card_gameplay_profiles as profile
  set effective_stats = effective.effective_stats
  from effective
  where profile.card_id = effective.card_id;
end;
$$;

create or replace function private.refresh_player_card_effective_stats()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.recompute_player_card_effective_stats();
  return null;
end;
$$;

revoke execute on function private.recompute_player_card_effective_stats() from public, anon, authenticated;
revoke execute on function private.refresh_player_card_effective_stats() from public, anon, authenticated;

drop trigger if exists player_card_gameplay_profiles_effective_stats_after_raw_stats on public.player_card_gameplay_profiles;
create trigger player_card_gameplay_profiles_effective_stats_after_raw_stats
  after insert or delete or update of raw_stats on public.player_card_gameplay_profiles
  for each statement execute function private.refresh_player_card_effective_stats();

drop trigger if exists player_cards_effective_stats_after_rarity on public.player_cards;
create trigger player_cards_effective_stats_after_rarity
  after update of rarity on public.player_cards
  for each statement execute function private.refresh_player_card_effective_stats();

select private.recompute_player_card_effective_stats();
