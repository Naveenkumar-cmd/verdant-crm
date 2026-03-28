-- 011_create_user_profile_trigger.sql

-- Automatically create user_profiles row when a user signs up

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

insert into public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    created_at
)
values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    now()
);

return new;

end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();