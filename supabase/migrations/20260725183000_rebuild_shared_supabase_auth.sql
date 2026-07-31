begin;

alter table public.profiles
  alter column credits_remaining set default 5,
  alter column credits_limit set default 5,
  alter column subscription_status set default 'trial';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'profile-image'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'profile_image'
  ) then
    alter table public.profiles rename column "profile-image" to profile_image;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'profile-image'
  ) then
    update public.profiles
    set profile_image = coalesce(profile_image, "profile-image");

    alter table public.profiles drop column "profile-image";
  end if;
end $$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists fullname text,
  add column if not exists city text,
  add column if not exists profile_image text,
  add column if not exists subscription_status text default 'trial',
  add column if not exists credits_remaining integer default 5,
  add column if not exists credits_limit integer default 5,
  add column if not exists created_at timestamptz default timezone('utc'::text, now());

alter table public.profiles
  alter column credits_remaining set not null,
  alter column credits_limit set not null,
  alter column subscription_status set not null;

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('trial', 'active', 'expired', 'canceled'));

create unique index if not exists profiles_email_key on public.profiles (email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    fullname,
    city,
    subscription_status,
    credits_remaining,
    credits_limit
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'fullname', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'city', '')), ''),
    'trial',
    5,
    5
  )
  on conflict (id) do update
  set
    email = excluded.email,
    fullname = coalesce(public.profiles.fullname, excluded.fullname),
    city = coalesce(public.profiles.city, excluded.city);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (
  id,
  email,
  fullname,
  city,
  subscription_status,
  credits_remaining,
  credits_limit
)
select
  u.id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data->>'fullname', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data->>'city', '')), ''),
  'trial',
  5,
  5
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

alter table public.profiles enable row level security;

drop policy if exists "Dozvola za kreiranje profila" on public.profiles;
drop policy if exists "Korisnici menjaju samo svoj profil" on public.profiles;
drop policy if exists "Korisnici čitaju samo svoj profil" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke execute on function public.handle_new_user() from anon, authenticated;

commit;
