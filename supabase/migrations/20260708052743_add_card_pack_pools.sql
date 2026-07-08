alter table public.card_pack_catalog
  add column if not exists pool_type text not null default 'all',
  add column if not exists pool_values text[] not null default '{}';

alter table public.card_pack_catalog
  drop constraint if exists card_pack_catalog_pool_type_check;

alter table public.card_pack_catalog
  add constraint card_pack_catalog_pool_type_check
  check (pool_type in ('all', 'manual', 'team', 'nation_region', 'league', 'position'));

update public.card_pack_catalog
set pool_type = 'all', pool_values = '{}'
where pool_type is null or pool_values is null;
