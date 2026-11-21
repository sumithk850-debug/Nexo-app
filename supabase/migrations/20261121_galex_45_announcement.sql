alter table public.announcements
  add column if not exists image_url text;

comment on column public.announcements.image_url is
  'Optional public image URL rendered in the Kyvorix announcement modal and banner detail view.';

insert into public.announcements (title, message, version, image_url, is_active)
values (
  'Galex 4.5 is live',
  E'• Advanced reasoning with a faster, more capable response experience.\n• Stronger coding, research, writing, and multi-step task handling.\n• A refined KYVORIX experience with the new Galex 4.5 identity.\n\nCraft V5 remains available as a free user-specific trial with 1,000 tokens per day. Its allowance resets daily; Craft V3 Lite remains available when the V5 allowance is exhausted.',
  '4.5.0',
  '/galex-4-5-launch.png',
  true
);
***
