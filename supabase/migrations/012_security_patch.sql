-- 012_security_patch.sql

-- Multi-tenant security hardening
-- Prevent cross-organization data leaks

create or replace function public.current_user_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
select org_id
from public.user_profiles
where id = auth.uid()
limit 1;
$$;


-- CONTACTS SECURITY

drop policy if exists "contacts_select" on contacts;
drop policy if exists "contacts_insert" on contacts;
drop policy if exists "contacts_update" on contacts;
drop policy if exists "contacts_delete" on contacts;

create policy "contacts_select"
on contacts
for select
using (
  org_id = public.current_user_org()
);

create policy "contacts_insert"
on contacts
for insert
with check (
  org_id = public.current_user_org()
);

create policy "contacts_update"
on contacts
for update
using (
  org_id = public.current_user_org()
);

create policy "contacts_delete"
on contacts
for delete
using (
  org_id = public.current_user_org()
);


-- DEALS SECURITY

drop policy if exists "deals_select" on deals;
drop policy if exists "deals_insert" on deals;
drop policy if exists "deals_update" on deals;
drop policy if exists "deals_delete" on deals;

create policy "deals_select"
on deals
for select
using (
  org_id = public.current_user_org()
);

create policy "deals_insert"
on deals
for insert
with check (
  org_id = public.current_user_org()
);

create policy "deals_update"
on deals
for update
using (
  org_id = public.current_user_org()
);

create policy "deals_delete"
on deals
for delete
using (
  org_id = public.current_user_org()
);


-- ACTIVITIES SECURITY

drop policy if exists "activities_select" on activities;
drop policy if exists "activities_insert" on activities;
drop policy if exists "activities_update" on activities;
drop policy if exists "activities_delete" on activities;

create policy "activities_select"
on activities
for select
using (
  org_id = public.current_user_org()
);

create policy "activities_insert"
on activities
for insert
with check (
  org_id = public.current_user_org()
);

create policy "activities_update"
on activities
for update
using (
  org_id = public.current_user_org()
);

create policy "activities_delete"
on activities
for delete
using (
  org_id = public.current_user_org()
);


-- NOTES SECURITY

drop policy if exists "notes_select" on notes;
drop policy if exists "notes_insert" on notes;
drop policy if exists "notes_update" on notes;
drop policy if exists "notes_delete" on notes;

create policy "notes_select"
on notes
for select
using (
  org_id = public.current_user_org()
);

create policy "notes_insert"
on notes
for insert
with check (
  org_id = public.current_user_org()
);

create policy "notes_update"
on notes
for update
using (
  org_id = public.current_user_org()
);

create policy "notes_delete"
on notes
for delete
using (
  org_id = public.current_user_org()
);