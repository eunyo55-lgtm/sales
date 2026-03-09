-- keyword_search_volumes table
create table if not exists keyword_search_volumes (
  id uuid default uuid_generate_v4() primary key,
  keyword text not null,
  mobile_volume integer not null default 0,
  pc_volume integer not null default 0,
  total_volume integer not null default 0,
  target_date date not null default current_date,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(keyword, target_date)
);

-- Enable RLS
alter table keyword_search_volumes enable row level security;

-- Policies (Public access for simplicity like others in this project)
create policy "Allow all access to keyword_search_volumes" on keyword_search_volumes for all using (true) with check (true);
