alter table public.profiles
add column if not exists display_name text;

alter table public.profiles
drop constraint if exists profiles_display_name_length_check;

alter table public.profiles
add constraint profiles_display_name_length_check
check (display_name is null or length(btrim(display_name)) between 1 and 40);
