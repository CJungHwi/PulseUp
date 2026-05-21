-- workout_history_plan 테이블 생성
-- 설계영역의 서킷 항목들을 저장하는 테이블

CREATE TABLE `workout_history_plan` (
  `id` varchar(36) NOT NULL DEFAULT uuid(),
  `workout_history_master_id` varchar(36) NOT NULL,
  `circuit_type` enum('stress','loop','none','amrap','emom') NOT NULL COMMENT '서킷/방식 (stress, loop, none, amrap, emom)',
  `round` int(11) NOT NULL COMMENT '라운드 번호',
  `time` int(11) NOT NULL COMMENT '운동 시간 (초)',
  `rest` int(11) NOT NULL COMMENT '휴식 시간 (초)',
  `hydration` int(11) NOT NULL COMMENT '물보충 시간 (초)',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_workout_history_plan_master_id` (`workout_history_master_id`),
  KEY `idx_workout_history_plan_round` (`round`),
  CONSTRAINT `workout_history_plan_ibfk_1` FOREIGN KEY (`workout_history_master_id`) REFERENCES `workout_history_master` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='운동 계획 테이블 - 서킷 구성 정보';