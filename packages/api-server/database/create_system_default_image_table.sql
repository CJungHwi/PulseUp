-- 시스템 기본 이미지 테이블
-- 목적: admin이 설정하는 시스템 전체 공통 좌/우측 기본 이미지 저장
-- 적용: 수동으로 DB에 실행
-- 의존: 없음 (users FK 불필요)

CREATE TABLE IF NOT EXISTS system_default_image (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    side VARCHAR(10) NOT NULL COMMENT 'left/right',
    image_url VARCHAR(2048) NOT NULL COMMENT '시스템 기본 이미지 URL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_side (side)
) ENGINE=InnoDB COMMENT='시스템 공통 모니터 기본 이미지 URL (admin 전용 관리)';
