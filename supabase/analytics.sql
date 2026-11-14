-- Client analytics: deploy with a Supabase migration. No browser write access.
create table public.portal_analytics_sites (
  id text primary key,
  name text not null,
  tracking_started_at timestamptz not null default now()
);
create table public.portal_site_memberships (
  site_id text not null references public.portal_analytics_sites(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (site_id, user_id)
);
create index portal_memberships_user_idx on public.portal_site_memberships(user_id);
create table public.portal_analytics_events (
  id uuid primary key,
  site_id text not null references public.portal_analytics_sites(id),
  occurred_at timestamptz not null default now(),
  path text not null check (length(path) between 1 and 256 and path like '/%'),
  referrer text not null check (length(referrer) <= 253),
  device text not null check (device in ('Mobile', 'Tablet', 'Desktop')),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$')
);
create index portal_events_site_time_idx on public.portal_analytics_events(site_id, occurred_at);
create index portal_events_visitor_time_idx on public.portal_analytics_events(site_id, visitor_hash, occurred_at);
alter table public.portal_analytics_sites enable row level security;
alter table public.portal_site_memberships enable row level security;
alter table public.portal_analytics_events enable row level security;
revoke all on public.portal_analytics_sites, public.portal_site_memberships, public.portal_analytics_events from anon, authenticated;
grant select on public.portal_analytics_sites, public.portal_site_memberships, public.portal_analytics_events to authenticated;
grant all on public.portal_analytics_sites, public.portal_site_memberships, public.portal_analytics_events to service_role;
create policy memberships_read_self on public.portal_site_memberships for select to authenticated using (user_id = (select auth.uid()));
create policy analytics_sites_read_own on public.portal_analytics_sites for select to authenticated using (id in (select site_id from public.portal_site_memberships where user_id = (select auth.uid())));
create policy analytics_events_read_own on public.portal_analytics_events for select to authenticated using (site_id in (select site_id from public.portal_site_memberships where user_id = (select auth.uid())));

create function public.portal_record_view(p_id uuid, p_site text, p_path text, p_referrer text, p_device text, p_visitor text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_site || p_visitor, 0));
  if (select count(*) from public.portal_analytics_events where site_id = p_site and visitor_hash = p_visitor and occurred_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;
  insert into public.portal_analytics_events(id, site_id, path, referrer, device, visitor_hash)
  values (p_id, p_site, p_path, p_referrer, p_device, p_visitor) on conflict (id) do nothing;
  return true;
end;
$$;
revoke all on function public.portal_record_view(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.portal_record_view(uuid,text,text,text,text,text) to service_role;

create function public.portal_analytics(p_site text, p_days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  started timestamptz;
  first_day date;
  last_day date := (now() at time zone 'UTC')::date;
  result jsonb;
begin
  if p_days not in (7,30,90) then raise exception 'Invalid date range' using errcode = '22023'; end if;
  select tracking_started_at into started from public.portal_analytics_sites where id = p_site;
  if started is null then raise exception 'Website access denied' using errcode = '42501'; end if;
  first_day := greatest(last_day - (p_days - 1), (started at time zone 'UTC')::date);
  with events as materialized (
    select * from public.portal_analytics_events
    where site_id = p_site and occurred_at >= (first_day::timestamp at time zone 'UTC') and occurred_at <= now()
  ), days as (
    select g::date as day from pg_catalog.generate_series(first_day::timestamp, last_day::timestamp, interval '1 day') g
  ), daily as (
    select d.day, count(e.id) as views, count(distinct e.visitor_hash) as visitors
    from days d left join events e on (e.occurred_at at time zone 'UTC')::date = d.day group by d.day
  )
  select jsonb_build_object(
    'siteId', p_site, 'days', p_days, 'trackingStartedAt', started,
    'from', first_day, 'to', last_day, 'timezone', 'UTC', 'updatedAt', now(),
    'pageViews', (select count(*) from events),
    'averageDailyVisitors', coalesce((select round(avg(visitors),1) from daily),0),
    'pagesViewed', (select count(distinct path) from events),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date',day,'views',views,'visitors',visitors) order by day) from daily),'[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t) from (select path as label,count(*) as views from events group by path order by views desc, path limit 10) t),'[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t) from (select referrer as label,count(*) as views from events group by referrer order by views desc, referrer limit 10) t),'[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t) from (select device as label,count(*) as views from events group by device order by views desc, device) t),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.portal_analytics(text,integer) from public, anon;
grant execute on function public.portal_analytics(text,integer) to authenticated;
