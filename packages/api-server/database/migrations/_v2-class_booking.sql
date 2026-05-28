-- 지점별 수업 슬롯/예약

CREATE TABLE IF NOT EXISTS class_slots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  branch_id bigint(20) NOT NULL,
  workout_category_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  recurrence_rule VARCHAR(255) NULL,
  created_by CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch_start (branch_id, start_at),
  INDEX idx_workout_category_id (workout_category_id),
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB COMMENT='지점별 수업 슬롯';

CREATE TABLE IF NOT EXISTS class_bookings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  slot_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  branch_id bigint(20) NOT NULL,
  status ENUM('reserved','cancelled','attended','noshow') NOT NULL DEFAULT 'reserved',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_slot_user (slot_id, user_id),
  INDEX idx_slot_id (slot_id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_branch_status (branch_id, status)
) ENGINE=InnoDB COMMENT='지점별 사용자 수업 예약';
