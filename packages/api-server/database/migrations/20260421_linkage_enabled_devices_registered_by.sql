-- Electron 연동 사용 여부(users) + devices.registered_by 를 users.id(UUID)와 정합
-- 적용: mysql 클라이언트로 api-server DB에 실행

-- 1) 사용자: 연동 사용 여부 (기본 Y = TRUE)
ALTER TABLE users
  ADD COLUMN linkage_enabled BOOLEAN NOT NULL DEFAULT TRUE
  COMMENT 'Electron 웹 연동 사용 여부'
  AFTER used;

-- 2) 디바이스: registered_by INT → CHAR(36) (기존 잘못된 정수 값은 폐기)
ALTER TABLE devices DROP COLUMN registered_by;
ALTER TABLE devices
  ADD COLUMN registered_by CHAR(36) NULL
  COMMENT '등록한 사용자 users.id'
  AFTER registered_at,
  ADD INDEX idx_devices_registered_by (registered_by);
