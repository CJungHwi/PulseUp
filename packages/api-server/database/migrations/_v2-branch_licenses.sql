-- 지점별 운동 대분류 라이선스

CREATE TABLE IF NOT EXISTS branch_licenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  branch_id bigint(20) NOT NULL,
  workout_category_id CHAR(36) NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  granted_by CHAR(36) NOT NULL,
  status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_branch_category_from (branch_id, workout_category_id, valid_from),
  INDEX idx_branch_status (branch_id, status),
  INDEX idx_workout_category_id (workout_category_id),
  INDEX idx_valid_range (valid_from, valid_to)
) ENGINE=InnoDB COMMENT='지점별 운동 대분류 라이선스';
