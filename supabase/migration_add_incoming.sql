-- Add 'incoming_stock' column to 'products' table for supply in progress
ALTER TABLE products ADD COLUMN IF NOT EXISTS incoming_stock INTEGER DEFAULT 0;
