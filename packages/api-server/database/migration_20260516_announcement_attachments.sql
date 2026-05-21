-- LinkHiit: 공지사항 첨부(attachments JSON 컬럼) 추가 — 기존 DB 일회 적용용
-- 컬럼이 이미 있으면 ALTER가 실패합니다(무시하거나 해당 구문만 건너뛰세요).
-- 적용 후 프로시저 갱신: npm run db:procedures --workspace=api-server

USE workout_system;

ALTER TABLE announcements
  ADD COLUMN attachments JSON NULL COMMENT '첨부파일 메타(JSON 배열: url, originalName)' AFTER content;
