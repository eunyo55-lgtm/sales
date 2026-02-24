alter table products add column fc_stock integer default 0;
alter table products add column vf_stock integer default 0;
alter table daily_sales add column fc_quantity integer default 0;
alter table daily_sales add column vf_quantity integer default 0;