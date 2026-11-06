-- Add sourced directory entries without reusing demo provider identities.
alter table public.providers add column if not exists listing_origin text not null default 'owned'
  check (listing_origin in ('owned', 'external', 'sample'));
alter table public.providers add column if not exists is_public boolean not null default true;
alter table public.providers add column if not exists website_url text;
alter table public.providers add column if not exists contact_url text;
alter table public.providers add column if not exists source_url text;
alter table public.providers add column if not exists checked_on date;

-- Only the original demo IDs are archived; foreign keys and user data remain intact.
update public.providers set listing_origin = 'sample', is_public = false
where id in ('maya-okafor', 'daniel-reyes', 'sunny-meadows', 'little-lantern',
  'grace-lindqvist', 'harborview-kids', 'tomas-albright', 'willow-bend')
  and owner_id is null;

-- Hide archived rows from all directory readers, including recommendation queries.
create policy "visible provider listings" on public.providers
  as restrictive for select to anon, authenticated
  using (is_public);

insert into public.providers
  (id, name, care_type, blurb, bio, address, distance_miles, verified,
   schedule_available, schedule_summary, photo_key, listing_origin, website_url,
   contact_url, phone, source_url, checked_on)
values
  ('guardian-angel-babysitting-utah', 'Guardian Angel Babysitting', 'Sitter',
   'Babysitting service that lists Provo among its Utah service areas.',
   'Guardian Angel Babysitting offers sitter reservations for families in Provo. Contact the business to confirm current service and terms.',
   'Provo service area', null, false, false, null, null, 'external',
   'https://www.guardianangelbaby.com/utah', 'https://www.guardianangelbaby.com/utah',
   '435-640-1229', 'https://www.guardianangelbaby.com/utah', '2026-11-06'),
  ('les-petits-provo', 'Les Petits Childcare & Preschool', 'Daycare',
   'Childcare and preschool at 795 West Center Street in Provo.',
   'Les Petits invites families to call or text for information and in-person tours. Confirm current enrollment and terms directly with the business.',
   '795 West Center Street, Provo, UT', null, false, false, null, null, 'external',
   'https://lespetitsprovo.com/', 'https://lespetitsprovo.com/contact-us',
   '801-360-0827', 'https://lespetitsprovo.com/contact-us', '2026-11-06'),
  ('kids-village-orem', 'Kids Village', 'Preschool',
   'Private preschool in Orem with an official tour request page.',
   'Kids Village offers preschool programs in Orem. Families can request a tour and confirm current enrollment and terms with the school.',
   'Orem, UT', null, false, false, null, null, 'external',
   'https://kidsvillage.com/', 'https://kidsvillage.com/schedule-a-tour/',
   '801-235-9999', 'https://kidsvillage.com/', '2026-11-06')
on conflict (id) do nothing;

-- Listing owners cannot turn an external or archived entry into their own listing.
create or replace function public.guard_provider_directory_fields()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' and (new.listing_origin <> 'owned' or not new.is_public) then
      raise exception 'Only provider-owned public listings may be created';
    end if;
    if tg_op = 'UPDATE' and (new.listing_origin is distinct from old.listing_origin
        or new.is_public is distinct from old.is_public) then
      raise exception 'Listing origin and visibility cannot be changed by listing owners';
    end if;
  end if;
  return new;
end $$;
create trigger guard_provider_directory_fields_trigger before insert or update on public.providers
  for each row execute function public.guard_provider_directory_fields();
