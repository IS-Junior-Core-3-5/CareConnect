-- OKR 2: track how often families rebook the same provider.
-- Adds one table kept up to date automatically from care_bookings, plus two summary views.
-- Safe to apply to the live project: it adds objects and does not change or delete existing data.

-- ---------------------------------------------------------------------
-- 1. rebook_tracking: one row per parent + provider pair
--    A booking counts once the provider confirms it.
-- ---------------------------------------------------------------------
create table public.rebook_tracking (
  parent_id            text not null references public.parents(id)   on delete cascade,
  provider_id          text not null references public.providers(id) on delete cascade,
  confirmed_bookings   integer not null default 0 check (confirmed_bookings >= 0),
  rebook_count         integer generated always as (greatest(confirmed_bookings - 1, 0)) stored,
  is_rebooking         boolean generated always as (confirmed_bookings > 1) stored,
  first_care_date      date,
  last_care_date       date,
  updated_at           timestamptz not null default now(),
  primary key (parent_id, provider_id)
);

create index rebook_tracking_provider on public.rebook_tracking (provider_id);

comment on table public.rebook_tracking is
  'How many confirmed bookings each family has made with each provider. is_rebooking = booked the same provider more than once. Maintained by a trigger on care_bookings; do not edit by hand.';

-- Recalculate one parent + provider pair from care_bookings.
create or replace function public.refresh_rebook_tracking(p_parent text, p_provider text)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int; first_d date; last_d date;
begin
  select count(*), min(care_date), max(care_date) into n, first_d, last_d
  from public.care_bookings
  where parent_id = p_parent and provider_id = p_provider and status = 'confirmed';

  if n = 0 then
    delete from public.rebook_tracking where parent_id = p_parent and provider_id = p_provider;
  else
    insert into public.rebook_tracking as r (parent_id, provider_id, confirmed_bookings, first_care_date, last_care_date, updated_at)
    values (p_parent, p_provider, n, first_d, last_d, now())
    on conflict (parent_id, provider_id) do update
      set confirmed_bookings = excluded.confirmed_bookings,
          first_care_date    = excluded.first_care_date,
          last_care_date     = excluded.last_care_date,
          updated_at         = now();
  end if;
end $$;

create or replace function public.care_bookings_rebook_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_rebook_tracking(new.parent_id, new.provider_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_rebook_tracking(old.parent_id, old.provider_id);
  end if;
  return null;
end $$;

create trigger care_bookings_rebook_tracking
  after insert or update or delete on public.care_bookings
  for each row execute function public.care_bookings_rebook_trigger();

-- Fill in from bookings that already exist.
insert into public.rebook_tracking (parent_id, provider_id, confirmed_bookings, first_care_date, last_care_date)
select parent_id, provider_id, count(*), min(care_date), max(care_date)
from public.care_bookings
where status = 'confirmed'
group by parent_id, provider_id;

-- ---------------------------------------------------------------------
-- 2. Summary views
-- ---------------------------------------------------------------------
-- Per provider: how many families booked them, how many came back.
create view public.provider_rebook_rates with (security_invoker = true) as
select p.id as provider_id,
       p.name as provider_name,
       count(r.parent_id)::int                               as families_booked,
       count(r.parent_id) filter (where r.is_rebooking)::int as families_rebooked,
       coalesce(sum(r.confirmed_bookings), 0)::int           as confirmed_bookings,
       case when count(r.parent_id) = 0 then null
            else round(100.0 * count(r.parent_id) filter (where r.is_rebooking) / count(r.parent_id), 1)
       end                                                   as rebook_rate_pct
from public.providers p
left join public.rebook_tracking r on r.provider_id = p.id
group by p.id, p.name;

-- Per parent: how often this family rebooks.
create view public.parent_rebook_summary with (security_invoker = true) as
select r.parent_id,
       count(*)::int                                  as providers_booked,
       count(*) filter (where r.is_rebooking)::int    as providers_rebooked,
       sum(r.confirmed_bookings)::int                 as confirmed_bookings,
       sum(r.rebook_count)::int                       as total_rebookings,
       max(r.last_care_date)                          as last_care_date
from public.rebook_tracking r
group by r.parent_id;

-- ---------------------------------------------------------------------
-- 3. Security: read-only for the people involved; only the trigger writes.
-- ---------------------------------------------------------------------
alter table public.rebook_tracking enable row level security;

create policy "rebook participants read" on public.rebook_tracking
  for select to authenticated using (
    parent_id = public.my_parent_id() or exists (
      select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()
    )
  );

revoke all on public.rebook_tracking from anon, authenticated;
grant select on public.rebook_tracking to authenticated;
revoke all on public.provider_rebook_rates, public.parent_rebook_summary from anon;
grant select on public.provider_rebook_rates, public.parent_rebook_summary to authenticated;
revoke execute on function public.refresh_rebook_tracking(text, text) from public, anon, authenticated;
revoke execute on function public.care_bookings_rebook_trigger() from public, anon, authenticated;
