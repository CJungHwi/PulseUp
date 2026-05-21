-- devices에 등록한 사용자 로그인 ID(users.userid)를 함께 저장
-- registered_by(users.id)만으로도 정합성은 유지하되, 조인 없이 등록자를 확인할 수 있게 한다.

ALTER TABLE devices
  ADD COLUMN registered_by_userid VARCHAR(100) NULL
  COMMENT '등록한 사용자 users.userid'
  AFTER registered_by,
  ADD INDEX idx_devices_registered_by_userid (registered_by_userid);

