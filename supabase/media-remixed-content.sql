-- Media Remixed content uses user JWTs and explicit editor assignments.
create table public.portal_content_editors (
  site_id text not null references public.portal_analytics_sites(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(site_id,user_id)
);
create index portal_content_editors_user_idx on public.portal_content_editors(user_id);
create table public.portal_web_published (
  site_id text primary key references public.portal_analytics_sites(id),
  content jsonb not null check (jsonb_typeof(content)='object' and octet_length(content::text)<750000),
  revision text not null check (revision ~ '^[a-f0-9]{40}$'),
  updated_at timestamptz not null default now()
);
create table public.portal_web_drafts (
  site_id text primary key references public.portal_web_published(site_id),
  content jsonb not null check (jsonb_typeof(content)='object' and octet_length(content::text)<750000),
  revision text not null check (revision ~ '^[a-f0-9]{40}$'),
  base_revision text not null,
  uploads jsonb not null default '[]',
  saved_at timestamptz not null default now()
);
create table public.portal_web_history (
  site_id text not null references public.portal_web_published(site_id),
  revision text not null,
  content jsonb not null,
  published_at timestamptz not null default now(),
  primary key(site_id,revision)
);
create index portal_web_history_date_idx on public.portal_web_history(site_id,published_at desc);
create table public.portal_web_assets (
  site_id text not null references public.portal_web_published(site_id),
  path text not null check(path ~ '^public/images/uploads/[a-f0-9-]{36}\.webp$'),
  body_base64 text not null check(length(body_base64) between 16 and 2000000 and body_base64 ~ '^[A-Za-z0-9+/]+=*$'),
  published boolean not null default false,
  primary key(site_id,path)
);

alter table public.portal_content_editors enable row level security;
alter table public.portal_web_published enable row level security;
alter table public.portal_web_drafts enable row level security;
alter table public.portal_web_history enable row level security;
alter table public.portal_web_assets enable row level security;
revoke all on public.portal_content_editors,public.portal_web_published,public.portal_web_drafts,public.portal_web_history,public.portal_web_assets from anon,authenticated;
grant select on public.portal_content_editors to authenticated;
grant select on public.portal_web_published,public.portal_web_assets to anon,authenticated;
grant select,insert,update on public.portal_web_drafts,public.portal_web_history to authenticated;
grant insert,update on public.portal_web_assets to authenticated;
grant update on public.portal_web_published to authenticated;
grant all on public.portal_content_editors,public.portal_web_published,public.portal_web_drafts,public.portal_web_history,public.portal_web_assets to service_role;
create policy content_editors_self on public.portal_content_editors for select to authenticated using (user_id=(select auth.uid()));
create policy web_published_public on public.portal_web_published for select to anon,authenticated using (true);
create policy web_published_editors on public.portal_web_published for update to authenticated
  using (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())))
  with check (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));
create policy web_drafts_editors on public.portal_web_drafts for all to authenticated
  using (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())))
  with check (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));
create policy web_history_editors on public.portal_web_history for all to authenticated
  using (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())))
  with check (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));
create policy web_assets_public on public.portal_web_assets for select to anon using (published);
create policy web_assets_read on public.portal_web_assets for select to authenticated
  using (published or site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));
create policy web_assets_insert on public.portal_web_assets for insert to authenticated
  with check (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));
create policy web_assets_update on public.portal_web_assets for update to authenticated
  using (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())))
  with check (site_id in (select site_id from public.portal_content_editors where user_id=(select auth.uid())));

create function public.portal_web_state(p_site text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare p public.portal_web_published; d public.portal_web_drafts; has_draft boolean;
begin
  if not exists(select 1 from public.portal_content_editors where site_id=p_site and user_id=(select auth.uid())) then
    raise exception 'Website access denied' using errcode='42501';
  end if;
  select * into p from public.portal_web_published where site_id=p_site;
  select * into d from public.portal_web_drafts where site_id=p_site;
  has_draft := d.revision is not null and d.revision<>p.revision;
  return jsonb_build_object('content',case when has_draft then d.content else p.content end,
    'mainSha',p.revision,'draftSha',d.revision,'hasDraft',has_draft,
    'baseMainSha',case when has_draft then d.base_revision else p.revision end,
    'savedAt',case when has_draft then d.saved_at else null end,
    'stale',has_draft and d.base_revision<>p.revision,
    'uploads',case when has_draft then d.uploads else '[]'::jsonb end);
end; $$;

create function public.portal_web_save_draft(p_site text,p_content jsonb,p_draft_revision text,p_base_revision text,p_assets jsonb,p_upload_paths jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.portal_web_published; d public.portal_web_drafts; a jsonb; rev text;
begin
  if not exists(select 1 from public.portal_content_editors where site_id=p_site and user_id=(select auth.uid())) then
    raise exception 'Website access denied' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-content:'||p_site,0));
  select * into p from public.portal_web_published where site_id=p_site for update;
  select * into d from public.portal_web_drafts where site_id=p_site;
  if p.revision is null or p_base_revision<>p.revision or p_draft_revision is distinct from d.revision then
    raise exception 'Draft or published content changed; reload before saving' using errcode='40001';
  end if;
  if jsonb_typeof(p_content)<>'object' or jsonb_typeof(p_assets)<>'array' or jsonb_array_length(p_assets)>8
     or jsonb_typeof(p_upload_paths)<>'array' or jsonb_array_length(p_upload_paths)>300 then
    raise exception 'Invalid content or images' using errcode='22023';
  end if;
  for a in select value from jsonb_array_elements(p_assets) loop
    if substring(decode(a->>'base64','base64') from 1 for 4)<>decode('52494646','hex')
      or substring(decode(a->>'base64','base64') from 9 for 4)<>decode('57454250','hex') then
      raise exception 'Invalid WebP image' using errcode='22023';
    end if;
    if exists(select 1 from public.portal_web_assets where site_id=p_site and path=a->>'path' and body_base64<>a->>'base64') then
      raise exception 'Image already exists; upload a new image' using errcode='40001';
    end if;
    insert into public.portal_web_assets(site_id,path,body_base64) values(p_site,a->>'path',a->>'base64') on conflict do nothing;
  end loop;
  if exists(select 1 from jsonb_array_elements_text(p_upload_paths) f(path) where not exists(select 1 from public.portal_web_assets a where a.site_id=p_site and a.path=f.path)) then
    raise exception 'A draft photo could not be found' using errcode='22023';
  end if;
  rev := md5(gen_random_uuid()::text)||substr(md5(gen_random_uuid()::text),1,8);
  insert into public.portal_web_drafts(site_id,content,revision,base_revision,uploads,saved_at)
    values(p_site,p_content,rev,p.revision,p_upload_paths,now())
    on conflict(site_id) do update set content=excluded.content,revision=excluded.revision,base_revision=excluded.base_revision,uploads=excluded.uploads,saved_at=excluded.saved_at;
  return public.portal_web_state(p_site);
end; $$;

create function public.portal_web_publish(p_site text,p_draft_revision text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.portal_web_published; d public.portal_web_drafts;
begin
  if not exists(select 1 from public.portal_content_editors where site_id=p_site and user_id=(select auth.uid())) then
    raise exception 'Website access denied' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-content:'||p_site,0));
  select * into p from public.portal_web_published where site_id=p_site for update;
  select * into d from public.portal_web_drafts where site_id=p_site;
  if d.revision is null or d.revision is distinct from p_draft_revision or d.base_revision<>p.revision or d.revision=p.revision then
    raise exception 'Draft or published content changed; reload before publishing' using errcode='40001';
  end if;
  update public.portal_web_assets set published=true where site_id=p_site and path in(select jsonb_array_elements_text(d.uploads));
  update public.portal_web_published set content=d.content,revision=d.revision,updated_at=now() where site_id=p_site;
  insert into public.portal_web_history(site_id,revision,content) values(p_site,d.revision,d.content) on conflict do nothing;
  return jsonb_build_object('mainSha',d.revision,'message','Your changes are live. Refresh the website to see them.');
end; $$;

revoke all on function public.portal_web_state(text),public.portal_web_save_draft(text,jsonb,text,text,jsonb,jsonb),public.portal_web_publish(text,text) from public,anon;
grant execute on function public.portal_web_state(text),public.portal_web_save_draft(text,jsonb,text,text,jsonb,jsonb),public.portal_web_publish(text,text) to authenticated;
