-- Add dated care requests alongside the existing recurring availability grids.
-- Apply to the existing CareConnect project; never rerun setup.sql on live data.
create table public.care_bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id text not null references public.parents(id) on delete cascade,
  provider_id text not null references public.providers(id) on delete cascade,
  care_date date not null,
  block public.time_block not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Several parents may ask, but only one booking can be confirmed per block.
create unique index care_bookings_one_confirmed_block
  on public.care_bookings (provider_id, care_date, block)
  where status = 'confirmed';
create unique index care_bookings_one_active_parent_request
  on public.care_bookings (parent_id, provider_id, care_date, block)
  where status in ('pending', 'confirmed');
create index care_bookings_parent_date on public.care_bookings (parent_id, care_date desc);
create index care_bookings_provider_date on public.care_bookings (provider_id, care_date desc);

create or replace function public.validate_care_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provider_owner uuid;
  provider_has_schedule boolean;
begin
  select owner_id, schedule_available into provider_owner, provider_has_schedule
  from public.providers where id = new.provider_id;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.care_date < current_date then
      raise exception 'New care requests must be pending and dated today or later';
    end if;
    if provider_owner is null or provider_owner = auth.uid() then
      raise exception 'Choose a provider who manages their own listing';
    end if;
    if not provider_has_schedule or not exists (
      select 1 from public.provider_availability a
      where a.provider_id = new.provider_id
        and a.day_of_week = extract(isodow from new.care_date)::int - 1
        and a.block = new.block
    ) then
      raise exception 'Provider is unavailable for this block';
    end if;
  else
    if (new.parent_id, new.provider_id, new.care_date, new.block, new.created_at)
       is distinct from
       (old.parent_id, old.provider_id, old.care_date, old.block, old.created_at) then
      raise exception 'A request cannot change its parent, provider, date, or time';
    end if;
    if auth.uid() = provider_owner then
      if old.status <> 'pending' or new.status not in ('confirmed', 'declined') then
        raise exception 'Provider can only confirm or decline a pending request';
      end if;
      if new.status = 'confirmed' and (
        new.care_date < current_date or not provider_has_schedule or not exists (
          select 1 from public.provider_availability a
          where a.provider_id = new.provider_id
            and a.day_of_week = extract(isodow from new.care_date)::int - 1
            and a.block = new.block
        )
      ) then
        raise exception 'Provider is unavailable for this block';
      end if;
    elsif old.parent_id = public.my_parent_id() then
      if old.status not in ('pending', 'confirmed') or new.status <> 'cancelled' then
        raise exception 'Parent can only cancel a pending or confirmed request';
      end if;
    else
      raise exception 'You cannot change this request';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger validate_care_booking_trigger
  before insert or update on public.care_bookings
  for each row execute function public.validate_care_booking();

alter table public.care_bookings enable row level security;
create policy "booking participants read" on public.care_bookings
  for select to authenticated using (
    parent_id = public.my_parent_id() or exists (
      select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()
    )
  );
create policy "parent requests care" on public.care_bookings
  for insert to authenticated with check (parent_id = public.my_parent_id());
create policy "booking participants update" on public.care_bookings
  for update to authenticated using (
    parent_id = public.my_parent_id() or exists (
      select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()
    )
  ) with check (
    parent_id = public.my_parent_id() or exists (
      select 1 from public.providers p where p.id = provider_id and p.owner_id = auth.uid()
    )
  );

revoke all on public.care_bookings from anon, authenticated;
grant select, insert (parent_id, provider_id, care_date, block), update (status)
  on public.care_bookings to authenticated;
revoke execute on function public.validate_care_booking() from public, anon, authenticated;
