begin;
create table if not exists public.sms_signup_lock(id boolean primary key check(id));
insert into public.sms_signup_lock values(true) on conflict do nothing;
create table if not exists public.sms_signup_attempts(
  id bigint generated always as identity primary key,
  ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists sms_signup_attempts_time on public.sms_signup_attempts(created_at);
alter table public.sms_signup_lock enable row level security;
alter table public.sms_signup_attempts enable row level security;
revoke all on public.sms_signup_lock,public.sms_signup_attempts from public,anon,authenticated;
grant all on public.sms_signup_lock,public.sms_signup_attempts to service_role;
create or replace function public.admit_sms_signup(p_ip_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare total bigint; per_ip bigint;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allow',false,'reason','invalid_request');
  end if;
  -- Serialize across every application instance. Limits are rolling one hour.
  perform id from public.sms_signup_lock where id=true for update;
  if not found then return jsonb_build_object('allow',false,'reason','unavailable'); end if;
  delete from public.sms_signup_attempts where created_at<=now()-interval '1 hour';
  select count(*),count(*) filter(where ip_hash=p_ip_hash) into total,per_ip
    from public.sms_signup_attempts;
  if total>=40 or per_ip>=5 then
    return jsonb_build_object('allow',false,'reason','signup_limit');
  end if;
  insert into public.sms_signup_attempts(ip_hash) values(p_ip_hash);
  return jsonb_build_object('allow',true);
end;
$$;
revoke all on function public.admit_sms_signup(text) from public,anon,authenticated;
grant execute on function public.admit_sms_signup(text) to service_role;
commit;
