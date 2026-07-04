alter table public.user_player_cards
  drop constraint if exists user_player_cards_source_pack_type_check;

alter table public.user_player_cards
  add constraint user_player_cards_source_pack_type_check
  check (source_pack_type in ('daily', 'starter', 'premium', 'elite', 'icon'));

alter table public.card_pack_openings
  drop constraint if exists card_pack_openings_pack_type_check;

alter table public.card_pack_openings
  add constraint card_pack_openings_pack_type_check
  check (pack_type in ('daily', 'starter', 'premium', 'elite', 'icon'));
