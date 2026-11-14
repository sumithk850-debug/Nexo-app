create table if not exists public.news_editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null unique,
  status text not null default 'published' check (status in ('draft', 'published', 'failed')),
  headline text not null default 'Daily News Summarization by Kyvorix AI',
  intro text not null default 'A clear, calm briefing of the stories shaping the world today.',
  generated_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.news_editions(id) on delete cascade,
  category text not null check (category in ('World', 'Technology', 'Science', 'Business', 'Culture', 'Climate')),
  title text not null,
  summary text not null,
  source_name text not null,
  source_url text not null,
  image_url text,
  published_at timestamptz,
  source_guid text not null,
  rank integer not null default 0 check (rank >= 0 and rank <= 1000),
  created_at timestamptz not null default now(),
  unique (edition_id, source_guid)
);

create index if not exists news_editions_published_idx
  on public.news_editions (status, edition_date desc);
create index if not exists news_articles_edition_rank_idx
  on public.news_articles (edition_id, rank asc, published_at desc);

alter table public.news_editions enable row level security;
alter table public.news_articles enable row level security;

drop policy if exists "Published news editions are readable" on public.news_editions;
create policy "Published news editions are readable"
  on public.news_editions for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Published news articles are readable" on public.news_articles;
create policy "Published news articles are readable"
  on public.news_articles for select to anon, authenticated
  using (
    exists (
      select 1 from public.news_editions e
      where e.id = edition_id and e.status = 'published'
    )
  );

grant select on public.news_editions, public.news_articles to anon, authenticated;
revoke insert, update, delete on public.news_editions, public.news_articles from anon, authenticated;
