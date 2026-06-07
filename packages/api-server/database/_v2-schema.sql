-- Multi-Monitor Workout System Database Schema
-- MariaDB 10.5+ 호환
-- FOREIGN KEY 제약 없이 설계 (참조 무결성은 애플리케이션 레벨에서 관리)

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS workout_system 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE workout_system;

-- 9. 공지사항 읽음 상태 테이블
CREATE TABLE announcement_reads (
    id bigint(20) PRIMARY KEY AUTO_INCREMENT COMMENT '읽음 상태 고유 ID',
    announcement_id bigint(20) NOT NULL COMMENT '공지사항 ID (announcements.id 참조)',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '읽은 일시',
    UNIQUE KEY uk_announcement_user (announcement_id, user_id),
    INDEX idx_announcement_id (announcement_id),
    INDEX idx_user_id (user_id),
    INDEX idx_read_at (read_at)
) ENGINE=InnoDB COMMENT='공지사항 읽음 상태 - 사용자별 공지사항 읽음 여부 추적';

-- 8. 공지사항 테이블
CREATE TABLE announcements (
    id bigint(20) PRIMARY KEY AUTO_INCREMENT COMMENT '공지사항 고유 ID',
    title VARCHAR(255) NOT NULL COMMENT '공지사항 제목',
    content TEXT NOT NULL COMMENT '공지사항 본문 내용',
    attachments JSON NULL COMMENT '첨부파일 메타(JSON 배열: url, originalName)',
    type ENUM('general', 'maintenance', 'update', 'event', 'urgent') NOT NULL DEFAULT 'general' COMMENT '공지사항 유형 - general: 일반, maintenance: 점검, update: 업데이트, event: 이벤트, urgent: 긴급',
    priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal' COMMENT '우선순위 - low: 낮음, normal: 보통, high: 높음, urgent: 긴급',
    target_audience ENUM('all', 'branch', 'specific_users') NOT NULL DEFAULT 'all' COMMENT '대상 범위 - all: 전체, branch: 특정지점, specific_users: 특정사용자',
    branch_id bigint(20) NULL COMMENT '특정 지점 ID (branches.id 참조) - target_audience가 branch일 때 사용',
    author_id CHAR(36) NOT NULL COMMENT '작성자 ID (users.id 참조)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 상태 (true: 게시중, false: 비활성)',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE COMMENT '상단 고정 여부 (true: 고정, false: 일반)',
    start_date TIMESTAMP NULL COMMENT '게시 시작일시',
    end_date TIMESTAMP NULL COMMENT '게시 종료일시',
    view_count INT NOT NULL DEFAULT 0 COMMENT '총 조회수',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    INDEX idx_type (type),
    INDEX idx_priority (priority),
    INDEX idx_target_audience (target_audience),
    INDEX idx_branch_id (branch_id),
    INDEX idx_author_id (author_id),
    INDEX idx_is_active (is_active),
    INDEX idx_is_pinned (is_pinned),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_created_at (created_at),
    FULLTEXT idx_search (title, content)
) ENGINE=InnoDB COMMENT='공지사항 - 시스템 공지사항 관리';

-- 1. 지점정보 테이블 (기준 테이블)
CREATE TABLE branches (
    id bigint(20) PRIMARY KEY AUTO_INCREMENT COMMENT '지점 고유 ID',
    name VARCHAR(100) NOT NULL COMMENT '지점명',
    address VARCHAR(255) NOT NULL COMMENT '지점주소',
    phone VARCHAR(20) NOT NULL COMMENT '지점전화번호',
    region VARCHAR(100) NOT NULL COMMENT '지점지역 (서울, 부산, 대구 등)',
    manager VARCHAR(100) NOT NULL COMMENT '지점담당자',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    INDEX idx_region (region),
    INDEX idx_name (name)
) ENGINE=InnoDB COMMENT='지점정보 - 워크아웃 시스템의 각 지점 정보';

-- 6. 운동정보 테이블
CREATE TABLE exercises (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '운동정보 고유 ID',
    number INT NOT NULL UNIQUE COMMENT '운동 고유 번호 (시스템 내 식별용)',
    workout_category_id CHAR(36) NOT NULL COMMENT '운동구분 ID (workout_categories.id 참조)',
    level ENUM('beginner', 'intermediate', 'advanced') NOT NULL COMMENT '운동 난이도 - beginner: 초급, intermediate: 중급, advanced: 고급',
    name_en VARCHAR(255) NOT NULL COMMENT '운동명 (영문)',
    name_ko VARCHAR(255) NOT NULL COMMENT '운동명 (한글)',
    target_muscles TEXT NOT NULL COMMENT '자극 부위 목록 (JSON 배열 또는 쉼표 구분 문자열)',
    characteristics TEXT COMMENT '운동 특징 및 효과 설명',
    equipment VARCHAR(255) COMMENT '필요한 운동 기구명',
    purpose VARCHAR(255) NOT NULL COMMENT '운동 목적 (근력강화, 유산소, 유연성 등)',
    video_url VARCHAR(500) NULL COMMENT '유튜브 영상 URL',
    thumbnail_url VARCHAR(500) NULL COMMENT '썸네일 이미지 URL (로컬 저장 경로)',
    video_title VARCHAR(255) NULL COMMENT '영상 제목',
    video_duration INT NULL COMMENT '영상 재생시간 (초 단위)',
    video_start_time INT NULL COMMENT '영상 시작 시간 (초 단위)';
    video_end_time INT NULL COMMENT '영상 종료 시간 (초 단위)';
    video_loop_count INT NULL COMMENT '반복 횟수 (NULL이면 무한반복)';
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '사용 가능 여부 (true: 활성, false: 비활성)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    INDEX idx_number (number),
    INDEX idx_workout_category_id (workout_category_id),
    INDEX idx_level (level),
    INDEX idx_name_en (name_en),
    INDEX idx_name_ko (name_ko),
    INDEX idx_purpose (purpose),
    INDEX idx_video_url (video_url),
    INDEX idx_thumbnail_url (thumbnail_url),
    INDEX idx_is_active (is_active),
    FULLTEXT idx_search (name_en, name_ko, characteristics, equipment, purpose)
) ENGINE=InnoDB COMMENT='운동정보 - 개별 운동 동작 상세 정보';

-- 6-1. Vimeo 영상 정보 테이블
CREATE TABLE vimeo_videos (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Vimeo 영상 고유 ID',
    video_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'Vimeo 영상 ID (고유값)',
    parent_folder VARCHAR(255) NULL COMMENT '상위 폴더명',
    workout_category_id CHAR(36) NULL COMMENT '상위 폴더와 매칭된 workout_categories.id',
    title VARCHAR(255) NOT NULL COMMENT '영상 제목',
    description TEXT NULL COMMENT '영상 설명',
    thumbnail_url VARCHAR(500) NULL COMMENT '썸네일 이미지 URL',
    duration INT NULL COMMENT '영상 길이 (초 단위)',
    status VARCHAR(50) NULL COMMENT '영상 상태 (available, uploading, transcoding 등)',
    privacy_view VARCHAR(50) NULL COMMENT 'Privacy 설정 (anybody, disable, unlisted 등)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성 상태 (TRUE: 사용가능, FALSE: Vimeo에서 삭제됨)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    INDEX idx_video_id (video_id),
    INDEX idx_title (title),
    INDEX idx_workout_category_id (workout_category_id),
    INDEX idx_is_active (is_active),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB COMMENT='Vimeo 영상 정보 - Vimeo API로부터 가져온 영상 메타데이터';


-- 17. 지점별 블루투스 기기 관리 테이블
CREATE TABLE branch_bluetooth_devices (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '블루투스 기기 고유 ID',
    branch_id bigint(20) NOT NULL COMMENT '지점 ID (branches.id 참조)',
    device_id VARCHAR(255) NOT NULL COMMENT '블루투스 기기 ID (Web Bluetooth API에서 제공하는 device.id)',
    device_name VARCHAR(255) NOT NULL COMMENT '블루투스 기기 이름 (예: HW9 10084)',
    device_type ENUM('heart_rate', 'other') NOT NULL DEFAULT 'heart_rate' COMMENT '기기 유형 - heart_rate: 심박계, other: 기타',
    manufacturer VARCHAR(100) NULL COMMENT '제조사 정보',
    model VARCHAR(100) NULL COMMENT '모델명',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 상태 (true: 사용가능, false: 비활성)',
    last_connected_at TIMESTAMP NULL COMMENT '마지막 연결 일시',
    last_connected_user_id CHAR(36) NULL COMMENT '마지막 연결한 사용자 ID (users.id 참조)',
    notes TEXT NULL COMMENT '기기 메모 (위치, 관리사항 등)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_branch_device (branch_id, device_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_device_id (device_id),
    INDEX idx_device_name (device_name),
    INDEX idx_device_type (device_type),
    INDEX idx_is_active (is_active),
    INDEX idx_last_connected_at (last_connected_at)
) ENGINE=InnoDB COMMENT='지점별 블루투스 기기 - 지점에 등록된 블루투스 기기 관리';

-- 16. 심박수 상세 데이터 테이블
CREATE TABLE heart_rate_data (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '심박수 데이터 고유 ID',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
    workout_history_master_id CHAR(36) NOT NULL COMMENT '운동기록 마스터 ID (workout_history_master.id 참조)',
    device_id CHAR(36) NOT NULL COMMENT '블루투스 기기 ID (branch_bluetooth_devices.id 참조)',
    timestamp TIMESTAMP NOT NULL COMMENT '측정 시간',
    heart_rate INT NOT NULL COMMENT '측정된 심박수 값 (bpm)',
    zone ENUM('rest', 'fat-burn', 'cardio', 'peak') NULL COMMENT '심박수 운동 구간 - rest: 휴식, fat-burn: 지방연소, cardio: 유산소, peak: 최대강도',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '데이터 생성일시',
    INDEX idx_user_id (user_id),
    INDEX idx_workout_history_master_id (workout_history_master_id),
    INDEX idx_device_id (device_id),
    INDEX idx_workout_timestamp (workout_history_master_id, timestamp),
    INDEX idx_user_timestamp (user_id, timestamp),
    INDEX idx_zone (zone),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='심박수 상세 데이터 - 사용자별 운동세션별 실시간 심박수 측정값';

-- 14. 심박수 측정 데이터 테이블 (삭제됨 - heart_rate_data로 통합)
-- CREATE TABLE heart_rate_readings (
--     id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '심박수 측정 고유 ID',
--     workout_session_id CHAR(36) NOT NULL COMMENT '연결된 운동세션 ID (workout_sessions.id 참조)',
--     timestamp TIMESTAMP NOT NULL COMMENT '심박수 측정 시간',
--     heart_rate INT NOT NULL COMMENT '측정된 심박수 값 (bpm)',
--     device_id VARCHAR(100) COMMENT '측정 장비 ID (웨어러블 기기 등)',
--     quality_score TINYINT COMMENT '측정 품질 점수 (1-10)',
--     INDEX idx_workout_session_id (workout_session_id),
--     INDEX idx_session_timestamp (workout_session_id, timestamp),
--     INDEX idx_timestamp (timestamp)
-- ) ENGINE=InnoDB COMMENT='심박수 측정 데이터 - 운동 중 실시간 심박수 측정값';

-- 15. 심박수 세션 테이블 (삭제됨 - heart_rate_data로 통합)
-- CREATE TABLE heart_rate_sessions (
--     id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '심박수 세션 고유 ID',
--     user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
--     workout_session_id CHAR(36) COMMENT '연결된 운동세션 ID (workout_sessions.id 참조) - NULL 가능',
--     session_start_time TIMESTAMP NOT NULL COMMENT '심박수 측정 시작 시간',
--     session_duration INT NOT NULL COMMENT '측정 세션 지속시간 (초 단위)',
--     average_heart_rate INT COMMENT '세션 평균 심박수 (bpm)',
--     max_heart_rate INT COMMENT '세션 최대 심박수 (bpm)',
--     min_heart_rate INT COMMENT '세션 최소 심박수 (bpm)',
--     total_data_points INT DEFAULT 0 COMMENT '총 측정 데이터 포인트 개수',
--     exported_at TIMESTAMP NOT NULL COMMENT '데이터 내보내기 완료 시간',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '세션 생성일시',
--     INDEX idx_user_id (user_id),
--     INDEX idx_workout_session_id (workout_session_id),
--     INDEX idx_session_start (session_start_time)
-- ) ENGINE=InnoDB COMMENT='심박수 세션 - 심박수 측정 세션별 요약 정보';

-- 9. 메뉴 테이블
CREATE TABLE menus (
    id bigint PRIMARY KEY AUTO_INCREMENT COMMENT '메뉴 고유 ID',
    parent_id bigint NULL COMMENT '상위 메뉴 ID (menus.id 참조) - NULL이면 최상위 메뉴',
    name VARCHAR(100) NOT NULL COMMENT '메뉴명 (한글)',
    name_en VARCHAR(100) NULL COMMENT '메뉴명 (영문)',
    description TEXT COMMENT '메뉴 상세 설명',
    menu_type ENUM('page', 'folder', 'link', 'divider') NOT NULL DEFAULT 'page' COMMENT '메뉴 유형 - page: 페이지, folder: 폴더, link: 링크, divider: 구분선',
    url VARCHAR(255) NULL COMMENT '메뉴 URL 또는 라우트 경로',
    icon VARCHAR(100) NULL COMMENT '메뉴 아이콘 (CSS 클래스명 또는 아이콘명)',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '메뉴 표시 정렬 순서',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 상태 (true: 활성, false: 비활성)',
    is_visible BOOLEAN NOT NULL DEFAULT TRUE COMMENT '화면 표시 여부 (true: 표시, false: 숨김)',
    required_permissions JSON NULL COMMENT '필요한 권한 목록 (JSON 배열 형태)',
    target_audience ENUM('all', 'super_admin', 'user', 'branch_admin') NOT NULL DEFAULT 'all' COMMENT '대상 사용자 그룹 - all: 전체, super_admin: 최고관리자, user: 지점사용자, branch_admin: 지점관리자',
    level INT NOT NULL DEFAULT 1 COMMENT '메뉴 계층 레벨 (1: 최상위, 2: 2단계, 3: 3단계...)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    INDEX idx_parent_id (parent_id),
    INDEX idx_sort_order (sort_order),
    INDEX idx_is_active (is_active),
    INDEX idx_is_visible (is_visible),
    INDEX idx_target_audience (target_audience),
    INDEX idx_level (level),
    INDEX idx_menu_type (menu_type)
) ENGINE=InnoDB COMMENT='메뉴 관리 - 시스템 네비게이션 메뉴 구조';

-- 4. 시스템 설정 테이블
CREATE TABLE system_settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '시스템 설정 고유 ID',
    setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '설정 키',
    setting_value JSON NOT NULL COMMENT '설정 값',
    description TEXT NULL COMMENT '설정 설명',
    updated_by CHAR(36) NULL COMMENT '최종 수정자 ID',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    INDEX idx_setting_key (setting_key),
    INDEX idx_updated_by (updated_by),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB COMMENT='시스템 설정';

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('session_timeout', '3600', '세션 타임아웃 시간 (초, 기본값: 1시간)');

-- 사용자 로그인 이력 테이블 (선택사항 - 더 상세한 로그인 기록)
CREATE TABLE user_login_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '로그인 이력 고유 ID',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '로그인 시간',
    logout_time TIMESTAMP NULL COMMENT '로그아웃 시간',
    ip_address VARCHAR(45) COMMENT '로그인 IP 주소',
    user_agent TEXT COMMENT '사용자 브라우저 정보',
    login_method ENUM('web', 'mobile', 'api') DEFAULT 'web' COMMENT '로그인 방법',
    success BOOLEAN NOT NULL DEFAULT TRUE COMMENT '로그인 성공 여부',
    failure_reason VARCHAR(255) COMMENT '로그인 실패 사유',
    session_duration INT COMMENT '세션 지속 시간 (초 단위)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '기록 생성일시',
    
    INDEX idx_user_id (user_id),
    INDEX idx_login_time (login_time),
    INDEX idx_success (success),
    INDEX idx_user_login_time (user_id, login_time)
) ENGINE=InnoDB COMMENT='사용자 로그인 이력 - 모든 로그인/로그아웃 기록 추적';

-- 10. 사용자별 메뉴 항목 테이블
CREATE TABLE user_menu_items (
    id bigint PRIMARY KEY AUTO_INCREMENT COMMENT '사용자 메뉴 항목 고유 ID',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID',
    menu_id bigint NOT NULL COMMENT '메뉴 ID',
    parent_id bigint NOT NULL COMMENT '메뉴 ID',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '메뉴 사용 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY unique_user_menu (user_id, menu_id) COMMENT '사용자-메뉴 조합 유니크',
    INDEX idx_user_id (user_id),
    INDEX idx_menu_id (menu_id),
    INDEX idx_is_enabled (is_enabled),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='사용자별 메뉴 항목 설정';

-- 2. 사용자 테이블
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '사용자 고유 ID',
    userid VARCHAR(50) NOT NULL UNIQUE COMMENT '사용자 로그인 아이디 (영문/숫자 조합)',
    email VARCHAR(255) NOT NULL COMMENT '사용자 이메일 주소',
    name VARCHAR(100) NOT NULL COMMENT '사용자 실명',
    password VARCHAR(255) NOT NULL COMMENT '비밀번호 (bcrypt 해시)',
    role ENUM('user', 'branch_admin', 'super_admin') NOT NULL DEFAULT 'user' COMMENT '사용자 역할 - user: 지점사용자, branch_admin: 지점관리자, super_admin: 최고관리자',
    branch_id CHAR(36) NULL COMMENT '소속 지점 ID (branches.id 참조)',
    is_approved BOOLEAN NOT NULL DEFAULT FALSE COMMENT '관리자 승인 여부 - TRUE: 승인됨, FALSE: 승인 대기',
    approved_by CHAR(36) NULL COMMENT '승인한 관리자 ID (users.id 참조)',
    approved_at TIMESTAMP NULL COMMENT '승인 일시',
    used BOOLEAN NOT NULL DEFAULT TRUE COMMENT '계정 사용 여부 - TRUE: 사용가능, FALSE: 사용불가',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '계정 생성일시',
    last_login_at TIMESTAMP NULL COMMENT '최종 로그인 일시',
    INDEX idx_userid (userid),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_branch_id (branch_id),
    INDEX idx_is_approved (is_approved),
    INDEX idx_approved_by (approved_by),
    INDEX idx_used (used),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB COMMENT='사용자 정보 - 시스템 사용자 계정 관리';

-- 사용자 로그인 세션 테이블
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '세션 고유 ID',
    user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
    session_token VARCHAR(2000) NOT NULL COMMENT 'JWT 토큰 또는 세션 토큰',
    ip_address VARCHAR(45) COMMENT '로그인 IP 주소',
    user_agent TEXT COMMENT '사용자 브라우저 정보',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '로그인 시간',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 활동 시간',
    logout_time TIMESTAMP NULL COMMENT '로그아웃 시간 (NULL이면 현재 로그인 중)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '세션 활성 상태 (TRUE: 활성, FALSE: 비활성)',
    expires_at TIMESTAMP NOT NULL COMMENT '세션 만료 시간',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '세션 생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '세션 수정일시',
    
    INDEX idx_user_id (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_is_active (is_active),
    INDEX idx_login_time (login_time),
    INDEX idx_last_activity (last_activity),
    INDEX idx_expires_at (expires_at),
    UNIQUE KEY uk_user_session_token (user_id, session_token)
) ENGINE=InnoDB COMMENT='사용자 로그인 세션 - 사용자별 로그인 세션 및 현재 로그인 상태 추적';

-- 7. 동영상 테이블 (삭제됨 - exercises 테이블에 통합)

-- 5. 운동구분 테이블
CREATE TABLE workout_categories (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '운동구분 고유 ID',
    major_category VARCHAR(100) NOT NULL COMMENT '대분류 (예: Dynamic stretching, Static stretching 등)',
    minor_category VARCHAR(100) NULL COMMENT '중분류 (예: 상체, 하체, 전신)',
    menu_id CHAR(36) NULL COMMENT '연결된 메뉴 (menus.id 참조)',
    major_category_name TEXT COMMENT '대분류명 -> 메뉴명과 동일함',
    vimeo VARCHAR(255) NULL COMMENT 'Vimeo parent_folder 매칭용 (예: Dynamic Stretching)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성화 상태 (true: 사용가능, false: 비활성)',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '화면 표시 정렬 순서',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_major_minor (major_category),
    INDEX idx_major_category (major_category),
    INDEX idx_menu_id (menu_id),
    INDEX idx_vimeo (vimeo),
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB COMMENT='운동구분 - 메뉴 내용과 동일';

-- 5-1. 운동 저장 scope 분류 마스터
CREATE TABLE workout_scope (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '고유 ID',
    scope_code VARCHAR(20) NOT NULL COMMENT '저장/조회 코드 (workout_history_master.workout_scope)',
    scope_name VARCHAR(100) NOT NULL COMMENT '표시명',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '정렬 순서',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '사용 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_scope_code (scope_code),
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB COMMENT='운동 저장 scope 분류 마스터';

-- 13. 운동 기록 Detail 테이블
CREATE TABLE `workout_history_detail` (
  `workout_history_master_id` char(36) NOT NULL COMMENT '운동기록 마스터 ID (workout_history_master.id 참조)',
  `seq` int(11) NOT NULL COMMENT '운동 순서',
  `exercises_id` varchar(255) NOT NULL COMMENT '운동 id',
  `method_round` varchar(255) NOT NULL COMMENT '1Round, 2Round, 3Round 등등',
  `method_rest` int(11) DEFAULT 0 COMMENT '휴식시간',
  `method_hydration_time` int(11) DEFAULT 0 COMMENT '물 섭취 시간',
  `duration` int(11) NOT NULL COMMENT '총 운동시간 (초 단위)',
  `calories_burned` int(11) DEFAULT NULL COMMENT '소모 칼로리 (kcal)',
  `average_heart_rate` int(11) DEFAULT NULL COMMENT '평균 심박수 (bpm)',
  `max_heart_rate` int(11) DEFAULT NULL COMMENT '최대 심박수 (bpm)',
  `notes` text DEFAULT NULL COMMENT '운동 메모 및 특이사항',
  `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '기록 생성일시',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '기록 수정일시',
  PRIMARY KEY (`workout_history_master_id`, `seq`),
  KEY `idx_workout_history_master_id` (`workout_history_master_id`),
  KEY `idx_exercises_id` (`exercises_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동기록 - 사용자별 운동 수행 이력 및 통계';

-- 11. 운동 방법 Master 테이블
CREATE TABLE `workout_history_master` (
  `id` char(36) NOT NULL DEFAULT uuid() COMMENT '운동방법 고유 ID',
  `user_id` char(36) NOT NULL COMMENT '운동 수행자 ID (users.id 참조)',
  `date` date NOT NULL COMMENT '운동 수행 날짜',
  `time` varchar(2) NOT NULL DEFAULT '00' COMMENT '운동실시 시간',
  `workout_categories_id` varchar(255) NOT NULL COMMENT '운동 카테고리 목록',
  `workout_scope` varchar(20) NOT NULL DEFAULT 'TOTAL' COMMENT '운동 저장 페이지 구분 — workout_scope.scope_code 참조 (TOTAL/SINGLE 등)',
  `revision_number` int(11) DEFAULT 1 COMMENT '기록 수정 버전 번호',
  `method_type` varchar(255) NOT NULL COMMENT '운동방법 타입 - 스트레스 서킷, 루프 서킷 등등',
  `method_name` varchar(255) NOT NULL COMMENT '운동방법명 - 스트레스 서킷, 루프 서킷 등등',
  `memo` varchar(255) NOT NULL COMMENT '운동 Memo',
  `admin` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '관리자등록여부 - TRUE 면 관리자가 등록한 운동방법',
--   `method_round` varchar(255) NOT NULL COMMENT '1Round, 2Round, 3Round 등등',
--   `method_rest` int(11) DEFAULT 0 COMMENT '휴식시간',
--   `method_hydration_time` int(11) DEFAULT 0 COMMENT '물 섭취 시간',
--   `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '활성화 여부 (1: 활성, 0: 비활성) - 비활성화 시 메뉴에서 미노출',
  `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '기록 생성일시',
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '기록 수정일시',
  PRIMARY KEY (`id`),
  KEY `idx_method_type` (`method_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동 방법 - 라운드/Set 별 운동 방법 정보';

-- 사용자 활동 로그 테이블 생성
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 활동 로그 - 모든 사용자(일반/관리자) 활동 기록';

ALTER TABLE user_sessions MODIFY COLUMN session_token VARCHAR(2000) NOT NULL COMMENT 'JWT 토큰 또는 세션 토큰';
-- -- 12. 운동 기록 Master 테이블
-- CREATE TABLE `workout_history_master` (
--   `id` char(36) NOT NULL DEFAULT uuid() COMMENT '운동기록 고유 ID',
--   `user_id` char(36) NOT NULL COMMENT '운동 수행자 ID (users.id 참조)',
--   `date` date NOT NULL COMMENT '운동 수행 날짜',
--   `time` varchar(2) NOT NULL DEFAULT '00' COMMENT '운동실시 시간',
--   `workout_categories_id` varchar(255) NOT NULL COMMENT '운동 카테고리 목록',
--   `revision_number` int(11) DEFAULT 1 COMMENT '기록 수정 버전 번호',
--   `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '기록 생성일시',
--   `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '기록 수정일시',
--   PRIMARY KEY (`id`),
--   KEY `idx_user_date` (`user_id`,`date`,`time`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동기록 마스터 - 사용자별 운동 수행 이력 및 통계';

-- 8. 공지사항 대상 사용자 테이블
-- CREATE TABLE announcement_targets (
--     id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '대상 사용자 고유 ID',
--     announcement_id CHAR(36) NOT NULL COMMENT '공지사항 ID (announcements.id 참조)',
--     user_id CHAR(36) NOT NULL COMMENT '대상 사용자 ID (users.id 참조)',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '지정일시',
--     UNIQUE KEY uk_announcement_target (announcement_id, user_id),
--     INDEX idx_announcement_id (announcement_id),
--     INDEX idx_user_id (user_id)
-- ) ENGINE=InnoDB COMMENT='공지사항 특정 대상 사용자 - 특정 사용자에게만 보여줄 공지사항 대상 관리';

-- 10. 역할별 메뉴 권한 테이블
-- CREATE TABLE role_menu_permissions (
--     id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '역할 메뉴 권한 고유 ID',
--     role_name VARCHAR(50) NOT NULL COMMENT '역할명 (users.role 값과 매칭) - admin, user, super_admin 등',
--     menu_id CHAR(36) NOT NULL COMMENT '메뉴 ID (menus.id 참조)',
--     can_view BOOLEAN NOT NULL DEFAULT TRUE COMMENT '조회 권한 (true: 허용, false: 거부)',
--     can_create BOOLEAN NOT NULL DEFAULT FALSE COMMENT '생성 권한 (true: 허용, false: 거부)',
--     can_edit BOOLEAN NOT NULL DEFAULT FALSE COMMENT '수정 권한 (true: 허용, false: 거부)',
--     can_delete BOOLEAN NOT NULL DEFAULT FALSE COMMENT '삭제 권한 (true: 허용, false: 거부)',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
--     UNIQUE KEY uk_role_menu (role_name, menu_id),
--     INDEX idx_role_name (role_name),
--     INDEX idx_menu_id (menu_id)
-- ) ENGINE=InnoDB COMMENT='역할별 메뉴 권한 - 사용자 역할별 기본 메뉴 접근 권한 템플릿';

-- -- 11. 운동 방법 Master 테이블
-- CREATE TABLE `workout_method` (
--   `id` char(36) NOT NULL DEFAULT uuid() COMMENT '운동방법 고유 ID',
--   `method_type` varchar(255) NOT NULL COMMENT '운동방법 타입 - 스트레스 서킷, 루프 서킷 등등',
--   `method_name` varchar(255) NOT NULL COMMENT '운동방법명 - 스트레스 서킷, 루프 서킷 등등',
--   `method_round` varchar(255) NOT NULL COMMENT '1Round, 2Round, 3Round 등등',
--   `method_rest` int(11) DEFAULT 0 COMMENT '휴식시간',
--   `method_hydration_time` int(11) DEFAULT 0 COMMENT '물 섭취 시간',
--   `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '활성화 여부 (1: 활성, 0: 비활성) - 비활성화 시 메뉴에서 미노출',
--   `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT '기록 생성일시',
--   `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT '기록 수정일시',
--   PRIMARY KEY (`id`),
--   KEY `idx_method_type` (`method_type`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동 방법 - 라운드/Set 별 운동 방법 정보';


-- 2. 사용자 활동 로그 테이블
-- CREATE TABLE user_activity_logs (
--     id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '사용자 활동 로그 고유 ID',
--     user_id CHAR(36) NOT NULL COMMENT '사용자 ID (모든 역할 포함)',
--     action VARCHAR(100) NOT NULL COMMENT '수행한 작업',
--     target_type VARCHAR(50) NULL COMMENT '대상 타입 (user, video, playlist 등)',
--     target_id CHAR(36) NULL COMMENT '대상 ID',
--     details JSON NULL COMMENT '작업 상세 정보',
--     ip_address VARCHAR(45) NULL COMMENT 'IP 주소',
--     user_agent TEXT NULL COMMENT '사용자 에이전트',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
--     INDEX idx_user_id (user_id),
--     INDEX idx_action (action),
--     INDEX idx_target_type (target_type),
--     INDEX idx_created_at (created_at)
-- ) ENGINE=InnoDB COMMENT='사용자 활동 로그 - 모든 사용자(일반/관리자) 활동 기록';

-- 13. 지점별 수업 슬롯 테이블
CREATE TABLE IF NOT EXISTS class_slots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '수업 슬롯 고유 ID',
  branch_id bigint(20) NOT NULL COMMENT '지점 ID',
  workout_category_id CHAR(36) NOT NULL COMMENT '운동 대분류 ID',
  title VARCHAR(255) NOT NULL COMMENT '수업명',
  start_at DATETIME NOT NULL COMMENT '수업 시작일시',
  end_at DATETIME NOT NULL COMMENT '수업 종료일시',
  capacity INT NOT NULL DEFAULT 1 COMMENT '예약 가능 정원',
  recurrence_rule VARCHAR(255) NULL COMMENT '반복 규칙(향후 확장)',
  created_by CHAR(36) NOT NULL COMMENT '등록 사용자 ID',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  INDEX idx_branch_start (branch_id, start_at),
  INDEX idx_workout_category_id (workout_category_id),
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='지점별 수업 슬롯';

-- 14. 지점별 사용자 수업 예약 테이블
CREATE TABLE IF NOT EXISTS class_bookings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '수업 예약 고유 ID',
  slot_id CHAR(36) NOT NULL COMMENT '수업 슬롯 ID',
  user_id CHAR(36) NOT NULL COMMENT '예약 사용자 ID',
  branch_id bigint(20) NOT NULL COMMENT '지점 ID',
  status ENUM('reserved','cancelled','attended','noshow') NOT NULL DEFAULT 'reserved' COMMENT '예약 상태',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '예약일시',
  cancelled_at TIMESTAMP NULL COMMENT '취소일시',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  UNIQUE KEY uk_slot_user (slot_id, user_id),
  INDEX idx_slot_id (slot_id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_branch_status (branch_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='지점별 사용자 수업 예약';
