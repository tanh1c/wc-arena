alter table public.player_cards
  drop constraint if exists player_cards_rarity_check;

alter table public.player_cards
  add constraint player_cards_rarity_check
  check (rarity in ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Icon'));
