-- 1. 기존 중복 데이터 정리 (가장 최근에 입력된 데이터만 남김)
DELETE FROM coupang_orders a
USING coupang_orders b
WHERE a.id < b.id
  AND a.order_date = b.order_date
  AND a.barcode = b.barcode;

-- 2. 고유 제약 조건 추가 (이미 존재하는 경우 오류 방지를 위해 DO 블록 사용 가능하나, 여기서는 단순화)
-- 만약 이미 제약 조건이 있다면 아래 명령에서 에러가 날 수 있으므로, 제약 조건을 먼저 제거하고 다시 추가합니다.
ALTER TABLE coupang_orders DROP CONSTRAINT IF EXISTS coupang_orders_order_date_barcode_key;
ALTER TABLE coupang_orders ADD CONSTRAINT coupang_orders_order_date_barcode_key UNIQUE (order_date, barcode);

-- 3. 확인용 메시지
-- "준비 완료! 이제 발주서를 등록해 보세요."
