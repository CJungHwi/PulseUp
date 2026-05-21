import { Router } from 'express';
import { AnnouncementService } from '../services/announcement.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { 
  createAnnouncementSchema, 
  updateAnnouncementSchema, 
  getAnnouncementsQuerySchema 
} from '../schemas/announcement.schema.js';
import { successResponse, errorResponse } from '../utils/response.util.js';

const router = Router();
const announcementService = new AnnouncementService();

/**
 * @route GET /api/announcements
 * @desc 사용자별 공지사항 목록 조회
 * @access Private
 */
router.get('/', 
  authMiddleware,
  validateRequest({ query: getAnnouncementsQuerySchema }),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const branchId = req.user!.branch_id;
      const query = req.query as any;

      const announcements = await announcementService.getAnnouncementsForUser(
        userId, 
        branchId, 
        query
      );

      res.json(successResponse(announcements, '공지사항 목록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('공지사항 목록 조회 오류:', error);
      res.status(500).json(errorResponse('공지사항 목록 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/announcements/unread-count
 * @desc 읽지 않은 공지사항 개수 조회
 * @access Private
 */
router.get('/unread-count', 
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const branchId = req.user!.branch_id;

      const result = await announcementService.getUnreadAnnouncementCount(userId, branchId);

      res.json(successResponse(result, '읽지 않은 공지사항 개수를 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('읽지 않은 공지사항 개수 조회 오류:', error);
      res.status(500).json(errorResponse('읽지 않은 공지사항 개수 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/announcements/admin
 * @desc 관리자용 전체 공지사항 목록 조회
 * @access Private (Admin)
 */
router.get('/admin', 
  authMiddleware,
  validateRequest({ query: getAnnouncementsQuerySchema }),
  async (req, res) => {
    try {
      // TODO: 관리자 권한 체크 미들웨어 추가 필요
      const query = req.query as any;

      const announcements = await announcementService.getAllAnnouncementsAdmin(query);

      res.json(successResponse(announcements, '관리자 공지사항 목록을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('관리자 공지사항 목록 조회 오류:', error);
      res.status(500).json(errorResponse('관리자 공지사항 목록 조회에 실패했습니다'));
    }
  }
);

/**
 * @route GET /api/announcements/:id
 * @desc 공지사항 상세 조회
 * @access Private
 */
router.get('/:id', 
  authMiddleware,
  async (req, res) => {
    try {
      const announcementId = req.params.id;
      const userId = req.user!.id;

      const announcement = await announcementService.getAnnouncementDetail(
        announcementId, 
        userId
      );

      if (!announcement) {
        return res.status(404).json(errorResponse('공지사항을 찾을 수 없습니다'));
      }

      res.json(successResponse(announcement, '공지사항을 성공적으로 조회했습니다'));
    } catch (error) {
      console.error('공지사항 상세 조회 오류:', error);
      res.status(500).json(errorResponse('공지사항 상세 조회에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/announcements
 * @desc 공지사항 생성
 * @access Private (Admin)
 */
router.post('/', 
  authMiddleware,
  validateRequest({ body: createAnnouncementSchema }),
  async (req, res) => {
    try {
      // TODO: 관리자 권한 체크 미들웨어 추가 필요
      const authorId = req.user!.id;
      const data = req.body;

      const result = await announcementService.createAnnouncement(data, authorId);

      res.status(201).json(successResponse(result, '공지사항이 성공적으로 생성되었습니다'));
    } catch (error) {
      console.error('공지사항 생성 오류:', error);
      res.status(500).json(errorResponse('공지사항 생성에 실패했습니다'));
    }
  }
);

/**
 * @route PUT /api/announcements/:id
 * @desc 공지사항 수정
 * @access Private (Admin)
 */
router.put('/:id', 
  authMiddleware,
  validateRequest({ body: updateAnnouncementSchema }),
  async (req, res) => {
    try {
      // TODO: 관리자 권한 체크 미들웨어 추가 필요
      const announcementId = req.params.id;
      const data = req.body;

      const result = await announcementService.updateAnnouncement(announcementId, data);

      res.json(successResponse(result, '공지사항이 성공적으로 수정되었습니다'));
    } catch (error) {
      console.error('공지사항 수정 오류:', error);
      res.status(500).json(errorResponse('공지사항 수정에 실패했습니다'));
    }
  }
);

/**
 * @route DELETE /api/announcements/:id
 * @desc 공지사항 삭제 (비활성화)
 * @access Private (Admin)
 */
router.delete('/:id', 
  authMiddleware,
  async (req, res) => {
    try {
      // TODO: 관리자 권한 체크 미들웨어 추가 필요
      const announcementId = req.params.id;

      const result = await announcementService.deleteAnnouncement(announcementId);

      res.json(successResponse(result, '공지사항이 성공적으로 삭제되었습니다'));
    } catch (error) {
      console.error('공지사항 삭제 오류:', error);
      res.status(500).json(errorResponse('공지사항 삭제에 실패했습니다'));
    }
  }
);

/**
 * @route POST /api/announcements/:id/read
 * @desc 공지사항 읽음 처리
 * @access Private
 */
router.post('/:id/read', 
  authMiddleware,
  async (req, res) => {
    try {
      const announcementId = req.params.id;
      const userId = req.user!.id;

      const result = await announcementService.markAnnouncementAsRead(
        announcementId, 
        userId
      );

      res.json(successResponse(result, '공지사항을 읽음으로 처리했습니다'));
    } catch (error) {
      console.error('공지사항 읽음 처리 오류:', error);
      res.status(500).json(errorResponse('공지사항 읽음 처리에 실패했습니다'));
    }
  }
);

export default router;