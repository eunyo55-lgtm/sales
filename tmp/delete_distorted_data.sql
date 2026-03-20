-- 2026-03-12에 업로드된 2026-01-01 ~ 2026-01-08 기간의 데이터를 삭제합니다.
-- (사용자 확인 후 수동 실행 권장)

DELETE FROM coupang_orders 
WHERE order_date >= '2026-01-01' 
  AND order_date <= '2026-01-08'
  AND created_at::date = '2026-03-12';
