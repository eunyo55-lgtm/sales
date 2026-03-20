-- 1. center 컬럼 추가 (기본값 'FC')
ALTER TABLE coupang_orders ADD COLUMN IF NOT EXISTS center VARCHAR DEFAULT 'FC';

-- 2. 기존 데이터의 center 값을 'FC'로 채우기 (이미 DEFAULT 설정으로 채워졌을 수 있으나 명시적 확인)
UPDATE coupang_orders SET center = 'FC' WHERE center IS NULL;

-- 3. 기존 고유 제약 조건 제거 (날짜 + 바코드)
ALTER TABLE coupang_orders DROP CONSTRAINT IF EXISTS coupang_orders_order_date_barcode_key;

-- 4. 새로운 고유 제약 조건 추가 (날짜 + 바코드 + 센터)
-- 중복 데이터가 있을 경우 에러가 날 수 있으므로, 중복 데이터를 먼저 정리합니다.
DELETE FROM coupang_orders a
USING coupang_orders b
WHERE a.id < b.id
  AND a.order_date = b.order_date
  AND a.barcode = b.barcode
  AND a.center = b.center;

ALTER TABLE coupang_orders ADD CONSTRAINT coupang_orders_order_date_barcode_center_key UNIQUE (order_date, barcode, center);
