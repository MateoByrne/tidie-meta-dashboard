-- Tidie · Meta Ads daily performance
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.meta_ads_daily (
  id             bigint generated always as identity primary key,
  date           date        not null,
  campaign_name  text        not null,
  campaign_type  text        not null check (campaign_type in ('testing', 'scaling')),
  spend          numeric(14, 2) not null default 0,  -- ARS
  purchases      integer     not null default 0,
  revenue        numeric(14, 2) not null default 0,  -- ARS, purchase conversion value
  impressions    integer     not null default 0,
  link_clicks    integer     not null default 0,
  imported_at    timestamptz not null default now(),
  unique (date, campaign_name)                       -- makes the import idempotent (upsert)
);

-- Ratios (ROAS, CPA, CTR) are NOT stored: they must be computed as
-- sum/sum over any date range, never as an average of daily ratios.

create index if not exists meta_ads_daily_date_idx on public.meta_ads_daily (date);

-- Row Level Security: the publishable key can only read.
-- Writes happen exclusively through the secret key (import script), which bypasses RLS.
alter table public.meta_ads_daily enable row level security;

drop policy if exists "Public read access" on public.meta_ads_daily;
create policy "Public read access"
  on public.meta_ads_daily
  for select
  to anon, authenticated
  using (true);
