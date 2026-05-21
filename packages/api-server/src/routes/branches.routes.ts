import { Router } from 'express'
import { z } from 'zod'
import { BranchService } from '../services/database.service.js'
import { validateBody } from '../middleware/validation.middleware.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { ResponseUtil } from '../utils/response.util.js'

const router = Router()

// 지점 생성 스키마
const createBranchSchema = z.object({
  name: z.string().min(1, '지점명은 필수입니다'),
  region: z.string().min(1, '지역은 필수입니다'),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  manager: z.string().optional().or(z.literal(''))
})

// 지점 수정 스키마
const updateBranchSchema = z.object({
  name: z.string().min(1, '지점명은 필수입니다'),
  region: z.string().min(1, '지역은 필수입니다'),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  manager: z.string().optional().or(z.literal(''))
})

// 지점 목록 조회
router.get('/', async (req, res, next) => {
  try {
    const result = await BranchService.getBranches()
    const branches = result[0] || []

    return ResponseUtil.success(res, {
      items: branches,
      total: branches.length,
      page: 1,
      limit: branches.length
    }, '지점 목록을 조회했습니다')
  } catch (error) {
    console.error('지점 목록 조회 오류:', error)
    next(error)
  }
})

// 지점 상세 조회
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const branch = await BranchService.getBranchById(id)

    if (!branch) {
      return ResponseUtil.notFound(res, '지점을 찾을 수 없습니다')
    }

    return ResponseUtil.success(res, branch, '지점 정보를 조회했습니다')
  } catch (error) {
    console.error('지점 상세 조회 오류:', error)
    next(error)
  }
})

// 지점 생성
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    // console.log('=== 지점 생성 요청 시작 ===')
    // console.log('Raw request body:', req.body)
    // console.log('Request headers:', req.headers)

    // 수동으로 유효성 검사
    const validationResult = createBranchSchema.safeParse(req.body)
    if (!validationResult.success) {
      //console.log('유효성 검사 실패:', validationResult.error.errors)
      return res.status(400).json({
        error: '입력 데이터가 유효하지 않습니다',
        details: validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          received: 'received' in err ? err.received : undefined
        }))
      })
    }

    //console.log('유효성 검사 통과')
    const { name, region, address = '', phone = '', manager = '' } = validationResult.data

    const result = await BranchService.createBranch(name, address, phone, region, manager)
    //console.log('지점 생성 결과:', result)

    // INSERT 쿼리의 결과에서 insertId 가져오기
    const branchId = result.insertId

    if (!branchId) {
      //console.log('지점 ID를 얻지 못함:', result)
      return ResponseUtil.badRequest(res, '지점 생성에 실패했습니다')
    }

    //console.log('생성된 지점 ID:', branchId)

    // 생성된 지점 정보 조회
    const newBranch = await BranchService.getBranchById(branchId)

    return ResponseUtil.created(res, newBranch, '지점이 생성되었습니다')
  } catch (error) {
    console.error('지점 생성 오류:', error)
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        return ResponseUtil.conflict(res, '이미 존재하는 지점명입니다')
      }
    }
    next(error)
  }
})

// 지점 수정
router.put('/:id', authenticateToken, validateBody(updateBranchSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { name, region, address = '', phone = '', manager = '' } = req.body

    // 지점 존재 여부 확인
    const existingBranch = await BranchService.getBranchById(id)
    if (!existingBranch) {
      return ResponseUtil.notFound(res, '지점을 찾을 수 없습니다')
    }

    await BranchService.updateBranch(id, name, address, phone, region, manager)

    // 수정된 지점 정보 조회
    const updatedBranch = await BranchService.getBranchById(id)

    return ResponseUtil.success(res, updatedBranch, '지점이 수정되었습니다')
  } catch (error) {
    console.error('지점 수정 오류:', error)
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        return ResponseUtil.conflict(res, '이미 존재하는 지점명입니다')
      }
    }
    next(error)
  }
})

// 지점 삭제
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    // 지점 존재 여부 확인
    const existingBranch = await BranchService.getBranchById(id)
    if (!existingBranch) {
      return ResponseUtil.notFound(res, '지점을 찾을 수 없습니다')
    }

    await BranchService.deleteBranch(id)

    return ResponseUtil.success(res, null, '지점이 삭제되었습니다')
  } catch (error) {
    console.error('지점 삭제 오류:', error)
    next(error)
  }
})

export default router