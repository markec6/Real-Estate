begin;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

alter table public.saved_properties enable row level security;

drop policy if exists saved_properties_select_own on public.saved_properties;
drop policy if exists saved_properties_insert_own on public.saved_properties;
drop policy if exists saved_properties_update_own on public.saved_properties;
drop policy if exists saved_properties_delete_own on public.saved_properties;

create policy saved_properties_select_own
  on public.saved_properties
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy saved_properties_insert_own
  on public.saved_properties
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy saved_properties_update_own
  on public.saved_properties
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy saved_properties_delete_own
  on public.saved_properties
  for delete
  to authenticated
  using (auth.uid() = user_id);

commit;
