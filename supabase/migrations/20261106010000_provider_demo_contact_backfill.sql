-- Fill every current provider listing with clearly fictional demo contact details.
-- Addresses use the existing neighborhood as the locality when available.
-- 202-555-0100 through 202-555-0199 are reserved fictional phone numbers.
with numbered as (
  select id, row_number() over (order by id) as n
  from public.providers
)
update public.providers as p
set address = format(
      '%s Demo Care Lane, %s, CA 90000',
      100 + numbered.n,
      coalesce(nullif(trim(p.neighborhood), ''), 'CareConnect Demo City')
    ),
    phone = format(
      '(202) 555-%s',
      lpad((100 + ((numbered.n - 1) % 100))::text, 4, '0')
    )
from numbered
where p.id = numbered.id;
