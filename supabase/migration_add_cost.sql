-- Add cost column to products table
alter table products add column if not exists cost integer default 0;
