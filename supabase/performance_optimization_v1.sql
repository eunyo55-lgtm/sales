-- 대시보드 및 성능 최적화 SQL (V1.0)
-- 이 스크립트를 Supabase SQL Editor에서 실행해 주세요.

-- 1. 날짜 기반 조회 및 정렬 성능 향상을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(date DESC);

-- 2. 상품별 최신 판매 내역 및 조인 성능 향상을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_sales_barcode_date ON daily_sales(barcode, date DESC);

-- 3. 상품 테이블 기본 인덱스 확인
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- 4. 전체 테이블을 스캔하지 않고 가장 최신 데이터 날짜를 즉시 반환하는 경량 RPC
CREATE OR REPLACE FUNCTION get_latest_data_date()
RETURNS date
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- 인덱스가 있으므로 이 쿼리는 매우 빠르게 실행됩니다.
  SELECT MAX(date) FROM daily_sales;
$$;
