alter table public.announcements
  add column if not exists video_url text;

comment on column public.announcements.video_url is
  'Optional public MP4 URL rendered in the Kyvorix announcement modal and banner detail view.';
