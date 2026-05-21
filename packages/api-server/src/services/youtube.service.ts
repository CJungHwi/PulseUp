import { google, youtube_v3 } from 'googleapis'

export interface YouTubeVideoMetadata {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  duration: number // 초 단위
  channelTitle: string
  publishedAt: string
  viewCount: number
  likeCount?: number
  categoryId: string
  tags: string[]
  defaultLanguage?: string
  defaultAudioLanguage?: string
}

export interface YouTubePlaylistMetadata {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  channelTitle: string
  publishedAt: string
  itemCount: number
  videos: YouTubeVideoMetadata[]
}

export class YouTubeService {
  private youtube: youtube_v3.Youtube
  private apiKey: string
  private requestCount: number = 0
  private lastResetTime: number = Date.now()
  private readonly QUOTA_LIMIT = 10000 // 일일 할당량
  private readonly REQUESTS_PER_MINUTE = 100 // 분당 요청 제한

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || ''
    
    if (!this.apiKey) {
      throw new Error('YOUTUBE_API_KEY 환경 변수가 설정되지 않았습니다')
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    })
  }

  /**
   * Rate limiting 체크
   */
  private checkRateLimit(): void {
    const now = Date.now()
    const oneMinute = 60 * 1000

    // 1분마다 카운터 리셋
    if (now - this.lastResetTime > oneMinute) {
      this.requestCount = 0
      this.lastResetTime = now
    }

    if (this.requestCount >= this.REQUESTS_PER_MINUTE) {
      throw new Error('YouTube API 요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    }

    this.requestCount++
  }

  /**
   * YouTube URL에서 비디오 ID 추출
   */
  static extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return null
  }

  /**
   * YouTube URL에서 플레이리스트 ID 추출
   */
  static extractPlaylistId(url: string): string | null {
    const pattern = /[?&]list=([^&\n?#]+)/
    const match = url.match(pattern)
    return match ? match[1] : null
  }

  /**
   * ISO 8601 duration을 초로 변환
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0

    const hours = parseInt(match[1] || '0', 10)
    const minutes = parseInt(match[2] || '0', 10)
    const seconds = parseInt(match[3] || '0', 10)

    return hours * 3600 + minutes * 60 + seconds
  }

  /**
   * 비디오 메타데이터 가져오기
   */
  async getVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata | null> {
    try {
      this.checkRateLimit()

      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId]
      })

      const video = response.data.items?.[0]
      if (!video) {
        return null
      }

      const snippet = video.snippet!
      const contentDetails = video.contentDetails!
      const statistics = video.statistics!

      return {
        id: videoId,
        title: snippet.title || '',
        description: snippet.description || '',
        thumbnailUrl: snippet.thumbnails?.maxres?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url || 
                     snippet.thumbnails?.default?.url || '',
        duration: this.parseDuration(contentDetails.duration || 'PT0S'),
        channelTitle: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt || '',
        viewCount: parseInt(statistics.viewCount || '0', 10),
        likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
        categoryId: snippet.categoryId || '',
        tags: snippet.tags || [],
        defaultLanguage: snippet.defaultLanguage || undefined,
        defaultAudioLanguage: snippet.defaultAudioLanguage || undefined
      }
    } catch (error) {
      console.error('YouTube API 에러:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('quotaExceeded')) {
          throw new Error('YouTube API 할당량이 초과되었습니다')
        } else if (error.message.includes('videoNotFound')) {
          throw new Error('비디오를 찾을 수 없습니다')
        } else if (error.message.includes('forbidden')) {
          throw new Error('비디오에 접근할 수 없습니다')
        }
      }

      throw new Error('YouTube API 요청 중 오류가 발생했습니다')
    }
  }

  /**
   * URL에서 비디오 메타데이터 가져오기
   */
  async getVideoMetadataFromUrl(url: string): Promise<YouTubeVideoMetadata | null> {
    const videoId = YouTubeService.extractVideoId(url)
    if (!videoId) {
      throw new Error('유효하지 않은 YouTube URL입니다')
    }

    return this.getVideoMetadata(videoId)
  }

  /**
   * 플레이리스트 메타데이터 가져오기
   */
  async getPlaylistMetadata(playlistId: string, maxResults: number = 50): Promise<YouTubePlaylistMetadata | null> {
    try {
      this.checkRateLimit()

      // 플레이리스트 기본 정보 가져오기
      const playlistResponse = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        id: [playlistId]
      })

      const playlist = playlistResponse.data.items?.[0]
      if (!playlist) {
        return null
      }

      // 플레이리스트 아이템 가져오기
      const itemsResponse = await this.youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: playlistId,
        maxResults: maxResults
      })

      const videos: YouTubeVideoMetadata[] = []
      
      if (itemsResponse.data.items) {
        // 각 비디오의 상세 정보 가져오기
        const videoIds = itemsResponse.data.items
          .map(item => item.contentDetails?.videoId)
          .filter(Boolean) as string[]

        if (videoIds.length > 0) {
          const videosResponse = await this.youtube.videos.list({
            part: ['snippet', 'contentDetails', 'statistics'],
            id: videoIds
          })

          if (videosResponse.data.items) {
            for (const video of videosResponse.data.items) {
              const snippet = video.snippet!
              const contentDetails = video.contentDetails!
              const statistics = video.statistics!

              videos.push({
                id: video.id!,
                title: snippet.title || '',
                description: snippet.description || '',
                thumbnailUrl: snippet.thumbnails?.maxres?.url || 
                             snippet.thumbnails?.high?.url || 
                             snippet.thumbnails?.medium?.url || 
                             snippet.thumbnails?.default?.url || '',
                duration: this.parseDuration(contentDetails.duration || 'PT0S'),
                channelTitle: snippet.channelTitle || '',
                publishedAt: snippet.publishedAt || '',
                viewCount: parseInt(statistics.viewCount || '0', 10),
                likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
                categoryId: snippet.categoryId || '',
                tags: snippet.tags || [],
                defaultLanguage: snippet.defaultLanguage || undefined,
                defaultAudioLanguage: snippet.defaultAudioLanguage || undefined
              })
            }
          }
        }
      }

      const snippet = playlist.snippet!
      const contentDetails = playlist.contentDetails!

      return {
        id: playlistId,
        title: snippet.title || '',
        description: snippet.description || '',
        thumbnailUrl: snippet.thumbnails?.maxres?.url || 
                     snippet.thumbnails?.high?.url || 
                     snippet.thumbnails?.medium?.url || 
                     snippet.thumbnails?.default?.url || '',
        channelTitle: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt || '',
        itemCount: contentDetails.itemCount || 0,
        videos
      }
    } catch (error) {
      console.error('YouTube Playlist API 에러:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('quotaExceeded')) {
          throw new Error('YouTube API 할당량이 초과되었습니다')
        } else if (error.message.includes('playlistNotFound')) {
          throw new Error('플레이리스트를 찾을 수 없습니다')
        }
      }

      throw new Error('YouTube Playlist API 요청 중 오류가 발생했습니다')
    }
  }

  /**
   * 비디오 검색
   */
  async searchVideos(query: string, maxResults: number = 25, categoryId?: string): Promise<YouTubeVideoMetadata[]> {
    try {
      this.checkRateLimit()

      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: maxResults,
        videoCategoryId: categoryId,
        order: 'relevance'
      })

      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return []
      }

      // 검색 결과에서 비디오 ID 추출
      const videoIds = searchResponse.data.items
        .map(item => item.id?.videoId)
        .filter(Boolean) as string[]

      if (videoIds.length === 0) {
        return []
      }

      // 비디오 상세 정보 가져오기
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds
      })

      const videos: YouTubeVideoMetadata[] = []

      if (videosResponse.data.items) {
        for (const video of videosResponse.data.items) {
          const snippet = video.snippet!
          const contentDetails = video.contentDetails!
          const statistics = video.statistics!

          videos.push({
            id: video.id!,
            title: snippet.title || '',
            description: snippet.description || '',
            thumbnailUrl: snippet.thumbnails?.maxres?.url || 
                         snippet.thumbnails?.high?.url || 
                         snippet.thumbnails?.medium?.url || 
                         snippet.thumbnails?.default?.url || '',
            duration: this.parseDuration(contentDetails.duration || 'PT0S'),
            channelTitle: snippet.channelTitle || '',
            publishedAt: snippet.publishedAt || '',
            viewCount: parseInt(statistics.viewCount || '0', 10),
            likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
            categoryId: snippet.categoryId || '',
            tags: snippet.tags || [],
            defaultLanguage: snippet.defaultLanguage || undefined,
            defaultAudioLanguage: snippet.defaultAudioLanguage || undefined
          })
        }
      }

      return videos
    } catch (error) {
      console.error('YouTube Search API 에러:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('quotaExceeded')) {
          throw new Error('YouTube API 할당량이 초과되었습니다')
        }
      }

      throw new Error('YouTube Search API 요청 중 오류가 발생했습니다')
    }
  }

  /**
   * 비디오 카테고리 목록 가져오기
   */
  async getVideoCategories(regionCode: string = 'KR'): Promise<Array<{ id: string; title: string }>> {
    try {
      this.checkRateLimit()

      const response = await this.youtube.videoCategories.list({
        part: ['snippet'],
        regionCode: regionCode
      })

      if (!response.data.items) {
        return []
      }

      return response.data.items.map(category => ({
        id: category.id!,
        title: category.snippet?.title || ''
      }))
    } catch (error) {
      console.error('YouTube Categories API 에러:', error)
      throw new Error('YouTube Categories API 요청 중 오류가 발생했습니다')
    }
  }

  /**
   * API 사용량 통계
   */
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      lastResetTime: this.lastResetTime,
      quotaLimit: this.QUOTA_LIMIT,
      requestsPerMinute: this.REQUESTS_PER_MINUTE
    }
  }

  /**
   * 비디오 URL 유효성 검사
   */
  static isValidYouTubeUrl(url: string): boolean {
    return this.extractVideoId(url) !== null
  }

  /**
   * 플레이리스트 URL 유효성 검사
   */
  static isValidYouTubePlaylistUrl(url: string): boolean {
    return this.extractPlaylistId(url) !== null
  }
}