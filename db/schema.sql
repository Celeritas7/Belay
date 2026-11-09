-- Belay owns only these objects. Existing applications are unchanged.
create table public.belay_reference (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.belay_reference enable row level security;
revoke all on public.belay_reference from anon, authenticated;
grant select on public.belay_reference to authenticated;
create policy belay_reference_read on public.belay_reference for select to authenticated using (true);

create table public.belay_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and
    data ?& array['skills','jobs','work','log','settings','cOver','cAI','coach'] and
    jsonb_typeof(data->'skills') = 'array' and jsonb_typeof(data->'jobs') = 'array' and
    jsonb_typeof(data->'work') = 'array' and jsonb_typeof(data->'log') = 'array' and
    jsonb_typeof(data->'settings') = 'object' and jsonb_typeof(data->'cOver') = 'object' and
    jsonb_typeof(data->'cAI') = 'object' and jsonb_typeof(data->'coach') = 'object'
  ),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
comment on table public.belay_state is 'Belay user records: skills, jobs, work, practice log, settings, coach notes and country overrides. Edit data through SQL or the app; the version trigger prevents stale browser overwrites.';
alter table public.belay_state enable row level security;
revoke all on public.belay_state from anon, authenticated;
grant select, insert, update on public.belay_state to authenticated;
create policy belay_state_read on public.belay_state for select to authenticated using ((select auth.uid()) = user_id);
create policy belay_state_insert on public.belay_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy belay_state_update on public.belay_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.belay_touch_state() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.belay_touch_state() from public, anon, authenticated;
create trigger belay_state_version before update on public.belay_state for each row execute function public.belay_touch_state();

create function public.belay_save_state(p_data jsonb, p_version bigint) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_version bigint;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_version = 0 then
    insert into public.belay_state(user_id,data) values(auth.uid(),p_data)
    on conflict (user_id) do nothing returning version into v_version;
  else
    update public.belay_state set data=p_data where user_id=auth.uid() and version=p_version returning version into v_version;
  end if;
  if v_version is null then raise exception 'BELAY_CONFLICT: Newer data exists. Export your changes and reload.' using errcode='P0001'; end if;
  return jsonb_build_object('version',v_version);
end;
$$;
revoke all on function public.belay_save_state(jsonb,bigint) from public, anon;
grant execute on function public.belay_save_state(jsonb,bigint) to authenticated;

create function public.belay_cost_summary() returns table(m text,c text,s bigint,n bigint)
language sql stable security invoker set search_path = '' as $$
  select to_char(date,'YYYY-MM'), coalesce(category,'Other'), sum(amount)::bigint, count(*)
  from public.cost_management_expenses
  where user_id=(select auth.uid()) and region='JPY' and coalesce(expense_type,'') <> 'outlier'
    and date >= date_trunc('month',current_date)-interval '12 months'
  group by 1,2 order by 1,2;
$$;
revoke all on function public.belay_cost_summary() from public, anon;
grant execute on function public.belay_cost_summary() to authenticated;
