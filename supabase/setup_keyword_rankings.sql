-- keywords table
create table if not exists keywords (
  id uuid default uuid_generate_v4() primary key,
  barcode text references products(barcode),
  coupang_product_id text not null,
  keyword text not null,
  type text not null check (type in ('core', 'sub')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- keyword_rankings table
create table if not exists keyword_rankings (
  id uuid default uuid_generate_v4() primary key,
  keyword_id uuid references keywords(id) on delete cascade,
  date date not null,
  rank_position integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(keyword_id, date)
);

-- Enable RLS
alter table keywords enable row level security;
alter table keyword_rankings enable row level security;

-- Policies (Public access for simplicity like others)
create policy "Allow all access to keywords" on keywords for all using (true) with check (true);
create policy "Allow all access to keyword_rankings" on keyword_rankings for all using (true) with check (true);
