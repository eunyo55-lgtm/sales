-- App Settings Table for storing API Keys and other configurations
create table if not exists app_settings (
  id uuid default uuid_generate_v4() primary key,
  key text unique not null,
  value text not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table app_settings enable row level security;

-- Only allow authenticated users to manage settings
-- For this simple internal tool, we allow all for now but should be restricted in prod
create policy "Allow all access to app_settings" on app_settings for all using (true) with check (true);

-- Insert placeholders for Coupang Ad API
insert into app_settings (key, value, description) 
values 
('COUPANG_AD_ACCESS_KEY', '', 'Coupang Advertising API Access Key'),
('COUPANG_AD_SECRET_KEY', '', 'Coupang Advertising API Secret Key'),
('COUPANG_AD_CUSTOMER_ID', '', 'Coupang Advertising API Customer ID')
on conflict (key) do nothing;
