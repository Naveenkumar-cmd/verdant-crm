-- 013_performance_indexes.sql
-- Performance indexes for CRM tables

-- CONTACTS
create index if not exists idx_contacts_org_id
on contacts(org_id);

create index if not exists idx_contacts_created_at
on contacts(created_at);


-- DEALS
create index if not exists idx_deals_org_id
on deals(org_id);

create index if not exists idx_deals_created_at
on deals(created_at);


-- ACTIVITIES
create index if not exists idx_activities_org_id
on activities(org_id);

create index if not exists idx_activities_created_at
on activities(created_at);


-- NOTES
create index if not exists idx_notes_org_id
on notes(org_id);

create index if not exists idx_notes_created_at
on notes(created_at);


-- USER PROFILES
create index if not exists idx_user_profiles_org_id
on user_profiles(org_id);


-- ORGANIZATIONS
create index if not exists idx_organizations_created_at
on organizations(created_at);