-- Add option_value column to products table
alter table products add column if not exists option_value text default '옵션없음';
