-- Store geocoded coordinates only in the owner's private address row.
-- Provider records and provider address values are not changed.
begin;

alter table public.parent_private_addresses
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists geocoded_at timestamptz;

commit;
