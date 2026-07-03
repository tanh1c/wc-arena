create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  alternate_positions text,
  team text not null,
  league text not null,
  nation_region text not null,
  skill_moves text,
  footedness text,
  height text,
  weight text,
  work_rate_att text,
  work_rate_def text,
  added_on date,
  image_url text not null,
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic', 'Icon')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_cards_rarity_idx on public.player_cards (rarity);
create index if not exists player_cards_position_idx on public.player_cards (position);
create index if not exists player_cards_team_idx on public.player_cards (team);

create table if not exists public.user_player_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.player_cards(id) on delete cascade,
  source_pack_type text not null check (source_pack_type in ('daily', 'premium')),
  opened_at timestamptz not null default now()
);

create index if not exists user_player_cards_user_id_idx on public.user_player_cards (user_id);
create index if not exists user_player_cards_card_id_idx on public.user_player_cards (card_id);

create table if not exists public.card_pack_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_type text not null check (pack_type in ('daily', 'premium')),
  coins_spent integer not null default 0 check (coins_spent >= 0),
  cards_awarded integer not null check (cards_awarded > 0),
  opened_on_utc date not null,
  opened_at timestamptz not null default now()
);

create index if not exists card_pack_openings_user_id_idx on public.card_pack_openings (user_id);
create unique index if not exists card_pack_openings_daily_once_idx
  on public.card_pack_openings (user_id, pack_type, opened_on_utc)
  where pack_type = 'daily';

create table if not exists public.profile_card_showcases (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 3),
  user_player_card_id uuid not null references public.user_player_cards(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_number)
);

create index if not exists profile_card_showcases_user_player_card_id_idx
  on public.profile_card_showcases (user_player_card_id);

alter table public.player_cards enable row level security;
alter table public.user_player_cards enable row level security;
alter table public.card_pack_openings enable row level security;
alter table public.profile_card_showcases enable row level security;

drop policy if exists player_cards_read_all on public.player_cards;
create policy player_cards_read_all on public.player_cards
  for select to anon, authenticated using (true);

drop policy if exists user_player_cards_read_own on public.user_player_cards;
create policy user_player_cards_read_own on public.user_player_cards
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists card_pack_openings_read_own on public.card_pack_openings;
create policy card_pack_openings_read_own on public.card_pack_openings
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists profile_card_showcases_read_all on public.profile_card_showcases;
create policy profile_card_showcases_read_all on public.profile_card_showcases
  for select to anon, authenticated using (true);

grant select on public.player_cards to anon, authenticated;
grant select on public.user_player_cards to authenticated;
grant select on public.card_pack_openings to authenticated;
grant select on public.profile_card_showcases to anon, authenticated;

create unique index if not exists player_cards_seed_unique_idx
  on public.player_cards (name, position, team, image_url);

insert into public.player_cards (
  name,
  position,
  alternate_positions,
  team,
  league,
  nation_region,
  skill_moves,
  footedness,
  height,
  weight,
  work_rate_att,
  work_rate_def,
  added_on,
  image_url,
  rarity
) values
  ('Beckham', 'CM', 'RM', 'Icons', 'Icons', 'England', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''0" (182 cm)', '74 kg', 'High', 'High', date '2026-07-03', 'https://s6.imgcdn.dev/YqjcNo.png', 'Icon'),
  ('C. Ronaldo', 'ST', null, 'Portugal', 'International', 'Portugal', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '6''2" (187 cm)', '85 kg', 'High', 'Low', date '2026-06-10', 'https://s6.imgcdn.dev/YqjLmO.png', 'Icon'),
  ('Bruno Fernandes', 'CAM', 'CM', 'Portugal', 'International', 'Portugal', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''10" (179 cm)', '69 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yqwk1e.png', 'Rare'),
  ('Neymar Jr', 'LW', 'CAM,ST', 'Brazil', 'International', 'Brazil', '(5) ★★★★★', 'RIGHT / (5) ★★★★★', '5''9" (175 cm)', '68 kg', 'High', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/YqwFCS.png', 'Icon'),
  ('Vini Jr.', 'LW', 'ST', 'Brazil', 'International', 'Brazil', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '5''9" (176 cm)', '73 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/Yq6QsB.png', 'Icon'),
  ('Messi', 'RW', 'CAM,ST', 'Argentina', 'International', 'Argentina', '(4) ★★★★', 'LEFT / (5) ★★★★★', '5''7" (169 cm)', '67 kg', 'High', 'Medium', date '2026-07-01', 'https://s6.imgcdn.dev/YqMn5d.png', 'Icon'),
  ('Haaland', 'ST', null, 'Norway', 'International', 'Norway', '(4) ★★★★', 'LEFT / (4) ★★★★', '6''5" (195 cm)', '94 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/YqM3ri.png', 'Icon'),
  ('Bellingham', 'CAM', 'CM,LM', 'England', 'International', 'England', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''1" (186 cm)', '75 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yqc5TD.png', 'Icon'),
  ('Kane', 'ST', null, 'England', 'International', 'England', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''2" (188 cm)', '86 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/Yqc00S.png', 'Icon'),
  ('Quiñones', 'ST', null, 'Mexico', 'International', 'Mexico', '(4) ★★★★', 'RIGHT / (3) ★★★', '5''11" (180 cm)', '78 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yqc73C.png', 'Rare'),
  ('Pulisic', 'RW', 'RM,ST', 'United States', 'International', 'United States', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''10" (178 cm)', '73 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcGje.png', 'Epic'),
  ('Al Dawsari', 'LM', 'LW', 'Saudi Arabia', 'International', 'Saudi Arabia', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''8" (173 cm)', '71 kg', 'High', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/YqcST0.png', 'Epic'),
  ('Pickford', 'GK', null, 'England', 'International', 'England', '(1) ★', 'LEFT / (4) ★★★★', '6''1" (185 cm)', '77 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqcrRM.png', 'Rare'),
  ('Martínez', 'GK', null, 'Argentina', 'International', 'Argentina', '(1) ★', 'RIGHT / (4) ★★★★', '6''5" (195 cm)', '88 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqcvJd.png', 'Rare'),
  ('Messi', 'CAM', 'ST,RW', 'Argentina', 'International', 'Argentina', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''7" (169 cm)', '67 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yqc2nl.png', 'Icon'),
  ('Modrić', 'CM', 'CAM,CDM', 'Croatia', 'International', 'Croatia', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''8" (172 cm)', '67 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcOFV.png', 'Rare'),
  ('Kimmich', 'CDM', 'RB', 'Germany', 'International', 'Germany', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''10" (177 cm)', '75 kg', 'Medium', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YqcR0o.png', 'Rare'),
  ('Musiala', 'CAM', 'LM,CM', 'Germany', 'International', 'Germany', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '6''0" (184 cm)', '72 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcV3O.png', 'Epic'),
  ('Van Dijk', 'CB', null, 'Netherlands', 'International', 'Netherlands', '(2) ★★', 'RIGHT / (3) ★★★', '6''4" (193 cm)', '92 kg', 'Medium', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/Yqctwn.png', 'Icon'),
  ('Marc Cucurella', 'LB', null, 'Spain', 'International', 'Spain', '(3) ★★★', 'LEFT / (3) ★★★', '5''9" (174 cm)', '66 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YqcdRv.png', 'Common'),
  ('Lamine Yamal', 'RW', 'RM', 'Spain', 'International', 'Spain', '(5) ★★★★★', 'LEFT / (4) ★★★★', '5''11" (180 cm)', '72 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcexB.png', 'Icon'),
  ('De Bruyne', 'CM', 'CAM', 'Belgium', 'International', 'Belgium', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''11" (181 cm)', '75 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcmHu.png', 'Icon'),
  ('Díaz', 'LW', 'LM,ST', 'Colombia', 'International', 'Colombia', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '73 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqcFCL.png', 'Rare'),
  ('Rodríguez', 'CAM', 'RM,CM', 'Colombia', 'International', 'Colombia', '(4) ★★★★', 'LEFT / (3) ★★★', '5''11" (180 cm)', '75 kg', 'High', 'Low', date '2026-06-10', 'https://s6.imgcdn.dev/YqcH7a.png', 'Rare'),
  ('Amad', 'RM', 'RB', 'Côte d''Ivoire', 'International', 'Ivory Coast', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''8" (173 cm)', '67 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqcXLw.png', 'Rare'),
  ('McTominay', 'CM', 'CAM,LM', 'Scotland', 'International', 'Scotland', '(3) ★★★', 'RIGHT / (3) ★★★', '6''4" (193 cm)', '88 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqcEwt.png', 'Common'),
  ('Gyökeres', 'ST', null, 'Sweden', 'International', 'Sweden', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''2" (189 cm)', '94 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yqc8UT.png', 'Rare'),
  ('Isak', 'ST', null, 'Sweden', 'International', 'Sweden', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''4" (192 cm)', '77 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqcJVD.png', 'Rare'),
  ('Kim Min Jae', 'CB', null, 'Korea Republic', 'International', 'Korea Republic', '(2) ★★', 'RIGHT / (3) ★★★', '6''3" (190 cm)', '81 kg', 'Low', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/Yqcoo9.png', 'Common'),
  ('Son', 'ST', 'LW', 'Korea Republic', 'International', 'Korea Republic', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '6''0" (183 cm)', '78 kg', 'Medium', 'Medium', date '2026-06-03', 'https://s6.imgcdn.dev/YquDsy.png', 'Icon'),
  ('Schick', 'ST', null, 'Czech Republic', 'International', 'Czech Republic', '(3) ★★★', 'LEFT / (3) ★★★', '6''3" (191 cm)', '87 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YquYx8.png', 'Common'),
  ('Foster', 'ST', 'LM', 'South Africa', 'International', 'South Africa', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '70 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YquhH2.png', 'Common'),
  ('Xhaka', 'CM', 'CDM', 'Switzerland', 'International', 'Switzerland', '(3) ★★★', 'LEFT / (3) ★★★', '6''1" (186 cm)', '80 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YquwIi.png', 'Common'),
  ('Džeko', 'ST', null, 'Bosnia & Herzegovina', 'International', 'Bosnia Herzegovina', '(3) ★★★', 'RIGHT / (5) ★★★★★', '6''4" (193 cm)', '80 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YquMLS.png', 'Epic'),
  ('Demirović', 'ST', null, 'Bosnia & Herzegovina', 'International', 'Bosnia Herzegovina', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '84 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yquu6C.png', 'Common'),
  ('Davies', 'LB', 'LM,LW', 'Canada', 'International', 'Canada', '(4) ★★★★', 'LEFT / (3) ★★★', '6''1" (185 cm)', '77 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yqu4Ue.png', 'Rare'),
  ('Douglas Santos', 'LB', null, 'Brazil', 'International', 'Brazil', '(3) ★★★', 'LEFT / (3) ★★★', '5''9" (175 cm)', '69 kg', 'High', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/YquCV0.png', 'Common'),
  ('Casemiro', 'CDM', 'CM', 'Brazil', 'International', 'Brazil', '(2) ★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '84 kg', 'Medium', 'High', date '2026-06-04', 'https://s6.imgcdn.dev/YquIpM.png', 'Common'),
  ('Raphinha', 'RW', 'LW,LM,CAM', 'Brazil', 'International', 'Brazil', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''9" (176 cm)', '68 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YquQsd.png', 'Rare'),
  ('Brahim', 'RW', 'RM,LM,CAM', 'Morocco', 'International', 'Morocco', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''7" (170 cm)', '68 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yqui2l.png', 'Epic'),
  ('Bellegarde', 'CAM', 'CM,LW', 'Haiti', 'International', 'Haiti', '(3) ★★★', 'RIGHT / (3) ★★★', '5''7" (170 cm)', '70 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqukXh.png', 'Common'),
  ('Çalhanoğlu', 'CDM', 'CM', 'Türkiye', 'International', 'Türkiye', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''10" (178 cm)', '69 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YqusIV.png', 'Epic'),
  ('Güler', 'CAM', 'RM,CM', 'Türkiye', 'International', 'Türkiye', '(4) ★★★★', 'LEFT / (3) ★★★', '5''9" (175 cm)', '70 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YquyBK.png', 'Rare'),
  ('Gómez', 'CB', null, 'Paraguay', 'International', 'Paraguay', '(2) ★★', 'RIGHT / (2) ★★', '6''1" (185 cm)', '83 kg', 'Medium', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/Yqu5Lo.png', 'Common'),
  ('Caicedo', 'CDM', null, 'Ecuador', 'International', 'Ecuador', '(3) ★★★', 'RIGHT / (3) ★★★', '5''10" (178 cm)', '73 kg', 'Medium', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/YquTln.png', 'Common'),
  ('Doan', 'RM', 'CAM,CM', 'Japan', 'International', 'Japan', '(4) ★★★★', 'LEFT / (3) ★★★', '5''8" (172 cm)', '74 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YquUVg', 'Rare'),
  ('Salah', 'RW', 'RM', 'Egypt', 'International', 'Egypt', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''9" (175 cm)', '72 kg', 'High', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/Yqulpv', 'Icon'),
  ('Marmoush', 'LW', 'ST', 'Egypt', 'International', 'Egypt', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''0" (183 cm)', '81 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YquayN', 'Rare'),
  ('Wood', 'ST', null, 'New Zealand', 'International', 'New Zealand', '(3) ★★★', 'RIGHT / (3) ★★★', '6''3" (191 cm)', '92 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/Yqu12q', 'Common'),
  ('Valverde', 'CM', 'RB,CDM', 'Uruguay', 'International', 'Uruguay', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''0" (182 cm)', '74 kg', 'High', 'High', date '2026-06-17', 'https://i.ibb.co/d4KjBDV0/Valverde.png', 'Rare'),
  ('Saliba', 'CB', null, 'France', 'International', 'France', '(2) ★★', 'RIGHT / (3) ★★★', '6''4" (193 cm)', '85 kg', 'Medium', 'High', date '2026-06-10', 'https://imgcdn.dev/i/YquGBL', 'Common'),
  ('Theo Hernández', 'LB', 'LM', 'France', 'International', 'France', '(4) ★★★★', 'LEFT / (3) ★★★', '6''0" (184 cm)', '81 kg', 'High', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/YquEGV.png', 'Rare'),
  ('Olise', 'RM', 'RW,CAM', 'France', 'International', 'France', '(4) ★★★★', 'LEFT / (5) ★★★★★', '6''0" (184 cm)', '73 kg', 'Medium', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yqu8eK.png', 'Epic'),
  ('Mbappé', 'ST', 'LW', 'France', 'International', 'France', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '6''0" (182 cm)', '75 kg', 'High', 'Low', date '2026-06-10', 'https://s6.imgcdn.dev/Yq4Dtn.png', 'Icon'),
  ('Cherki', 'RW', 'RM,CAM', 'France', 'International', 'France', '(5) ★★★★★', 'LEFT / (5) ★★★★★', '5''10" (177 cm)', '71 kg', 'Medium', 'Medium', date '2026-06-03', 'https://s6.imgcdn.dev/Yq4j5v.png', 'Epic'),
  ('Kanté', 'CDM', 'CM', 'France', 'International', 'France', '(2) ★★', 'RIGHT / (3) ★★★', '5''6" (168 cm)', '70 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/Yq46gq.png', 'Common'),
  ('Ndiaye', 'RM', 'LM,RW', 'Senegal', 'International', 'Senegal', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '70 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4uSu.png', 'Rare'),
  ('Schmid', 'CAM', 'CM,LW', 'Austria', 'International', 'Austria', '(3) ★★★', 'RIGHT / (3) ★★★', '5''6" (168 cm)', '73 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq44eL.png', 'Common'),
  ('Baumgartner', 'CM', 'CAM,ST', 'Austria', 'International', 'Austria', '(4) ★★★★', 'RIGHT / (3) ★★★', '5''11" (180 cm)', '77 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yq4Naw.png', 'Rare'),
  ('Semenyo', 'RW', 'LW,RM', 'Ghana', 'International', 'Ghana', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '6''1" (185 cm)', '79 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4Qtt.png', 'Epic'),
  ('Matheus Cunha', 'CAM', 'ST', 'Brazil', 'International', 'Brazil', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''0" (183 cm)', '76 kg', 'High', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4nKD.png', 'Rare'),
  ('Bouaddi', 'CM', 'CAM,CDM', 'Morocco', 'International', 'Morocco', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (186 cm)', '72 kg', 'Medium', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4sO9.png', 'Common'),
  ('Neuer', 'GK', null, 'Germany', 'International', 'Germany', '(1) ★', 'RIGHT / (4) ★★★★', '6''4" (193 cm)', '93 kg', 'Medium', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4yEy.png', 'Rare'),
  ('Diomande', 'LW', 'LM', 'Côte d''Ivoire', 'International', 'Ivory Coast', '(3) ★★★', 'RIGHT / (3) ★★★', '5''11" (181 cm)', '77 kg', 'High', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4KQ8.png', 'Common'),
  ('Martínez', 'CB', null, 'Argentina', 'International', 'Argentina', '(3) ★★★', 'LEFT / (3) ★★★', '5''10" (178 cm)', '77 kg', 'Medium', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4Tmi.png', 'Common'),
  ('Pavlović', 'CDM', 'CM', 'Germany', 'International', 'Germany', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''2" (188 cm)', '75 kg', 'Medium', 'High', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4lcH.png', 'Rare'),
  ('Van de Ven', 'CB', 'LB', 'Netherlands', 'International', 'Netherlands', '(3) ★★★', 'LEFT / (3) ★★★', '6''4" (193 cm)', '86 kg', 'Medium', 'High', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4zaS.png', 'Common'),
  ('Doku', 'LW', 'RW', 'Belgium', 'International', 'Belgium', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''8" (173 cm)', '66 kg', 'High', 'Medium', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4aWC.png', 'Rare'),
  ('Rabiot', 'CM', 'CAM', 'France', 'International', 'France', '(3) ★★★', 'LEFT / (3) ★★★', '6''3" (191 cm)', '80 kg', 'High', 'Medium', date '2026-07-03', 'https://s6.imgcdn.dev/Yq47K0.png', 'Common'),
  ('James', 'RB', 'CDM', 'England', 'International', 'England', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '91 kg', 'High', 'High', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4BZM.png', 'Rare'),
  ('Arias', 'RW', 'RM,LW', 'Colombia', 'International', 'Colombia', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''6" (168 cm)', '70 kg', 'High', 'Medium', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4ril.png', 'Rare'),
  ('Gordon', 'LW', 'ST,RW', 'England', 'International', 'England', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''0" (183 cm)', '72 kg', 'High', 'High', date '2026-07-03', 'https://s6.imgcdn.dev/Yq4vrh.png', 'Rare'),
  ('Bruno Guimarães', 'CDM', 'CM', 'Brazil', 'International', 'Brazil', '(3) ★★★', 'RIGHT / (3) ★★★', '6''0" (182 cm)', '74 kg', 'High', 'High', date '2026-07-03', 'https://s6.imgcdn.dev/Yq4xmV.png', 'Common'),
  ('Schlotterbeck', 'CB', null, 'Germany', 'International', 'Germany', '(2) ★★', 'LEFT / (3) ★★★', '6''3" (191 cm)', '86 kg', 'High', 'High', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4AuK.png', 'Common'),
  ('Laporte', 'CB', null, 'Spain', 'International', 'Spain', '(2) ★★', 'LEFT / (3) ★★★', '6''2" (189 cm)', '85 kg', 'Medium', 'High', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4Oao.png', 'Common'),
  ('Romero', 'CB', null, 'Argentina', 'International', 'Argentina', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '79 kg', 'Medium', 'High', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4ZWO.png', 'Common'),
  ('Barcola', 'LW', 'RW', 'France', 'International', 'France', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''2" (188 cm)', '70 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4Rhn.png', 'Rare'),
  ('Havertz', 'ST', 'CM', 'Germany', 'International', 'Germany', '(4) ★★★★', 'LEFT / (4) ★★★★', '6''4" (193 cm)', '82 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4VKg.png', 'Rare'),
  ('Brobbey', 'ST', null, 'Netherlands', 'International', 'Netherlands', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '78 kg', 'High', 'Low', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4fZv.png', 'Rare'),
  ('Ødegaard', 'CM', 'CAM', 'Norway', 'International', 'Norway', '(5) ★★★★★', 'LEFT / (4) ★★★★', '5''10" (178 cm)', '68 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4t8N.png', 'Epic'),
  ('Maseko', 'RW', 'RM,LM', 'South Africa', 'International', 'South Africa', '(4) ★★★★', 'LEFT / (3) ★★★', '5''10" (178 cm)', '74 kg', 'High', 'Medium', date '2026-06-29', 'https://s6.imgcdn.dev/Yq4diq.png', 'Rare'),
  ('David', 'ST', null, 'Canada', 'International', 'Canada', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''10" (178 cm)', '81 kg', 'High', 'High', date '2026-06-29', 'https://s6.imgcdn.dev/Yq43rB.png', 'Epic'),
  ('Rafael Leão', 'LW', 'LM,ST', 'Portugal', 'International', 'Portugal', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '6''2" (188 cm)', '81 kg', 'High', 'Low', date '2026-07-01', 'https://s6.imgcdn.dev/Yq4Lqu.png', 'Epic'),
  ('Diop', 'CB', null, 'Morocco', 'International', 'Morocco', '(2) ★★', 'RIGHT / (3) ★★★', '6''4" (194 cm)', '92 kg', 'Medium', 'High', date '2026-07-03', 'https://s6.imgcdn.dev/Yq4euL.png', 'Common'),
  ('Jiménez', 'ST', null, 'Mexico', 'International', 'Mexico', '(3) ★★★', 'RIGHT / (3) ★★★', '6''3" (190 cm)', '81 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yq4m1a.png', 'Common'),
  ('Ream', 'CB', 'LB', 'United States', 'International', 'United States', '(2) ★★', 'LEFT / (3) ★★★', '6''1" (185 cm)', '80 kg', 'Medium', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4qdw.png', 'Common'),
  ('Robinson', 'LB', null, 'United States', 'International', 'United States', '(3) ★★★', 'LEFT / (3) ★★★', '6''0" (183 cm)', '70 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4Hht.png', 'Common'),
  ('João Neves', 'CM', 'CDM', 'Portugal', 'International', 'Portugal', '(3) ★★★', 'RIGHT / (3) ★★★', '5''9" (174 cm)', '66 kg', 'High', 'High', date '2026-06-03', 'https://s6.imgcdn.dev/Yq4XPT.png', 'Common'),
  ('Al Juwair', 'CM', 'CAM,CDM', 'Saudi Arabia', 'International', 'Saudi Arabia', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''10" (178 cm)', '70 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4g9D.png', 'Rare'),
  ('Martínez', 'ST', null, 'Argentina', 'International', 'Argentina', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''9" (174 cm)', '72 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/Yq4E89.png', 'Rare'),
  ('Nico Paz', 'CAM', null, 'Argentina', 'International', 'Argentina', '(4) ★★★★', 'LEFT / (4) ★★★★', '6''1" (186 cm)', '81 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4Jky.png', 'Rare'),
  ('Gvardiol', 'CB', 'LB', 'Croatia', 'International', 'Croatia', '(3) ★★★', 'LEFT / (5) ★★★★★', '6''1" (185 cm)', '80 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/Yq4or8.png', 'Epic'),
  ('Sučić', 'CM', null, 'Croatia', 'International', 'Croatia', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''0" (183 cm)', '76 kg', 'Medium', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/Yq4pq2.png', 'Rare'),
  ('Perišić', 'LW', 'RW', 'Croatia', 'International', 'Croatia', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '6''1" (186 cm)', '80 kg', 'Medium', 'Medium', date '2026-06-03', 'https://s6.imgcdn.dev/YqCY4i.png', 'Epic'),
  ('Karl', 'CAM', 'RM', 'Germany', 'International', 'Germany', '(4) ★★★★', 'LEFT / (3) ★★★', '5''6" (168 cm)', '67 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCjdS.png', 'Rare'),
  ('Dumfries', 'RB', 'RM', 'Netherlands', 'International', 'Netherlands', '(2) ★★', 'RIGHT / (3) ★★★', '6''2" (188 cm)', '80 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqC6jC.png', 'Common'),
  ('Pedri', 'CM', 'CDM', 'Spain', 'International', 'Spain', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''9" (174 cm)', '60 kg', 'High', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/YqCMPe.png', 'Rare'),
  ('Mikel Merino', 'CM', 'ST', 'Spain', 'International', 'Spain', '(3) ★★★', 'LEFT / (3) ★★★', '6''2" (189 cm)', '83 kg', 'High', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/YqCuJM.png', 'Common'),
  ('Courtois', 'GK', null, 'Belgium', 'International', 'Belgium', '(1) ★', 'LEFT / (3) ★★★', '6''7" (200 cm)', '96 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCCkd.png', 'Common'),
  ('Debast', 'CB', 'CDM,CM', 'Belgium', 'International', 'Belgium', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''3" (191 cm)', '76 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCNFh.png', 'Rare'),
  ('De Ketelaere', 'CAM', 'ST', 'Belgium', 'International', 'Belgium', '(4) ★★★★', 'LEFT / (3) ★★★', '6''4" (192 cm)', '79 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCi4V.png', 'Rare'),
  ('Heggem', 'CB', 'LB', 'Norway', 'International', 'Norway', '(2) ★★', 'LEFT / (5) ★★★★★', '6''4" (192 cm)', '79 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCk0K.png', 'Epic'),
  ('Pépé', 'RW', 'ST,RM', 'Côte d''Ivoire', 'International', 'Ivory Coast', '(4) ★★★★', 'LEFT / (3) ★★★', '6''0" (183 cm)', '73 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCndo.png', 'Rare'),
  ('Ferguson', 'CDM', 'CM,CAM', 'Scotland', 'International', 'Scotland', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''11" (181 cm)', '75 kg', 'High', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YqCyjO.png', 'Rare'),
  ('Hwang Hee Chan', 'ST', 'LW,RW', 'Korea Republic', 'International', 'Korea Republic', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''10" (177 cm)', '77 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqC5Tn.png', 'Rare'),
  ('Chaloupek', 'CB', null, 'Czech Republic', 'International', 'Czech Republic', '(2) ★★', 'RIGHT / (3) ★★★', '6''2" (188 cm)', '68 kg', 'Medium', 'High', date '2026-06-24', 'https://s6.imgcdn.dev/YqCzFB.png', 'Common'),
  ('Šulc', 'CAM', 'ST,RM', 'Czech Republic', 'International', 'Czech Republic', '(4) ★★★★', 'RIGHT / (3) ★★★', '5''9" (175 cm)', '67 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqC1Cu.png', 'Rare'),
  ('Mofokeng', 'CAM', null, 'South Africa', 'International', 'South Africa', '(3) ★★★', 'RIGHT / (3) ★★★', '5''5" (166 cm)', '55 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqC00L.png', 'Common'),
  ('Kobel', 'GK', null, 'Switzerland', 'International', 'Switzerland', '(1) ★', 'RIGHT / (3) ★★★', '6''5" (195 cm)', '88 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqC73a.png', 'Common'),
  ('Bombito', 'CB', null, 'Canada', 'International', 'Canada', '(2) ★★', 'RIGHT / (3) ★★★', '6''3" (191 cm)', '81 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCSTt.png', 'Common'),
  ('Laryea', 'RB', 'RM,LM', 'Canada', 'International', 'Canada', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''9" (175 cm)', '70 kg', 'Medium', 'High', date '2026-07-03', 'https://s6.imgcdn.dev/YqCrRT.png', 'Rare'),
  ('Edmilson Junior', 'LW', 'RW,LM', 'Qatar', 'International', 'Qatar', '(4) ★★★★', 'RIGHT / (5) ★★★★★', '5''11" (181 cm)', '71 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCvoD.png', 'Epic'),
  ('Ali', 'ST', 'RW,RM', 'Qatar', 'International', 'Qatar', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '69 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqC2n9.png', 'Rare'),
  ('Endrick', 'ST', 'RW', 'Brazil', 'International', 'Brazil', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''8" (173 cm)', '66 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCAxy.png', 'Rare'),
  ('Bounou', 'GK', null, 'Morocco', 'International', 'Morocco', '(1) ★', 'LEFT / (2) ★★', '6''5" (195 cm)', '78 kg', 'Medium', 'Medium', date '2026-06-03', 'https://s6.imgcdn.dev/YqCOF8.png', 'Common'),
  ('Saibari', 'CAM', 'CM', 'Morocco', 'International', 'Morocco', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''1" (185 cm)', '81 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqC9C2.png', 'Rare'),
  ('Pierrot', 'ST', null, 'Haiti', 'International', 'Haiti', '(2) ★★', 'RIGHT / (3) ★★★', '6''4" (194 cm)', '85 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCR7i.png', 'Common'),
  ('Sanabria', 'ST', null, 'Paraguay', 'International', 'Paraguay', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''11" (180 cm)', '70 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCV3H.png', 'Rare'),
  ('Galarza', 'CM', 'LM', 'Paraguay', 'International', 'Paraguay', '(3) ★★★', 'LEFT / (4) ★★★★', '5''10" (177 cm)', '76 kg', 'High', 'Medium', date '2026-07-03', 'https://s6.imgcdn.dev/YqCtwS.png', 'Rare'),
  ('Ryan', 'GK', null, 'Australia', 'International', 'Australia', '(1) ★', 'RIGHT / (4) ★★★★', '6''0" (184 cm)', '82 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCWUC.png', 'Rare'),
  ('Irankunda', 'RM', 'ST,LM', 'Australia', 'International', 'Australia', '(3) ★★★', 'RIGHT / (3) ★★★', '5''9" (175 cm)', '74 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCdRe.png', 'Common'),
  ('Ordoñez', 'CB', null, 'Ecuador', 'International', 'Ecuador', '(2) ★★', 'RIGHT / (3) ★★★', '6''2" (188 cm)', '80 kg', 'Medium', 'High', date '2026-06-17', 'https://s6.imgcdn.dev/YqC3o0.png', 'Common'),
  ('Pacho', 'CB', null, 'Ecuador', 'International', 'Ecuador', '(2) ★★', 'LEFT / (3) ★★★', '6''2" (188 cm)', '81 kg', 'Low', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCbsM.png', 'Common'),
  ('Skhiri', 'CDM', 'CM,CB', 'Tunisia', 'International', 'Tunisia', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '74 kg', 'High', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/YqCexd.png', 'Common'),
  ('Hannibal', 'CM', 'CAM', 'Tunisia', 'International', 'Tunisia', '(3) ★★★', 'RIGHT / (3) ★★★', '6''0" (182 cm)', '70 kg', 'Medium', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCH7V.png', 'Common'),
  ('Maeda', 'LW', 'ST,RW', 'Japan', 'International', 'Japan', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''8" (173 cm)', '68 kg', 'High', 'High', date '2026-06-10', 'https://s6.imgcdn.dev/YqCXLK.png', 'Rare'),
  ('Bell', 'CDM', 'CM', 'New Zealand', 'International', 'New Zealand', '(3) ★★★', 'RIGHT / (3) ★★★', '6''0" (182 cm)', '77 kg', 'Medium', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqCEwo.png', 'Common'),
  ('De Arrascaeta', 'CAM', 'CM,LM', 'Uruguay', 'International', 'Uruguay', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''8" (172 cm)', '67 kg', 'Medium', 'Low', date '2026-06-10', 'https://s6.imgcdn.dev/YqC8UO.png', 'Rare'),
  ('Bentancur', 'CDM', 'CM', 'Uruguay', 'International', 'Uruguay', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''2" (187 cm)', '73 kg', 'Medium', 'Medium', date '2026-06-24', 'https://s6.imgcdn.dev/YqCJVn.png', 'Rare'),
  ('Jovane Cabral', 'LW', 'ST,LM', 'Cabo Verde', 'International', 'Cape Verde Islands', '(3) ★★★', 'RIGHT / (4) ★★★★', '5''9" (174 cm)', '81 kg', 'High', 'Medium', date '2026-06-17', 'https://s6.imgcdn.dev/YqCoog.png', 'Rare'),
  ('Dembélé', 'ST', 'RW', 'France', 'International', 'France', '(5) ★★★★★', 'LEFT / (5) ★★★★★', '5''10" (178 cm)', '67 kg', 'High', 'Medium', date '2026-06-10', 'https://s6.imgcdn.dev/YqIDsv.png', 'Icon'),
  ('Koulibaly', 'CB', null, 'Senegal', 'International', 'Senegal', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''1" (186 cm)', '89 kg', 'Medium', 'High', date '2026-06-10', 'https://imgcdn.dev/i/YqIY2N', 'Rare'),
  ('Laimer', 'RB', 'CDM,LB', 'Austria', 'International', 'Austria', '(3) ★★★', 'RIGHT / (3) ★★★', '5''11" (180 cm)', '72 kg', 'Medium', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqIhHq', 'Common'),
  ('Arnautović', 'ST', null, 'Austria', 'International', 'Austria', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''4" (192 cm)', '83 kg', 'High', 'Low', date '2026-07-01', 'https://imgcdn.dev/i/YqIwIB', 'Rare'),
  ('Wimmer', 'LM', 'CAM,CM', 'Austria', 'International', 'Austria', '(5) ★★★★★', 'RIGHT / (4) ★★★★', '6''0" (182 cm)', '77 kg', 'Medium', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqI6Bu', 'Epic'),
  ('Yusupov', 'GK', null, 'Uzbekistan', 'International', 'Uzbekistan', '(1) ★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '83 kg', 'Medium', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqIMLL', 'Common'),
  ('Khusanov', 'CB', null, 'Uzbekistan', 'International', 'Uzbekistan', '(2) ★★', 'RIGHT / (3) ★★★', '6''1" (186 cm)', '84 kg', 'Medium', 'Medium', date '2026-06-04', 'https://imgcdn.dev/i/YqIu6a', 'Common'),
  ('Shomurodov', 'ST', 'CAM', 'Uzbekistan', 'International', 'Uzbekistan', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''3" (190 cm)', '76 kg', 'Medium', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqI4lw', 'Rare'),
  ('Mbemba', 'CB', null, 'Congo DR', 'International', 'DR Congo', '(2) ★★', 'RIGHT / (3) ★★★', '6''0" (182 cm)', '81 kg', 'High', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqICVt', 'Common'),
  ('Wissa', 'ST', null, 'Congo DR', 'International', 'DR Congo', '(3) ★★★', 'RIGHT / (3) ★★★', '5''9" (176 cm)', '74 kg', 'Medium', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqIIpT', 'Common'),
  ('Iñaki Williams', 'RW', 'ST,RM', 'Ghana', 'International', 'Ghana', '(4) ★★★★', 'RIGHT / (3) ★★★', '6''1" (186 cm)', '80 kg', 'High', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqIQyD', 'Rare'),
  ('Murillo', 'RB', 'CB', 'Panama', 'International', 'Panama', '(3) ★★★', 'RIGHT / (3) ★★★', '6''0" (184 cm)', '78 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqIi29', 'Common'),
  ('Carrasquilla', 'CM', 'CAM,RM', 'Panama', 'International', 'Panama', '(3) ★★★', 'RIGHT / (3) ★★★', '5''7" (170 cm)', '64 kg', 'Medium', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqIkXy', 'Common'),
  ('Summerville', 'RW', 'RM', 'Netherlands', 'International', 'Netherlands', '(3) ★★★', 'RIGHT / (3) ★★★', '5''7" (169 cm)', '64 kg', 'High', 'Medium', date '2026-06-24', 'https://imgcdn.dev/i/YqIsI8', 'Common'),
  ('Samú Costa', 'CDM', 'CM', 'Portugal', 'International', 'Portugal', '(2) ★★', 'LEFT / (3) ★★★', '6''0" (183 cm)', '75 kg', 'Medium', 'High', date '2026-06-24', 'https://imgcdn.dev/i/YqIyB2', 'Common'),
  ('Amdouni', 'ST', null, 'Switzerland', 'International', 'Switzerland', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''1" (185 cm)', '79 kg', 'High', 'Low', date '2026-06-24', 'https://imgcdn.dev/i/YqI5bi', 'Rare'),
  ('Mora', 'CAM', 'LW,CM', 'Mexico', 'International', 'Mexico', '(4) ★★★★', 'RIGHT / (3) ★★★', '5''6" (168 cm)', '65 kg', 'High', 'Medium', date '2026-07-03', 'https://imgcdn.dev/i/YqIP6H', 'Rare'),
  ('Alvarado', 'RW', 'RM,LM', 'Mexico', 'International', 'Mexico', '(4) ★★★★', 'LEFT / (4) ★★★★', '5''9" (176 cm)', '70 kg', 'High', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqITlS', 'Rare'),
  ('Manzambi', 'CAM', 'CM,CDM', 'Switzerland', 'International', 'Switzerland', '(4) ★★★★', 'RIGHT / (3) ★★★', '6''0" (183 cm)', '75 kg', 'High', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqIUfC', 'Rare'),
  ('Ayari', 'CDM', 'CM', 'Sweden', 'International', 'Sweden', '(3) ★★★', 'RIGHT / (3) ★★★', '5''8" (172 cm)', '69 kg', 'High', 'High', date '2026-06-17', 'https://imgcdn.dev/i/YqIay0', 'Common'),
  ('Balogun', 'ST', null, 'United States', 'International', 'United States', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''10" (178 cm)', '66 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqI1AM', 'Rare'),
  ('Koné', 'CM', null, 'Canada', 'International', 'Canada', '(3) ★★★', 'RIGHT / (4) ★★★★', '6''2" (188 cm)', '76 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqI0Xd', 'Rare'),
  ('Mané', 'ST', 'LW', 'Senegal', 'International', 'Senegal', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''9" (174 cm)', '69 kg', 'High', 'Medium', date '2026-07-01', 'https://imgcdn.dev/i/YqIBNl', 'Rare'),
  ('Vózinha', 'GK', null, 'Cabo Verde', 'International', 'Cape Verde Islands', '(1) ★', 'RIGHT / (3) ★★★', '6''2" (189 cm)', '75 kg', 'Medium', 'Medium', date '2026-06-19', 'https://imgcdn.dev/i/YqIGGh', 'Common'),
  ('Just', 'LW', 'RW,CAM', 'New Zealand', 'International', 'New Zealand', '(3) ★★★', 'LEFT / (4) ★★★★', '5''9" (174 cm)', '69 kg', 'High', 'Medium', date '2026-06-19', 'https://imgcdn.dev/i/YqISbV', 'Rare'),
  ('Mostafa Zico', 'LW', 'RW', 'Egypt', 'International', 'Egypt', '(4) ★★★★', 'RIGHT / (4) ★★★★', '6''0" (182 cm)', '74 kg', 'High', 'Medium', date '2026-07-01', 'https://imgcdn.dev/i/YqIvMK', 'Rare'),
  ('Diney', 'CB', null, 'Cabo Verde', 'International', 'Cape Verde Islands', '(2) ★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '78 kg', 'Low', 'Medium', date '2026-07-01', 'https://imgcdn.dev/i/YqIxlo', 'Common'),
  ('Livaković', 'GK', null, 'Croatia', 'International', 'Croatia', '(1) ★', 'RIGHT / (2) ★★', '6''2" (188 cm)', '79 kg', 'Medium', 'Medium', date '2026-07-01', 'https://imgcdn.dev/i/YqI2fO', 'Common'),
  ('Alisson', 'GK', null, 'Brazil', 'International', 'Brazil', '(1) ★', 'RIGHT / (3) ★★★', '6''4" (193 cm)', '91 kg', 'Medium', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqIODn', 'Common'),
  ('El Aynaoui', 'CM', 'CDM', 'Morocco', 'International', 'Morocco', '(3) ★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '77 kg', 'High', 'High', date '2026-06-29', 'https://imgcdn.dev/i/YqIZyg', 'Common'),
  ('Singo', 'CB', 'RB', 'Côte d''Ivoire', 'International', 'Ivory Coast', '(3) ★★★', 'RIGHT / (2) ★★', '6''3" (190 cm)', '79 kg', 'High', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqI9Av', 'Common'),
  ('Sarr', 'RW', 'CAM', 'Senegal', 'International', 'Senegal', '(4) ★★★★', 'RIGHT / (3) ★★★', '6''1" (185 cm)', '70 kg', 'High', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqIRgN', 'Rare'),
  ('Okon', 'CB', null, 'South Africa', 'International', 'South Africa', '(2) ★★', 'RIGHT / (3) ★★★', '6''2" (187 cm)', '86 kg', 'Medium', 'High', date '2026-06-29', 'https://imgcdn.dev/i/YqIfNq', 'Common'),
  ('Saliba', 'CM', 'CDM', 'Canada', 'International', 'Canada', '(3) ★★★', 'RIGHT / (5) ★★★★★', '5''8" (173 cm)', '71 kg', 'High', 'Medium', date '2026-06-29', 'https://imgcdn.dev/i/YqItGB', 'Epic'),
  ('Berhalter', 'CM', 'RM,CDM', 'United States', 'International', 'United States', '(2) ★★', 'RIGHT / (3) ★★★', '5''9" (175 cm)', '70 kg', 'Medium', 'High', date '2026-07-01', 'https://imgcdn.dev/i/YqIWeu', 'Common'),
  ('Ajer', 'CB', 'RB,LB', 'Norway', 'International', 'Norway', '(3) ★★★', 'RIGHT / (3) ★★★', '6''5" (196 cm)', '84 kg', 'Medium', 'High', date '2026-07-03', 'https://imgcdn.dev/i/YqILza', 'Common'),
  ('Saka', 'RW', 'RM', 'England', 'International', 'England', '(3) ★★★', 'LEFT / (4) ★★★★', '5''10" (178 cm)', '65 kg', 'High', 'Medium', date '2026-06-10', 'https://imgcdn.dev/i/YqIbtw', 'Rare'),
  ('Álvarez', 'CDM', 'CM,CB', 'Mexico', 'International', 'Mexico', '(2) ★★', 'RIGHT / (2) ★★', '6''2" (187 cm)', '73 kg', 'Medium', 'High', date '2026-06-03', 'https://imgcdn.dev/i/YqImDt', 'Common'),
  ('Nuno Mendes', 'LB', null, 'Portugal', 'International', 'Portugal', '(3) ★★★', 'LEFT / (4) ★★★★', '5''11" (180 cm)', '70 kg', 'High', 'Medium', date '2026-06-17', 'https://imgcdn.dev/i/YqIq5T', 'Rare'),
  ('Vitinha', 'CM', 'CDM', 'Portugal', 'International', 'Portugal', '(4) ★★★★', 'RIGHT / (4) ★★★★', '5''8" (172 cm)', '64 kg', 'High', 'High', date '2026-06-10', 'https://imgcdn.dev/i/YqIFOD', 'Rare')
on conflict do nothing;
