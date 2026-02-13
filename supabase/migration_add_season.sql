-- Add season column to products table
alter table products add column if not exists season text default '정보없음';
