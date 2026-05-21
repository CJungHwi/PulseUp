-- Multi-Monitor Workout System Database Initialization
-- 이 스크립트는 데이터베이스와 사용자를 생성합니다

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS workout_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 사용자 생성 및 권한 부여 (선택사항)
-- CREATE USER IF NOT EXISTS 'workout_user'@'localhost' IDENTIFIED BY 'workout_password';
-- GRANT ALL PRIVILEGES ON workout_system.* TO 'workout_user'@'localhost';
-- FLUSH PRIVILEGES;

USE workout_system;

-- 기본 데이터 삽입 (선택사항)
-- 샘플 지점 데이터
INSERT INTO branches (id, name, region) VALUES 
(UUID(), '강남점', '서울'),
(UUID(), '홍대점', '서울'),
(UUID(), '부산센텀점', '부산'),
(UUID(), '대구동성로점', '대구');

-- 샘플 사용자 (테스트용)
-- INSERT INTO users (id, email, name, password, branch_id) VALUES 
-- (UUID(), 'admin@example.com', '관리자', '$2b$12$example_hashed_password', (SELECT id FROM branches WHERE name = '강남점' LIMIT 1));

-- 샘플 비디오 카테고리
-- INSERT INTO videos (id, title, description, category, youtube_url, duration, thumbnail_url) VALUES
-- (UUID(), '초보자를 위한 요가', '기본적인 요가 동작들을 배워보세요', '요가', 'https://youtube.com/watch?v=example1', 1800, 'https://img.youtube.com/vi/example1/maxresdefault.jpg'),
-- (UUID(), '홈트레이닝 기초', '집에서 할 수 있는 기본 운동', '홈트레이닝', 'https://youtube.com/watch?v=example2', 1200, 'https://img.youtube.com/vi/example2/maxresdefault.jpg'),
-- (UUID(), '유산소 운동 30분', '효과적인 유산소 운동 루틴', '유산소', 'https://youtube.com/watch?v=example3', 1800, 'https://img.youtube.com/vi/example3/maxresdefault.jpg');

SELECT 'Database initialization completed!' as status;