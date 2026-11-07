-- Store parent home addresses privately while leaving legacy neighborhood data intact.
create table if not exists public.parent_private_addresses (
  parent_id text primary key references public.parents(id) on delete cascade,
  address text
);

alter table public.parent_private_addresses enable row level security;
revoke all on public.parent_private_addresses from anon, authenticated;
grant select, insert, update, delete on public.parent_private_addresses to authenticated;

drop policy if exists "own private address read" on public.parent_private_addresses;
drop policy if exists "own private address insert" on public.parent_private_addresses;
drop policy if exists "own private address update" on public.parent_private_addresses;
drop policy if exists "own private address delete" on public.parent_private_addresses;
create policy "own private address read" on public.parent_private_addresses
  for select to authenticated using (parent_id = public.my_parent_id());
create policy "own private address insert" on public.parent_private_addresses
  for insert to authenticated with check (parent_id = public.my_parent_id());
create policy "own private address update" on public.parent_private_addresses
  for update to authenticated using (parent_id = public.my_parent_id())
  with check (parent_id = public.my_parent_id());
create policy "own private address delete" on public.parent_private_addresses
  for delete to authenticated using (parent_id = public.my_parent_id());

-- New sign-ups save the full address privately. The legacy neighborhood value
-- remains on parents for existing matching behavior and is not changed here.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $func$
declare
  m   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  pid text  := new.id::text;
  c   jsonb;
  s   jsonb;
  lang text;
begin
  insert into public.parents (id, auth_user_id, name, email, neighborhood, blurb)
  values (
    pid,
    new.id,
    coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(m->>'neighborhood'), ''),
    nullif(trim(m->>'blurb'), '')
  )
  on conflict (id) do nothing;

  insert into public.parent_private_addresses (parent_id, address)
  values (pid, nullif(trim(m->>'address'), ''))
  on conflict (parent_id) do update set address = excluded.address;

  for c in select * from jsonb_array_elements(coalesce(m->'children', '[]'::jsonb)) loop
    insert into public.children (parent_id, name, age)
    values (pid, coalesce(nullif(trim(c->>'name'), ''), 'Child'), nullif(c->>'age', '')::smallint);
  end loop;

  lang := nullif(trim(m->>'language'), '');
  if lang is not null then
    insert into public.languages (name) values (lang) on conflict (name) do nothing;
    insert into public.parent_languages (parent_id, language_id)
    select pid, id from public.languages where name = lang on conflict do nothing;
  end if;

  for s in select * from jsonb_array_elements(coalesce(m->'schedule', '[]'::jsonb)) loop
    insert into public.parent_availability (parent_id, day_of_week, block)
    values (pid, (s->>0)::smallint, (s->>1)::public.time_block) on conflict do nothing;
  end loop;

  return new;
end
$func$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
