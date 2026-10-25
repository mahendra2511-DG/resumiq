-- Resumiq database setup. Run once in Supabase → SQL Editor → New query → Run.
-- Safe to run again (uses IF NOT EXISTS / OR REPLACE).

-- 1) Profiles (already exists in older Resumiq; make sure needed columns and policies are there)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz default now()
);
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles enable row level security;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own select" on public.profiles for select using (auth.uid() = id);
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- Old paid-plan columns are no longer used (Resumiq is free). Make sure users can't edit them even if they still exist:
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_paid') then
    revoke update (is_paid) on public.profiles from authenticated, anon;
  end if;
end $$;

-- 2) Documents: resumes, job analyses, cover letters, applications, interview sets
create table if not exists public.rq_docs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('resume','analysis','cover','application','interview','linkedin')),
  title text default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists rq_docs_user_idx on public.rq_docs(user_id, updated_at desc);
alter table public.rq_docs enable row level security;
drop policy if exists "rq_docs own" on public.rq_docs;
create policy "rq_docs own" on public.rq_docs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- keep documents a sensible size (about 300 KB each)
alter table public.rq_docs drop constraint if exists rq_docs_size;
alter table public.rq_docs add constraint rq_docs_size check (pg_column_size(data) < 300000);

-- 3) Daily AI usage counter (written only by the server with the service role key)
create table if not exists public.rq_usage (
  key text not null,
  day date not null,
  count int not null default 0,
  primary key (key, day)
);
alter table public.rq_usage enable row level security; -- no policies: browsers can't read or write it

create or replace function public.rq_bump_usage(p_key text, p_day date, p_delta int, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into rq_usage(key, day, count) values (p_key, p_day, greatest(p_delta, 0))
  on conflict (key, day) do update set count = greatest(rq_usage.count + p_delta, 0)
  returning count into n;
  if p_delta > 0 and n > p_limit then
    update rq_usage set count = count - p_delta where key = p_key and day = p_day;
    return -1;
  end if;
  return n;
end $$;
revoke all on function public.rq_bump_usage(text, date, int, int) from public, anon, authenticated;

-- tidy old usage rows now and then (optional)
delete from public.rq_usage where day < current_date - 14;
