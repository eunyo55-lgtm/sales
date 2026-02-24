-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Products Table (Master Data + Inventory)
create table if not exists products (
  barcode text primary key,
  name text not null,
  option_code text,
  image_url text,
  current_stock integer default 0,
  fc_stock integer default 0,
  vf_stock integer default 0,
  hq_stock integer default 0,
  safety_stock integer default 10,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Daily Sales Table (Historical Sales)
create table if not exists daily_sales (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  barcode text references products(barcode),
  quantity integer default 0,
  fc_quantity integer default 0,
  vf_quantity integer default 0,
  revenue integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(date, barcode)
);

-- Enable Row Level Security (RLS)
alter table products enable row level security;
alter table daily_sales enable row level security;

-- Create policies (Allow exact match or public read/write for verified users)
-- For simplicity in this internal tool, we'll allow public access for now, 
-- but in production we should restrict this.
create policy "Allow all access to products" on products for all using (true) with check (true);
create policy "Allow all access to daily_sales" on daily_sales for all using (true) with check (true);
