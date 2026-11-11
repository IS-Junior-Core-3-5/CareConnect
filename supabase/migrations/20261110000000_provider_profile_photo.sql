begin;

alter table public.providers add column profile_photo_path text;
alter table public.providers add constraint provider_profile_photo_owner
  check (profile_photo_path is null or (
    owner_id is not null and listing_origin = 'owned'
    and split_part(profile_photo_path, '/', 1) = owner_id::text
    and profile_photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
  ));

-- Auth account deletion sets owner_id to null and should still succeed.
create function public.clear_reassigned_provider_photo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    new.profile_photo_path := null;
  end if;
  return new;
end $$;

create trigger clear_reassigned_provider_photo before update of owner_id on public.providers
  for each row execute function public.clear_reassigned_provider_photo();

grant insert (profile_photo_path), update (profile_photo_path)
  on public.providers to authenticated;
grant select (profile_photo_path) on public.providers to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-profile-photos', 'provider-profile-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);

create policy "own provider photos insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'provider-profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
  );

create policy "own provider photos select" on storage.objects
  for select to authenticated using (
    bucket_id = 'provider-profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "own provider photos delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'provider-profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and not exists (
      select 1 from public.providers
      where profile_photo_path = storage.objects.name
    )
  );

commit;
