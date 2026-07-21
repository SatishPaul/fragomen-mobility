create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'user');
create type public.usage_status as enum ('reserved', 'succeeded', 'failed', 'released');
create type public.publication_status as enum ('draft', 'uploading', 'processing', 'published', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.app_role not null default 'user',
  is_active boolean not null default true,
  monthly_token_quota bigint not null default 100000 check (monthly_token_quota >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null check (operation in ('analyze', 'script', 'tts', 'render')),
  provider text not null,
  model text,
  status public.usage_status not null,
  request_id text not null,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  total_tokens bigint check (total_tokens is null or total_tokens >= 0),
  characters bigint check (characters is null or characters >= 0),
  audio_seconds numeric check (audio_seconds is null or audio_seconds >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create unique index usage_events_request_provider_idx
  on public.usage_events (user_id, request_id, provider, coalesce(model, ''));
create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null default 'video/mp4',
  byte_size bigint not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  duration_seconds numeric not null check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint videos_owner_path check (storage_path like user_id::text || '/%')
);

create index videos_user_created_idx on public.videos (user_id, created_at desc);

create table public.social_account_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  outstand_account_id text not null unique,
  platform text not null,
  account_name text not null,
  account_metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (user_id, outstand_account_id)
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete restrict,
  idempotency_key text not null,
  caption text,
  status public.publication_status not null default 'draft',
  outstand_post_id text unique,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index publications_user_created_idx on public.publications (user_id, created_at desc);

create table public.publication_destinations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outstand_account_id text not null,
  platform text not null,
  status public.publication_status not null default 'draft',
  remote_post_id text,
  remote_url text,
  error_message text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (publication_id, outstand_account_id)
);

create index publication_destinations_user_idx on public.publication_destinations (user_id, updated_at desc);

create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  publication_destination_id uuid not null references public.publication_destinations(id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions bigint check (impressions is null or impressions >= 0),
  reach bigint check (reach is null or reach >= 0),
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  watch_seconds numeric check (watch_seconds is null or watch_seconds >= 0),
  raw_metrics jsonb not null default '{}'::jsonb,
  unique (publication_destination_id, captured_at)
);

create index analytics_snapshots_user_captured_idx on public.analytics_snapshots (user_id, captured_at desc);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload_sha256 text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger publications_set_updated_at before update on public.publications
for each row execute function public.set_updated_at();
create trigger publication_destinations_set_updated_at before update on public.publication_destinations
for each row execute function public.set_updated_at();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and is_active
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'user'::public.app_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_user_email_change();

create function public.reserve_usage(
  requested_operation text,
  requested_provider text,
  requested_model text,
  requested_tokens bigint,
  requested_request_id text
)
returns public.usage_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles;
  consumed bigint;
  reserved bigint;
  created_event public.usage_events;
begin
  if requested_tokens < 0 then
    raise exception 'Reserved tokens must be non-negative';
  end if;

  select * into current_profile
  from public.profiles
  where id = (select auth.uid()) and is_active
  for update;

  if current_profile.id is null then
    raise exception 'Active user profile required';
  end if;

  select
    coalesce(sum(total_tokens) filter (where status in ('succeeded', 'failed')), 0),
    coalesce(sum(reserved_tokens) filter (where status = 'reserved'), 0)
  into consumed, reserved
  from public.usage_events
  where user_id = current_profile.id
    and created_at >= date_trunc('month', now())
    and created_at < date_trunc('month', now()) + interval '1 month';

  if consumed + reserved + requested_tokens > current_profile.monthly_token_quota then
    raise exception 'Monthly token quota exceeded';
  end if;

  insert into public.usage_events (
    user_id, operation, provider, model, status, request_id, reserved_tokens
  ) values (
    current_profile.id,
    requested_operation,
    requested_provider,
    requested_model,
    'reserved',
    requested_request_id,
    requested_tokens
  ) returning * into created_event;

  return created_event;
end;
$$;

create function public.finalize_usage(
  event_id uuid,
  final_status public.usage_status,
  final_input_tokens bigint default null,
  final_output_tokens bigint default null,
  final_characters bigint default null,
  final_audio_seconds numeric default null,
  final_error_code text default null,
  final_metadata jsonb default '{}'::jsonb
)
returns public.usage_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_event public.usage_events;
begin
  if final_status not in ('succeeded', 'failed', 'released') then
    raise exception 'Usage event must be finalized to succeeded, failed, or released';
  end if;

  update public.usage_events
  set
    status = final_status,
    input_tokens = final_input_tokens,
    output_tokens = final_output_tokens,
    total_tokens = case
      when final_input_tokens is null and final_output_tokens is null then null
      else coalesce(final_input_tokens, 0) + coalesce(final_output_tokens, 0)
    end,
    characters = final_characters,
    audio_seconds = final_audio_seconds,
    reserved_tokens = 0,
    error_code = final_error_code,
    metadata = coalesce(final_metadata, '{}'::jsonb),
    finalized_at = now()
  where id = event_id
    and user_id = (select auth.uid())
    and status = 'reserved'
  returning * into updated_event;

  if updated_event.id is null then
    raise exception 'Active usage reservation not found';
  end if;

  return updated_event;
end;
$$;

alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;
alter table public.videos enable row level security;
alter table public.social_account_assignments enable row level security;
alter table public.publications enable row level security;
alter table public.publication_destinations enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.webhook_receipts enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select
using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles_update_self" on public.profiles for update
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
create policy "profiles_admin_update" on public.profiles for update
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "usage_select_self_or_admin" on public.usage_events for select
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "videos_select_self_or_admin" on public.videos for select
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "videos_insert_self" on public.videos for insert
with check (user_id = (select auth.uid()));
create policy "videos_update_self" on public.videos for update
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "videos_delete_self" on public.videos for delete
using (user_id = (select auth.uid()));

create policy "assignments_select_self_or_admin" on public.social_account_assignments for select
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "assignments_admin_all" on public.social_account_assignments for all
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "publications_select_self_or_admin" on public.publications for select
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "publications_insert_self" on public.publications for insert
with check (user_id = (select auth.uid()));
create policy "publications_update_self" on public.publications for update
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "destinations_select_self_or_admin" on public.publication_destinations for select
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "destinations_insert_self" on public.publication_destinations for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.publications
    where id = publication_id and user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.social_account_assignments
    where user_id = (select auth.uid())
      and outstand_account_id = publication_destinations.outstand_account_id
      and is_active
  )
);
create policy "destinations_update_self" on public.publication_destinations for update
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "analytics_select_self_or_admin" on public.analytics_snapshots for select
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "analytics_insert_self" on public.analytics_snapshots for insert
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.publication_destinations
    where id = publication_destination_id and user_id = (select auth.uid())
  )
);
create policy "audit_admin_select" on public.admin_audit_events for select
using ((select public.is_admin()));

grant execute on function public.is_admin() to authenticated;
grant execute on function public.reserve_usage(text, text, text, bigint, text) to authenticated;
grant execute on function public.finalize_usage(uuid, public.usage_status, bigint, bigint, bigint, numeric, text, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 524288000, array['video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "video_objects_select_self" on storage.objects for select to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "video_objects_insert_self" on storage.objects for insert to authenticated
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "video_objects_update_self" on storage.objects for update to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "video_objects_delete_self" on storage.objects for delete to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
