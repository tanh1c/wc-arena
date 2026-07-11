create or replace function private.recompute_player_card_effective_stats()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  with cards as (
    select
      profile.card_id,
      card.rarity,
      case
        when position = 'GK' then 'GK'
        when card.position in ('CB', 'LB', 'RB', 'LWB', 'RWB') then 'DEF'
        when card.position in ('CDM', 'CM', 'CAM', 'LM', 'RM') then 'MID'
        else 'FWD'
      end as position_group,
      profile.raw_stats
    from public.player_card_gameplay_profiles as profile
    join public.player_cards as card on card.id = profile.card_id
  ), bands as (
    select
      rarity,
      case rarity
        when 'Common' then 50::numeric
        when 'Uncommon' then 60::numeric
        when 'Rare' then 68::numeric
        when 'Epic' then 76::numeric
        when 'Legendary' then 84::numeric
        when 'Heroes' then 91::numeric
        when 'Icon' then 95::numeric
        when 'GOAT' then 98::numeric
      end as minimum_value,
      case rarity
        when 'Common' then 60::numeric
        when 'Uncommon' then 68::numeric
        when 'Rare' then 76::numeric
        when 'Epic' then 84::numeric
        when 'Legendary' then 91::numeric
        when 'Heroes' then 95::numeric
        when 'Icon' then 98::numeric
        when 'GOAT' then 100::numeric
      end as maximum_value
    from (values ('Common'), ('Uncommon'), ('Rare'), ('Epic'), ('Legendary'), ('Heroes'), ('Icon'), ('GOAT')) as rarity_values(rarity)
  ), raw_values as (
    select
      cards.card_id,
      cards.position_group,
      stat.key,
      (stat.value #>> '{}')::numeric as value
    from cards
    cross join lateral pg_catalog.jsonb_each(cards.raw_stats) as stat(key, value)
    where pg_catalog.jsonb_typeof(stat.value) = 'number'
      and case when stat.key in ('Total Stats', 'Base Stats', 'TotalStats', 'total_stats') then false else true end
  ), bounds as (
    select position_group, key, min(value) as minimum_value, max(value) as maximum_value
    from raw_values
    group by position_group, key
  ), normalized_values as (
    select
      raw_values.card_id,
      raw_values.key,
      case
        when bounds.maximum_value = bounds.minimum_value then .5::numeric
        else least(1::numeric, greatest(0::numeric, (raw_values.value - bounds.minimum_value) / (bounds.maximum_value - bounds.minimum_value)))
      end as value
    from raw_values
    join bounds on bounds.position_group = raw_values.position_group and bounds.key = raw_values.key
  ), core as (
    select
      cards.card_id,
      cards.position_group,
      band.minimum_value,
      band.maximum_value,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'OVR'), .5::numeric) as raw_ovr,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'PAC'), .5::numeric) as pac,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'SHO'), .5::numeric) as sho,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'PAS'), .5::numeric) as pas,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'DRI'), .5::numeric) as dri,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'DEF'), .5::numeric) as def,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'PHY'), .5::numeric) as phy,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'GK Reflexes'), max(normalized_values.value) filter (where normalized_values.key = 'DEF'), .5::numeric) as gk_reflexes,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'GK Diving'), max(normalized_values.value) filter (where normalized_values.key = 'DEF'), .5::numeric) as gk_diving,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'GK Handling'), max(normalized_values.value) filter (where normalized_values.key = 'DEF'), .5::numeric) as gk_handling,
      coalesce(max(normalized_values.value) filter (where normalized_values.key in ('GK Positioning', 'Positioning')), max(normalized_values.value) filter (where normalized_values.key = 'DEF'), .5::numeric) as gk_positioning,
      coalesce(max(normalized_values.value) filter (where normalized_values.key = 'GK Kicking'), max(normalized_values.value) filter (where normalized_values.key = 'PAS'), .5::numeric) as gk_kicking
    from cards
    join bands as band on band.rarity = cards.rarity
    left join normalized_values on normalized_values.card_id = cards.card_id
    group by cards.card_id, cards.position_group, band.minimum_value, band.maximum_value
  ), power as (
    select
      core.*,
      case position_group
        when 'GK' then gk_reflexes * .30 + gk_diving * .25 + gk_handling * .20 + gk_positioning * .15 + gk_kicking * .05 + raw_ovr * .05
        when 'DEF' then def * .34 + phy * .18 + pac * .15 + pas * .12 + dri * .10 + sho * .05 + raw_ovr * .06
        when 'MID' then pas * .27 + dri * .22 + def * .16 + phy * .13 + pac * .11 + sho * .07 + raw_ovr * .04
        else sho * .29 + pac * .21 + dri * .20 + pas * .14 + phy * .09 + def * .02 + raw_ovr * .05
      end as role_score
    from core
  ), effective_values as (
    select
      normalized_values.card_id,
      normalized_values.key,
      round(
        least(
          least(100::numeric, power.maximum_value + 6::numeric),
          greatest(greatest(0::numeric, power.minimum_value - 6::numeric), power.minimum_value + (power.maximum_value - power.minimum_value) * power.role_score + (normalized_values.value - power.role_score) * 18::numeric)
        ),
        2
      ) as value
    from normalized_values
    join power on power.card_id = normalized_values.card_id
  ), effective_maps as (
    select
      power.card_id,
      pg_catalog.jsonb_object_agg(effective_values.key, effective_values.value) || pg_catalog.jsonb_build_object(
        'OVR', round(least(band.maximum_value, greatest(band.minimum_value, power.minimum_value + (power.maximum_value - power.minimum_value) * power.role_score)), 2)
      ) as effective_stats
    from power
    join cards on cards.card_id = power.card_id
    join bands as band on band.rarity = cards.rarity
    join effective_values on effective_values.card_id = power.card_id
    group by power.card_id, power.minimum_value, power.maximum_value, power.role_score, band.minimum_value, band.maximum_value
  )
  update public.player_card_gameplay_profiles as profile
  set effective_stats = effective_maps.effective_stats
  from effective_maps
  where profile.card_id = effective_maps.card_id;
end;
$$;

revoke execute on function private.recompute_player_card_effective_stats() from public, anon, authenticated;

select private.recompute_player_card_effective_stats();
