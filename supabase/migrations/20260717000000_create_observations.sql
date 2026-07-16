-- Migration: Create observations table with RLS and Indexes
-- Target Database: Supabase (PostgreSQL)

-- 1. Create the observations table
create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'smoke-free',
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.observations enable row level security;

-- 3. Define Access Policies
-- Anyone (including anonymous users) can view observations to render the live heatmap
create policy "Allow public read access" on public.observations
  for select using (true);

-- Anyone (including anonymous users) can submit new air quality observations
create policy "Allow public insert access" on public.observations
  for insert with check (true);

-- 4. Create indexes for location queries and time-decay filters
create index if not exists observations_created_at_idx on public.observations (created_at desc);
create index if not exists observations_coords_idx on public.observations (latitude, longitude);
