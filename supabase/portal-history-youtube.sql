-- Imported provider aggregates remain private to each assigned client.
create table public.portal_analytics_imports (
  site_id text not null references public.portal_analytics_sites(id),
  source text not null check(source='netlify'),
  from_date date not null,
  to_date date not null check(to_date>=from_date),
  imported_at timestamptz not null default now(),
  data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<750000),
  primary key(site_id,source,from_date,to_date)
);
alter table public.portal_analytics_imports enable row level security;
revoke all on public.portal_analytics_imports from anon,authenticated;
grant select on public.portal_analytics_imports to authenticated;
grant all on public.portal_analytics_imports to service_role;
create policy analytics_imports_read_own on public.portal_analytics_imports for select to authenticated
  using(site_id in(select site_id from public.portal_site_memberships where user_id=(select auth.uid())));

-- Only the fixed YouTube feed function writes this public content cache.
create table public.portal_youtube_cache (
  site_id text primary key references public.portal_analytics_sites(id) check(site_id='media-remixed'),
  videos jsonb not null default '[]' check(jsonb_typeof(videos)='array' and jsonb_array_length(videos)<=500 and octet_length(videos::text)<7000000),
  fetched_at timestamptz not null default now()
);
alter table public.portal_youtube_cache enable row level security;
revoke all on public.portal_youtube_cache from anon,authenticated;
grant select on public.portal_youtube_cache to anon,authenticated;
grant all on public.portal_youtube_cache to service_role;
create policy youtube_public_read on public.portal_youtube_cache for select to anon,authenticated using(true);
