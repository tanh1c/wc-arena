create table public.saved_squad_formations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  formation text not null check (formation in ('4-3-3', '4-4-2', '4-2-3-1', '3-5-2')),
  assignments jsonb not null default '{}'::jsonb check (jsonb_typeof(assignments) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_squad_formations_user_updated_at_idx
  on public.saved_squad_formations (user_id, updated_at desc);

alter table public.saved_squad_formations enable row level security;

grant select, insert, update, delete on public.saved_squad_formations to authenticated;

create policy saved_squad_formations_select_own
  on public.saved_squad_formations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy saved_squad_formations_insert_own
  on public.saved_squad_formations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy saved_squad_formations_update_own
  on public.saved_squad_formations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy saved_squad_formations_delete_own
  on public.saved_squad_formations for delete to authenticated
  using ((select auth.uid()) = user_id);
