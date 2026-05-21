// import { PlaylistService as DBPlaylistService, VideoService } from './database.service.js'
import { executeQuery, executeTransaction } from '../lib/database.js'

// Temporary placeholder classes
class DBPlaylistService {
  static async addVideoToPlaylist(playlistId: string, videoId: string, order: number) {
    return null;
  }
}

class VideoService {
  static async getVideoById(videoId: string) {
    return null;
  }
}

interface AutoPlaylistInput {
  name: string
  criteria: {
    categories?: string[]
    minDuration?: number
    maxDuration?: number
    keywords?: string[]
    maxVideos?: number
  }
}

export interface PlaylistStats {
  totalVideos: number
  totalDuration: number
  totalDurationFormatted: string
  averageDuration: number
  videosByCategory: Array<{
    category: string
    count: number
  }>
}

export interface ExportData {
  playlist: {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
  }
  videos: Array<{
    id: string
    title: string
    description?: string
    category: string
    youtubeUrl: string
    duration: number
    thumbnailUrl?: string
    order: number
  }>
  metadata: {
    exportedAt: Date
    totalVideos: number
    totalDuration: number
  }
}

export class PlaylistService {
  /**
   * 플레이리스트 생성
   */
  static async createPlaylist(userId: string, name: string) {
    const result = await DBPlaylistService.createPlaylist(userId, name)
    const playlistId = result[0]?.[0]?.playlist_id

    if (!playlistId) {
      throw new Error('플레이리스트 생성에 실패했습니다')
    }

    return {
      id: playlistId,
      name,
      userId,
      videos: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * 사용자 플레이리스트 목록 조회
   */
  static async getUserPlaylists(userId: string) {
    return await DBPlaylistService.getUserPlaylists(userId)
  }

  /**
   * 플레이리스트 상세 조회
   */
  static async getPlaylistById(playlistId: string, userId?: string) {
    const result = await DBPlaylistService.getPlaylistWithVideos(playlistId)
    
    if (!result || result.length < 2) {
      return null
    }

    const playlistInfo = result[0][0]
    const videos = result[1] || []

    // 사용자 권한 확인
    if (userId && playlistInfo.user_id !== userId) {
      return null
    }

    return {
      id: playlistInfo.id,
      name: playlistInfo.name,
      userId: playlistInfo.user_id,
      createdAt: playlistInfo.created_at,
      updatedAt: playlistInfo.updated_at,
      user: {
        id: playlistInfo.user_id,
        name: playlistInfo.user_name,
        email: playlistInfo.email
      },
      videos: videos.map((v: any) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        category: v.category,
        youtubeUrl: v.youtube_url,
        duration: v.duration,
        thumbnailUrl: v.thumbnail_url,
        order: v.order_num
      }))
    }
  }

  /**
   * 플레이리스트 업데이트
   */
  static async updatePlaylist(playlistId: string, userId: string, data: { name?: string }) {
    // 권한 확인
    const playlist = await this.getPlaylistById(playlistId, userId)
    if (!playlist) {
      throw new Error('플레이리스트를 찾을 수 없거나 권한이 없습니다')
    }

    // 업데이트
    await executeQuery(
      'UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [data.name || playlist.name, playlistId, userId]
    )

    return await this.getPlaylistById(playlistId, userId)
  }

  /**
   * 플레이리스트 삭제
   */
  static async deletePlaylist(playlistId: string, userId: string) {
    const result = await executeQuery(
      'DELETE FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, userId]
    )

    if (result.affectedRows === 0) {
      throw new Error('플레이리스트를 찾을 수 없거나 권한이 없습니다')
    }

    return { success: true }
  }

  /**
   * 플레이리스트에 비디오 추가
   */
  static async addVideoToPlaylist(playlistId: string, videoId: string, order?: number) {
    // 플레이리스트 존재 확인
    const playlist = await this.getPlaylistById(playlistId)
    if (!playlist) {
      throw new Error('플레이리스트를 찾을 수 없습니다')
    }

    // 비디오 존재 확인
    const video = await VideoService.getVideoById(videoId)
    if (!video) {
      throw new Error('비디오를 찾을 수 없습니다')
    }

    // 순서가 지정되지 않은 경우 마지막에 추가
    let finalOrder = order
    if (finalOrder === undefined) {
      const maxOrderResult = await executeQuery(
        'SELECT MAX(order_num) as max_order FROM playlist_videos WHERE playlist_id = ?',
        [playlistId]
      )
      finalOrder = (maxOrderResult[0]?.max_order || 0) + 1
    }

    // 프로시저 호출
    await DBPlaylistService.addVideoToPlaylist(playlistId, videoId, finalOrder)

    return {
      success: true,
      video: {
        id: video.id,
        title: video.title,
        order: finalOrder
      }
    }
  }

  /**
   * 플레이리스트에서 비디오 제거
   */
  static async removeVideoFromPlaylist(playlistId: string, videoId: string) {
    const result = await executeQuery(
      'DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
      [playlistId, videoId]
    )

    if (result.affectedRows === 0) {
      throw new Error('플레이리스트에서 해당 비디오를 찾을 수 없습니다')
    }

    // 순서 재정렬
    await executeQuery(
      `UPDATE playlist_videos pv1 
       SET order_num = (
         SELECT COUNT(*) + 1 
         FROM playlist_videos pv2 
         WHERE pv2.playlist_id = pv1.playlist_id 
         AND pv2.order_num < pv1.order_num
       )
       WHERE pv1.playlist_id = ?`,
      [playlistId]
    )

    return { success: true }
  }

  /**
   * 플레이리스트 비디오 순서 변경
   */
  static async reorderPlaylistVideos(playlistId: string, videoOrders: { videoId: string; order: number }[]) {
    const operations = videoOrders.map(({ videoId, order }) => 
      async (connection: any) => {
        const [result] = await connection.execute(
          'UPDATE playlist_videos SET order_num = ? WHERE playlist_id = ? AND video_id = ?',
          [order, playlistId, videoId]
        )
        return result
      }
    )

    await executeTransaction(operations)
    return { success: true }
  }

  /**
   * 플레이리스트 통계 계산
   */
  static async getPlaylistStats(playlistId: string, userId?: string): Promise<PlaylistStats | null> {
    const playlist = await this.getPlaylistById(playlistId, userId)
    
    if (!playlist) {
      return null
    }

    const totalVideos = playlist.videos.length
    const totalDuration = playlist.videos.reduce((sum: number, video: any) => sum + video.duration, 0)
    const averageDuration = totalVideos > 0 ? Math.round(totalDuration / totalVideos) : 0

    // 카테고리별 비디오 수 계산
    const categoryCount: { [key: string]: number } = {}
    playlist.videos.forEach((video: any) => {
      const category = video.category
      categoryCount[category] = (categoryCount[category] || 0) + 1
    })

    const videosByCategory = Object.entries(categoryCount).map(([category, count]) => ({
      category,
      count
    }))

    return {
      totalVideos,
      totalDuration,
      totalDurationFormatted: this.formatDuration(totalDuration),
      averageDuration,
      videosByCategory
    }
  }

  /**
   * 플레이리스트 복사
   */
  static async duplicatePlaylist(playlistId: string, userId: string, newName?: string) {
    // 원본 플레이리스트 조회
    const originalPlaylist = await this.getPlaylistById(playlistId, userId)

    if (!originalPlaylist) {
      throw new Error('플레이리스트를 찾을 수 없습니다')
    }

    // 새 플레이리스트 생성
    const duplicatedPlaylist = await this.createPlaylist(
      userId, 
      newName || `${originalPlaylist.name} (복사본)`
    )

    // 비디오들 복사
    if (originalPlaylist.videos.length > 0) {
      const operations = originalPlaylist.videos.map((video: any) => 
        async (connection: any) => {
          const [result] = await connection.execute(
            'INSERT INTO playlist_videos (playlist_id, video_id, order_num) VALUES (?, ?, ?)',
            [duplicatedPlaylist.id, video.id, video.order]
          )
          return result
        }
      )

      await executeTransaction(operations)
    }

    return duplicatedPlaylist
  }

  /**
   * 자동 플레이리스트 생성
   */
  static async createAutoPlaylist(userId: string, input: AutoPlaylistInput) {
    const { name, criteria } = input
    const { categories, minDuration, maxDuration, keywords, maxVideos = 20 } = criteria

    // 검색 조건 구성
    let whereClause = '1=1'
    const params: any[] = []

    if (categories && categories.length > 0) {
      whereClause += ` AND category IN (${categories.map(() => '?').join(', ')})`
      params.push(...categories)
    }

    if (minDuration !== undefined) {
      whereClause += ' AND duration >= ?'
      params.push(minDuration)
    }

    if (maxDuration !== undefined) {
      whereClause += ' AND duration <= ?'
      params.push(maxDuration)
    }

    if (keywords && keywords.length > 0) {
      const keywordConditions = keywords.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ')
      whereClause += ` AND (${keywordConditions})`
      keywords.forEach(keyword => {
        params.push(`%${keyword}%`, `%${keyword}%`)
      })
    }

    // 조건에 맞는 비디오 검색
    const videos = await executeQuery(
      `SELECT * FROM videos WHERE ${whereClause} ORDER BY created_at DESC LIMIT ?`,
      [...params, maxVideos]
    )

    if (videos.length === 0) {
      throw new Error('조건에 맞는 비디오가 없습니다')
    }

    // 플레이리스트 생성
    const playlist = await this.createPlaylist(userId, name)

    // 비디오들을 플레이리스트에 추가
    const operations = videos.map((video: any, index: number) => 
      async (connection: any) => {
        const [result] = await connection.execute(
          'INSERT INTO playlist_videos (playlist_id, video_id, order_num) VALUES (?, ?, ?)',
          [playlist.id, video.id, index + 1]
        )
        return result
      }
    )

    await executeTransaction(operations)

    return {
      playlist,
      addedVideos: videos.length
    }
  }

  /**
   * 플레이리스트 내보내기
   */
  static async exportPlaylist(playlistId: string, userId: string, format: 'json' | 'csv' | 'm3u' = 'json'): Promise<string> {
    const playlist = await this.getPlaylistById(playlistId, userId)

    if (!playlist) {
      throw new Error('플레이리스트를 찾을 수 없습니다')
    }

    const exportData: ExportData = {
      playlist: {
        id: playlist.id,
        name: playlist.name,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt
      },
      videos: playlist.videos.map((video: any) => ({
        id: video.id,
        title: video.title,
        description: video.description || undefined,
        category: video.category,
        youtubeUrl: video.youtubeUrl,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl || undefined,
        order: video.order
      })),
      metadata: {
        exportedAt: new Date(),
        totalVideos: playlist.videos.length,
        totalDuration: playlist.videos.reduce((sum: number, video: any) => sum + video.duration, 0)
      }
    }

    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2)

      case 'csv':
        const headers = ['Order', 'Title', 'Category', 'Duration', 'YouTube URL']
        const rows = exportData.videos.map(video => [
          video.order.toString(),
          `"${video.title.replace(/"/g, '""')}"`,
          video.category,
          this.formatDuration(video.duration),
          video.youtubeUrl
        ])
        
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
        return csvContent

      case 'm3u':
        const m3uContent = ['#EXTM3U']
        exportData.videos.forEach(video => {
          m3uContent.push(`#EXTINF:${video.duration},${video.title}`)
          m3uContent.push(video.youtubeUrl)
        })
        return m3uContent.join('\n')

      default:
        throw new Error('지원하지 않는 내보내기 형식입니다')
    }
  }

  /**
   * 재생시간 포맷팅
   */
  static formatDuration(seconds: number): string {
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

  /**
   * 플레이리스트 유효성 검사
   */
  static async validatePlaylistAccess(playlistId: string, userId: string): Promise<boolean> {
    const playlist = await this.getPlaylistById(playlistId, userId)
    return !!playlist
  }

  /**
   * 플레이리스트 비디오 순서 자동 정렬
   */
  static async autoSortPlaylist(playlistId: string, userId: string, sortBy: 'title' | 'duration' | 'createdAt' = 'title', order: 'asc' | 'desc' = 'asc') {
    // 플레이리스트 소유권 확인
    if (!await this.validatePlaylistAccess(playlistId, userId)) {
      throw new Error('플레이리스트를 찾을 수 없습니다')
    }

    // 현재 플레이리스트의 비디오들 가져오기
    const playlistVideos = await executeQuery(
      `SELECT pv.video_id, v.title, v.duration, v.created_at
       FROM playlist_videos pv
       JOIN videos v ON pv.video_id = v.id
       WHERE pv.playlist_id = ?
       ORDER BY pv.order_num`,
      [playlistId]
    )

    // 정렬
    playlistVideos.sort((a: any, b: any) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'duration':
          comparison = a.duration - b.duration
          break
        case 'createdAt':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }

      return order === 'desc' ? -comparison : comparison
    })

    // 새로운 순서로 업데이트
    const operations = playlistVideos.map((pv: any, index: number) =>
      async (connection: any) => {
        const [result] = await connection.execute(
          'UPDATE playlist_videos SET order_num = ? WHERE playlist_id = ? AND video_id = ?',
          [index + 1, playlistId, pv.video_id]
        )
        return result
      }
    )

    await executeTransaction(operations)

    return {
      sortedVideos: playlistVideos.length,
      sortBy,
      order
    }
  }
}