create table public.token_pool_settings (
  id boolean primary key default true check (id),
  monthly_token_budget bigint not null default 100000 check (monthly_token_budget >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.token_pool_settings (id, monthly_token_budget)
values (true, 100000)
on conflict (id) do nothing;

alter table public.profiles alter column monthly_token_quota set default 0;

alter table public.token_pool_settings enable row level security;

create policy "Active administrators can read token pool settings"
on public.token_pool_settings for select
to authenticated
using ((select public.is_admin()));

create function public.manage_profile_token_allocation(
  target_user_id uuid,
  next_quota bigint,
  next_role public.app_role,
  next_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pool_budget bigint;
  allocated bigint;
begin
  if next_quota < 0 then
    raise exception 'Monthly token limit must be non-negative';
  end if;

  lock table public.profiles in share row exclusive mode;

  select monthly_token_budget into pool_budget
  from public.token_pool_settings
  where id = true
  for update;

  select coalesce(sum(monthly_token_quota), 0) into allocated
  from public.profiles
  where id <> target_user_id
    and role = 'user'
    and is_active;

  if next_role = 'user' and next_is_active then
    allocated := allocated + next_quota;
  end if;

  if allocated > pool_budget then
    raise exception 'User limits exceed the shared monthly pool by % tokens', allocated - pool_budget;
  end if;

  update public.profiles
  set monthly_token_quota = next_quota,
      role = next_role,
      is_active = next_is_active
  where id = target_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;
end;
$$;

create function public.set_monthly_token_budget(next_budget bigint, actor_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocated bigint;
begin
  if next_budget < 0 then
    raise exception 'Monthly token pool must be non-negative';
  end if;

  lock table public.profiles in share row exclusive mode;

  select coalesce(sum(monthly_token_quota), 0) into allocated
  from public.profiles
  where role = 'user' and is_active;

  if allocated > next_budget then
    raise exception 'The monthly pool cannot be lower than the % tokens currently assigned to active users', allocated;
  end if;

  update public.token_pool_settings
  set monthly_token_budget = next_budget,
      updated_at = now(),
      updated_by = actor_user_id
  where id = true;
end;
$$;

revoke all on function public.manage_profile_token_allocation(uuid, bigint, public.app_role, boolean) from public, anon, authenticated;
revoke all on function public.set_monthly_token_budget(bigint, uuid) from public, anon, authenticated;
grant execute on function public.manage_profile_token_allocation(uuid, bigint, public.app_role, boolean) to service_role;
grant execute on function public.set_monthly_token_budget(bigint, uuid) to service_role;

create or replace function public.current_quota_summary()
returns table (used bigint, reserved bigint, quota_limit bigint, remaining bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles;
  pool_budget bigint;
  regular_allocated bigint;
begin
  select * into current_profile
  from public.profiles
  where id = (select auth.uid()) and is_active;

  if current_profile.id is null then
    raise exception 'Active user profile required';
  end if;

  if current_profile.role = 'admin' then
    select monthly_token_budget into pool_budget
    from public.token_pool_settings
    where id = true;

    select coalesce(sum(monthly_token_quota), 0) into regular_allocated
    from public.profiles
    where role = 'user' and is_active;

    select
      coalesce(sum(total_tokens) filter (where status in ('succeeded', 'failed')), 0),
      coalesce(sum(reserved_tokens) filter (where status = 'reserved'), 0)
    into used, reserved
    from public.usage_events
    where user_id in (select id from public.profiles where role = 'admin')
      and created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month';

    quota_limit := greatest(0, pool_budget - regular_allocated);
  else
    select
      coalesce(sum(total_tokens) filter (where status in ('succeeded', 'failed')), 0),
      coalesce(sum(reserved_tokens) filter (where status = 'reserved'), 0)
    into used, reserved
    from public.usage_events
    where user_id = current_profile.id
      and created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month';

    quota_limit := current_profile.monthly_token_quota;
  end if;

  remaining := greatest(0, quota_limit - used - reserved);
  return next;
end;
$$;

revoke all on function public.current_quota_summary() from public, anon;
grant execute on function public.current_quota_summary() to authenticated;

create or replace function public.reserve_usage(
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
  effective_quota bigint;
  pool_budget bigint;
  regular_allocated bigint;
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

  if current_profile.role = 'admin' then
    select monthly_token_budget into pool_budget
    from public.token_pool_settings
    where id = true
    for update;

    select coalesce(sum(monthly_token_quota), 0) into regular_allocated
    from public.profiles
    where role = 'user' and is_active;

    effective_quota := greatest(0, pool_budget - regular_allocated);

    select
      coalesce(sum(total_tokens) filter (where status in ('succeeded', 'failed')), 0),
      coalesce(sum(reserved_tokens) filter (where status = 'reserved'), 0)
    into consumed, reserved
    from public.usage_events
    where user_id in (select id from public.profiles where role = 'admin')
      and created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month';
  else
    effective_quota := current_profile.monthly_token_quota;

    select
      coalesce(sum(total_tokens) filter (where status in ('succeeded', 'failed')), 0),
      coalesce(sum(reserved_tokens) filter (where status = 'reserved'), 0)
    into consumed, reserved
    from public.usage_events
    where user_id = current_profile.id
      and created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month';
  end if;

  if consumed + reserved + requested_tokens > effective_quota then
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
