-- 프로시저 정의 확인
SHOW CREATE PROCEDURE sp_insert_heart_rate_data;

-- 테이블 구조 확인
SHOW CREATE TABLE heart_rate_data;

-- 실제 데이터 확인 (최근 10개)
SELECT * FROM heart_rate_data 
ORDER BY created_at DESC 
LIMIT 10;

