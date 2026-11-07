-- Add two sourced external profiles without changing existing listings or their references.
-- Published program and operating hours live in the app's sourced profile catalog.
insert into public.providers
  (id, name, care_type, blurb, bio, address, phone, listing_origin,
   is_public, verified, schedule_available, website_url, contact_url, source_url, checked_on)
values
  ('montessori-learning-center-lindon', 'Montessori Learning Center', 'Preschool',
   'Montessori preschool in Lindon with several weekly program options.',
   'Montessori Learning Center lists junior and senior preschool programs in Lindon. Families can arrange a tour and ask about enrollment.',
   '310 S. 400 W., Lindon, UT 84042', '801-369-2120', 'external',
   true, false, false, 'https://montessoriutah.com/', 'https://montessoriutah.com/schedule-a-tour/',
   'https://montessoriutah.com/', '2026-11-06'),
  ('way-to-grow-american-fork', 'Way to Grow', 'Daycare',
   'Childcare and preschool center in American Fork with published weekday hours.',
   'Way to Grow offers childcare and preschool in American Fork. Families can contact the center to arrange a tour and confirm current openings.',
   '218 N. Center St., American Fork, UT 84003', '801-692-1235', 'external',
   true, false, false, 'https://kidswaytogrow.com/', 'https://kidswaytogrow.com/contact/',
   'https://kidswaytogrow.com/', '2026-11-06')
on conflict (id) do nothing;
