import { Router } from 'express'
import { z } from 'zod'
// import { prisma } from '../lib/prisma.js'
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js'
import { 
  createPlaylistSchema, 
  updatePlaylistSchema, 
  addVideoToPlaylistSchema,
  reorderPlaylistVideosSchema 
} from '../schemas/playlist.schema.js'
import { ResponseUtil } from '../utils/response.util.js'
import { PlaylistService } from '../services/playlist.service.js'

const router = Router()

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken)

// 플레이리스트 목록 조회 (검색, 필터링, 페이지네이션)
const getPlaylistsQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => Math.min(parseInt(val) || 10, 50)).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

router.get('/', validateQuery(getPlaylistsQuerySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as any

    const skip = (page - 1) * limit

    const where: any = {
      userId: req.user!.id
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    const [playlists, total] = await Promise.all([
      prisma.playlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { videos: true }
          },
          videos: {
            take: 3, // 미리보기용으로 처음 3개 비디오만
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  duration: true
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      }),
      prisma.playlist.count({ where })
    ])

    return ResponseUtil.successWithPagination(res, playlists, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 상세 조회
const playlistParamsSchema = z.object({
  id: z.string().min(1, '플레이리스트 ID는 필수입니다'),
})

router.get('/:id', validateParams(playlistParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      },
      include: {
        videos: {
          include: {
            video: true
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: { videos: true }
        }
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    return ResponseUtil.success(res, playlist)
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 생성
router.post('/', validateBody(createPlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name } = req.body

    const playlist = await prisma.playlist.create({
      data: {
        name,
        userId: req.user!.id,
      },
      include: {
        _count: {
          select: { videos: true }
        }
      }
    })

    return ResponseUtil.created(res, playlist, '플레이리스트가 성공적으로 생성되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 수정
router.put('/:id', validateParams(playlistParamsSchema), validateBody(updatePlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { name } = req.body

    const playlist = await prisma.playlist.updateMany({
      where: { 
        id,
        userId: req.user!.id 
      },
      data: { name }
    })

    if (playlist.count === 0) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    const updatedPlaylist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true }
        }
      }
    })

    return ResponseUtil.success(res, updatedPlaylist, '플레이리스트가 성공적으로 수정되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 삭제
router.delete('/:id', validateParams(playlistParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    const result = await prisma.playlist.deleteMany({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (result.count === 0) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    return ResponseUtil.success(res, null, '플레이리스트가 성공적으로 삭제되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트에 비디오 추가
router.post('/:id/videos', validateParams(playlistParamsSchema), validateBody(addVideoToPlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { videoId, order } = req.body

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    // 비디오 존재 확인
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      return ResponseUtil.notFound(res, '비디오를 찾을 수 없습니다')
    }

    // 이미 플레이리스트에 있는지 확인
    const existingPlaylistVideo = await prisma.playlistVideo.findUnique({
      where: {
        playlistId_videoId: {
          playlistId: id,
          videoId
        }
      }
    })

    if (existingPlaylistVideo) {
      return ResponseUtil.conflict(res, '이미 플레이리스트에 있는 비디오입니다')
    }

    const playlistVideo = await prisma.playlistVideo.create({
      data: {
        playlistId: id,
        videoId,
        order
      },
      include: {
        video: true
      }
    })

    return ResponseUtil.created(res, playlistVideo, '비디오가 플레이리스트에 추가되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트에서 비디오 제거
const removeVideoParamsSchema = z.object({
  id: z.string().min(1, '플레이리스트 ID는 필수입니다'),
  videoId: z.string().min(1, '비디오 ID는 필수입니다'),
})

router.delete('/:id/videos/:videoId', validateParams(removeVideoParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id, videoId } = req.params

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    await prisma.playlistVideo.delete({
      where: {
        playlistId_videoId: {
          playlistId: id,
          videoId
        }
      }
    })

    return ResponseUtil.success(res, null, '비디오가 플레이리스트에서 제거되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 비디오 순서 변경
router.put('/:id/reorder', validateParams(playlistParamsSchema), validateBody(reorderPlaylistVideosSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { videoOrders } = req.body

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    // 트랜잭션으로 순서 업데이트
    await prisma.$transaction(
      videoOrders.map(({ videoId, order }: { videoId: string; order: number }) =>
        prisma.playlistVideo.update({
          where: {
            playlistId_videoId: {
              playlistId: id,
              videoId
            }
          },
          data: { order }
        })
      )
    )

    return ResponseUtil.success(res, null, '플레이리스트 순서가 업데이트되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 복사
router.post('/:id/duplicate', validateParams(playlistParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    // 원본 플레이리스트 조회
    const originalPlaylist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      },
      include: {
        videos: {
          include: {
            video: true
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!originalPlaylist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    // 새 플레이리스트 생성
    const duplicatedPlaylist = await prisma.playlist.create({
      data: {
        name: `${originalPlaylist.name} (복사본)`,
        userId: req.user!.id,
      }
    })

    // 비디오들 복사
    if (originalPlaylist.videos.length > 0) {
      await prisma.playlistVideo.createMany({
        data: originalPlaylist.videos.map(pv => ({
          playlistId: duplicatedPlaylist.id,
          videoId: pv.videoId,
          order: pv.order
        }))
      })
    }

    // 복사된 플레이리스트 조회 (비디오 포함)
    const result = await prisma.playlist.findUnique({
      where: { id: duplicatedPlaylist.id },
      include: {
        _count: {
          select: { videos: true }
        },
        videos: {
          include: {
            video: true
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    return ResponseUtil.created(res, result, '플레이리스트가 성공적으로 복사되었습니다')
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 통계
router.get('/:id/stats', validateParams(playlistParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    // PlaylistService를 사용하여 통계 계산
    const stats = await PlaylistService.getPlaylistStats(id, req.user!.id)

    if (!stats) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    return ResponseUtil.success(res, stats)
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 내 비디오 검색
const searchPlaylistVideosSchema = z.object({
  query: z.string().min(1, '검색어를 입력해주세요')
})

router.post('/:id/search', validateParams(playlistParamsSchema), validateBody(searchPlaylistVideosSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { query } = req.body

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    const videos = await prisma.playlistVideo.findMany({
      where: {
        playlistId: id,
        video: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      },
      include: {
        video: true
      },
      orderBy: { order: 'asc' }
    })

    return ResponseUtil.success(res, videos)
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 공유 정보 생성
router.post('/:id/share', validateParams(playlistParamsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      },
      include: {
        _count: {
          select: { videos: true }
        }
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    const shareInfo = {
      playlistId: playlist.id,
      name: playlist.name,
      videoCount: playlist._count.videos,
      createdAt: playlist.createdAt,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/playlists/${playlist.id}/share`,
      embedCode: `<iframe src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/playlists/${playlist.id}/embed" width="560" height="315" frameborder="0"></iframe>`
    }

    return ResponseUtil.success(res, shareInfo)
  } catch (error) {
    next(error)
  }
})

// 플레이리스트 일괄 작업
const bulkActionSchema = z.object({
  action: z.enum(['delete', 'move', 'copy']),
  videoIds: z.array(z.string()).min(1, '최소 하나의 비디오를 선택해주세요'),
  targetPlaylistId: z.string().optional() // move, copy 작업 시 필요
})

router.post('/:id/bulk-action', validateParams(playlistParamsSchema), validateBody(bulkActionSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { action, videoIds, targetPlaylistId } = req.body

    // 플레이리스트 소유권 확인
    const playlist = await prisma.playlist.findFirst({
      where: { 
        id,
        userId: req.user!.id 
      }
    })

    if (!playlist) {
      return ResponseUtil.notFound(res, '플레이리스트를 찾을 수 없습니다')
    }

    let result: any = {}

    switch (action) {
      case 'delete':
        const deleteResult = await prisma.playlistVideo.deleteMany({
          where: {
            playlistId: id,
            videoId: { in: videoIds }
          }
        })
        result = { deletedCount: deleteResult.count }
        break

      case 'move':
      case 'copy':
        if (!targetPlaylistId) {
          return ResponseUtil.validationError(res, '대상 플레이리스트 ID가 필요합니다')
        }

        // 대상 플레이리스트 소유권 확인
        const targetPlaylist = await prisma.playlist.findFirst({
          where: { 
            id: targetPlaylistId,
            userId: req.user!.id 
          }
        })

        if (!targetPlaylist) {
          return ResponseUtil.notFound(res, '대상 플레이리스트를 찾을 수 없습니다')
        }

        // 현재 플레이리스트에서 비디오 정보 가져오기
        const playlistVideos = await prisma.playlistVideo.findMany({
          where: {
            playlistId: id,
            videoId: { in: videoIds }
          }
        })

        // 대상 플레이리스트의 마지막 순서 번호 가져오기
        const lastOrder = await prisma.playlistVideo.findFirst({
          where: { playlistId: targetPlaylistId },
          orderBy: { order: 'desc' },
          select: { order: true }
        })

        let nextOrder = (lastOrder?.order || 0) + 1

        // 대상 플레이리스트에 비디오 추가
        const createData = playlistVideos.map(pv => ({
          playlistId: targetPlaylistId,
          videoId: pv.videoId,
          order: nextOrder++
        }))

        await prisma.playlistVideo.createMany({
          data: createData,
          skipDuplicates: true
        })

        // move 작업인 경우 원본에서 삭제
        if (action === 'move') {
          await prisma.playlistVideo.deleteMany({
            where: {
              playlistId: id,
              videoId: { in: videoIds }
            }
          })
        }

        result = { 
          processedCount: playlistVideos.length,
          action: action === 'move' ? 'moved' : 'copied'
        }
        break
    }

    return ResponseUtil.success(res, result, `일괄 작업이 완료되었습니다`)
  } catch (error) {
    next(error)
  }
})

// 자동 플레이리스트 생성
const autoPlaylistSchema = z.object({
  name: z.string().min(1, '플레이리스트 이름은 필수입니다'),
  criteria: z.object({
    categories: z.array(z.string()).optional(),
    minDuration: z.number().min(0).optional(),
    maxDuration: z.number().min(0).optional(),
    keywords: z.array(z.string()).optional(),
    maxVideos: z.number().min(1).max(100).optional().default(20)
  })
})

router.post('/auto-create', validateBody(autoPlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await PlaylistService.createAutoPlaylist(req.user!.id, req.body)
    
    return ResponseUtil.created(res, result, `${result.addedVideos}개의 비디오로 자동 플레이리스트가 생성되었습니다`)
  } catch (error) {
    if (error instanceof Error && error.message === '조건에 맞는 비디오가 없습니다') {
      return ResponseUtil.validationError(res, error.message)
    }
    next(error)
  }
})

// 플레이리스트 내보내기
const exportPlaylistSchema = z.object({
  format: z.enum(['json', 'csv', 'm3u']).default('json'),
  includeMetadata: z.boolean().optional().default(true)
})

router.post('/:id/export', validateParams(playlistParamsSchema), validateBody(exportPlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { format, includeMetadata } = req.body

    const exportData = await PlaylistService.exportPlaylist(id, req.user!.id, format, includeMetadata)

    // 파일 다운로드를 위한 헤더 설정
    const filename = `playlist-${id}.${format}`
    const contentType = format === 'json' ? 'application/json' : 
                       format === 'csv' ? 'text/csv' : 'audio/x-mpegurl'

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', contentType)
    
    return res.send(exportData)
  } catch (error) {
    if (error instanceof Error && error.message === '플레이리스트를 찾을 수 없습니다') {
      return ResponseUtil.notFound(res, error.message)
    }
    next(error)
  }
})

// 플레이리스트 가져오기
const importPlaylistSchema = z.object({
  sourcePlaylistId: z.string().min(1, '원본 플레이리스트 ID는 필수입니다'),
  name: z.string().min(1, '새 플레이리스트 이름은 필수입니다').optional(),
  includeVideos: z.boolean().optional().default(true)
})

router.post('/import', validateBody(importPlaylistSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { sourcePlaylistId, name, includeVideos } = req.body

    const importedPlaylist = await PlaylistService.importPlaylist(
      sourcePlaylistId, 
      req.user!.id, 
      name, 
      includeVideos
    )

    return ResponseUtil.created(res, importedPlaylist, '플레이리스트가 성공적으로 가져와졌습니다')
  } catch (error) {
    if (error instanceof Error && error.message === '원본 플레이리스트를 찾을 수 없습니다') {
      return ResponseUtil.notFound(res, error.message)
    }
    next(error)
  }
})

// 플레이리스트 병합
const mergePlaylistsSchema = z.object({
  targetPlaylistId: z.string().min(1, '대상 플레이리스트 ID는 필수입니다'),
  sourcePlaylistIds: z.array(z.string()).min(1, '최소 하나의 원본 플레이리스트가 필요합니다')
})

router.post('/merge', validateBody(mergePlaylistsSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { targetPlaylistId, sourcePlaylistIds } = req.body

    const result = await PlaylistService.mergePlaylists(
      targetPlaylistId, 
      sourcePlaylistIds, 
      req.user!.id
    )

    return ResponseUtil.success(res, result, `${result.mergedVideos}개의 비디오가 병합되었습니다`)
  } catch (error) {
    if (error instanceof Error && error.message === '대상 플레이리스트를 찾을 수 없습니다') {
      return ResponseUtil.notFound(res, error.message)
    }
    next(error)
  }
})

// 플레이리스트 자동 정렬
const autoSortSchema = z.object({
  sortBy: z.enum(['title', 'duration', 'createdAt']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc')
})

router.post('/:id/auto-sort', validateParams(playlistParamsSchema), validateBody(autoSortSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params
    const { sortBy, order } = req.body

    const result = await PlaylistService.autoSortPlaylist(id, req.user!.id, sortBy, order)

    return ResponseUtil.success(res, result, `${result.sortedVideos}개의 비디오가 ${sortBy} 기준으로 정렬되었습니다`)
  } catch (error) {
    if (error instanceof Error && error.message === '플레이리스트를 찾을 수 없습니다') {
      return ResponseUtil.notFound(res, error.message)
    }
    next(error)
  }
})

// 재생시간 포맷팅 헬퍼 함수
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 ${remainingSeconds}초`
  } else if (minutes > 0) {
    return `${minutes}분 ${remainingSeconds}초`
  } else {
    return `${remainingSeconds}초`
  }
}

export default router