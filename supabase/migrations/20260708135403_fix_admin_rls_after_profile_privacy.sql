create schema if not exists private;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
    and profile.role = 'admin'
  );
$$;

revoke all on function private.current_user_is_admin() from public, anon, authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

drop policy if exists admin_audit_logs_admin_read on public.admin_audit_logs;
create policy admin_audit_logs_admin_read on public.admin_audit_logs
  for select to authenticated
  using (private.current_user_is_admin());

drop policy if exists admin_checklist_items_admin_read on public.admin_checklist_items;
create policy admin_checklist_items_admin_read on public.admin_checklist_items
  for select to authenticated
  using (private.current_user_is_admin());

drop policy if exists user_trust_signals_admin_read on public.user_trust_signals;
create policy user_trust_signals_admin_read on public.user_trust_signals
  for select to authenticated
  using (private.current_user_is_admin());

drop policy if exists reward_eligibility_checks_admin_read on public.reward_eligibility_checks;
create policy reward_eligibility_checks_admin_read on public.reward_eligibility_checks
  for select to authenticated
  using (private.current_user_is_admin());

drop policy if exists reward_reviews_read on public.reward_reviews;
create policy reward_reviews_read on public.reward_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id or private.current_user_is_admin());
