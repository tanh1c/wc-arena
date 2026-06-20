create table if not exists public.admin_checklist_items (
  id text primary key,
  label text not null,
  description text not null,
  status text not null check (status in ('ready', 'planned', 'blocked')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_trust_signals (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  description text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('watch', 'review', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_eligibility_checks (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  description text not null,
  status text not null check (status in ('passed', 'review', 'blocked')),
  href text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_trust_notes (
  id text primary key,
  title text not null,
  description text not null,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_checklist_items_sort_idx on public.admin_checklist_items(sort_order, id);
create index if not exists user_trust_signals_status_created_idx on public.user_trust_signals(status, created_at desc);
create index if not exists user_trust_signals_user_created_idx on public.user_trust_signals(user_id, created_at desc);
create index if not exists reward_eligibility_checks_user_sort_idx on public.reward_eligibility_checks(user_id, sort_order, id);
create index if not exists reward_trust_notes_public_sort_idx on public.reward_trust_notes(is_public, sort_order, id);

alter table public.admin_checklist_items enable row level security;
alter table public.user_trust_signals enable row level security;
alter table public.reward_eligibility_checks enable row level security;
alter table public.reward_trust_notes enable row level security;

drop policy if exists admin_checklist_items_admin_read on public.admin_checklist_items;
create policy admin_checklist_items_admin_read on public.admin_checklist_items
for select to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
    and profile.role = 'admin'
  )
);

drop policy if exists user_trust_signals_admin_read on public.user_trust_signals;
create policy user_trust_signals_admin_read on public.user_trust_signals
for select to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
    and profile.role = 'admin'
  )
);

drop policy if exists reward_eligibility_checks_own_read on public.reward_eligibility_checks;
create policy reward_eligibility_checks_own_read on public.reward_eligibility_checks
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists reward_eligibility_checks_admin_read on public.reward_eligibility_checks;
create policy reward_eligibility_checks_admin_read on public.reward_eligibility_checks
for select to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
    and profile.role = 'admin'
  )
);

drop policy if exists reward_trust_notes_public_read on public.reward_trust_notes;
create policy reward_trust_notes_public_read on public.reward_trust_notes
for select to anon, authenticated
using (is_public);

insert into public.admin_checklist_items (id, label, description, status, sort_order)
values
  ('admin-server-time', 'Server-side lock windows', 'Predictions lock from Supabase match timestamps, not browser-only state.', 'ready', 10),
  ('admin-revision-history', 'Prediction revisions', 'Each saved prediction increments a revision so late edits can be audited.', 'ready', 20),
  ('admin-scoring-version', 'Smart scoring version', 'Calculated rows store scoring_version for transparent leaderboard review.', 'ready', 30),
  ('admin-public-rules', 'Public rules copy', 'Contest rules explain scoring, lock timing, and reward review before play.', 'planned', 40),
  ('admin-rate-limits', 'Submission rate limits', 'Edge Functions validate auth and lock state; request throttling remains tracked for production hardening.', 'planned', 50),
  ('admin-admin-actions', 'Admin action trail', 'Manual result updates and score recalculations write audit events.', 'ready', 60)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_trust_notes (id, title, description, is_public, sort_order)
values
  ('trust-free-entry', 'Free-to-play entries only', 'Rewards are reviewed from skill-based predictions without paid entry requirements.', true, 10),
  ('trust-sponsored-pool', 'Sponsored reward pool', 'Reward reviews can reference sponsor-funded placements without changing prediction rules.', true, 20),
  ('trust-public-scoring', 'Transparent scoring ledger', 'Exact score, outcome, and bonus points are stored per prediction for review.', true, 30),
  ('trust-manual-review', 'Manual eligibility review', 'Administrators can hold reward reviews when account or prediction integrity needs a closer look.', true, 40)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_eligibility_checks (id, user_id, label, description, status, href, sort_order)
select
  profile.id::text || '-account-verified',
  profile.id,
  'Account verified',
  'Profile exists and is linked to a signed-in Supabase user.',
  'passed',
  '/profile',
  10
from public.profiles profile
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  href = excluded.href,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_eligibility_checks (id, user_id, label, description, status, href, sort_order)
select
  profile.id::text || '-minimum-predictions',
  profile.id,
  'Prediction activity',
  case when count(prediction.id) >= 3 then 'Minimum prediction activity is present.' else 'Submit at least three predictions before reward review.' end,
  case when count(prediction.id) >= 3 then 'passed' else 'review' end,
  '/picks',
  20
from public.profiles profile
left join public.predictions prediction on prediction.user_id = profile.id
group by profile.id
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  href = excluded.href,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_eligibility_checks (id, user_id, label, description, status, href, sort_order)
select
  profile.id::text || '-public-rules',
  profile.id,
  'Rules acknowledged',
  'Scoring and lock timing are visible before each prediction is submitted.',
  'passed',
  '/matches',
  30
from public.profiles profile
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  href = excluded.href,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_eligibility_checks (id, user_id, label, description, status, href, sort_order)
select
  profile.id::text || '-integrity-review',
  profile.id,
  'Integrity review',
  case when count(signal.id) = 0 then 'No open trust signals for this account.' else 'Open trust signals need admin review before reward approval.' end,
  case when count(signal.id) = 0 then 'passed' else 'review' end,
  '/rewards',
  40
from public.profiles profile
left join public.user_trust_signals signal on signal.user_id = profile.id and signal.status in ('watch', 'review')
group by profile.id
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  href = excluded.href,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.reward_eligibility_checks (id, user_id, label, description, status, href, sort_order)
select
  profile.id::text || '-contact-ready',
  profile.id,
  'Winner contact ready',
  case when profile.email is null then 'Add an email so admins can complete reward review.' else 'Email is available for reward review follow-up.' end,
  case when profile.email is null then 'review' else 'passed' end,
  '/profile',
  50
from public.profiles profile
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  status = excluded.status,
  href = excluded.href,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.user_trust_signals (id, user_id, label, description, severity, status)
select
  'reward-review-' || review.id,
  review.user_id,
  'Reward review pending',
  review.title || ' needs manual reward eligibility review.',
  case when review.status = 'flagged' then 'high' else 'medium' end,
  case when review.status in ('approved', 'paid') then 'cleared' else 'review' end
from public.reward_reviews review
where review.status not in ('approved', 'paid')
on conflict (id) do update set
  user_id = excluded.user_id,
  label = excluded.label,
  description = excluded.description,
  severity = excluded.severity,
  status = excluded.status,
  updated_at = now();
