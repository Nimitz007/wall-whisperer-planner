-- Enum for roles
create type public.app_role as enum ('admin');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Status enum
create type public.submission_status as enum ('new','contacted','quoted','engineering','delivered','won','lost');

-- Submissions (anonymous public planner usage)
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  client_name text,
  client_email text,
  client_phone text,
  company_name text,
  is_builder boolean default false,
  address text,
  suburb text,
  state text,
  postcode text,
  lat double precision,
  lng double precision,
  wall_count int default 0,
  total_length numeric default 0,
  max_height numeric default 0,
  current_step int default 0,
  status public.submission_status not null default 'new',
  assignee_id uuid references auth.users(id) on delete set null,
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
alter table public.submissions enable row level security;
create index idx_submissions_status on public.submissions(status);
create index idx_submissions_updated on public.submissions(updated_at desc);

-- Notes
create table public.submission_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.submission_notes enable row level security;
create index idx_notes_submission on public.submission_notes(submission_id, created_at desc);

-- Activity log
create table public.submission_activity (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.submission_activity enable row level security;
create index idx_activity_submission on public.submission_activity(submission_id, created_at desc);

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger trg_submissions_updated before update on public.submissions
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS POLICIES =====

-- Profiles: admins can see all, users can see/update self
create policy "Admins view all profiles" on public.profiles for select
  using (public.has_role(auth.uid(),'admin'));
create policy "Users view own profile" on public.profiles for select
  using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update
  using (auth.uid() = id);

-- User roles: only admins manage; users can read own
create policy "Admins manage roles" on public.user_roles for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "Users read own roles" on public.user_roles for select
  using (auth.uid() = user_id);

-- Submissions: anyone (anon + auth) can INSERT and UPDATE by id (public planner auto-saves)
-- Only admins can SELECT/DELETE
create policy "Anyone can create submission" on public.submissions for insert
  to anon, authenticated with check (true);
create policy "Anyone can update submission" on public.submissions for update
  to anon, authenticated using (true) with check (true);
create policy "Admins view submissions" on public.submissions for select
  using (public.has_role(auth.uid(),'admin'));
create policy "Admins delete submissions" on public.submissions for delete
  using (public.has_role(auth.uid(),'admin'));

-- Notes: admins only
create policy "Admins manage notes" on public.submission_notes for all
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- Activity: anyone can insert (so public planner can log step changes), admins read
create policy "Anyone insert activity" on public.submission_activity for insert
  to anon, authenticated with check (true);
create policy "Admins read activity" on public.submission_activity for select
  using (public.has_role(auth.uid(),'admin'));