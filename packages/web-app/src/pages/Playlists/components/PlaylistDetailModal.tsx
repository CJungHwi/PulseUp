import React, { useState, useEffect } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useAppDispatch } from '../../../hooks/redux'
import { playlistsAPI } from '../../../services/api'
import { Playlist, PlaylistVideo } from '../../../store/slices/playlistsSlice'
import { useSnackbar } from '@/contexts/SnackbarContext'

interface Video {
  id: string
  title: string
  description?: string
  category: string
  youtubeUrl: string
  duration: number
  thumbnailUrl?: string
}

interface PlaylistDetailModalProps {
  playlist: Playlist | null
  isOpen: boolean
  onClose: () => void
  onPlaylistUpdated: () => void
}

const DraggableVideoItem: React.FC<{
  playlistVideo: PlaylistVideo
  index: number
  moveVideo: (dragIndex: number, hoverIndex: number) => void
  onRemove: (videoId: string) => void
}> = ({ playlistVideo, index, moveVideo, onRemove }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'video',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [, drop] = useDrop({
    accept: 'video',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveVideo(item.index, index)
        item.index = index
      }
    },
  })

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`playlist-video-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="video-drag-handle">⋮⋮</div>
      
      {playlistVideo.video.thumbnailUrl && (
        <img
          src={playlistVideo.video.thumbnailUrl}
          alt={playlistVideo.video.title}
          className="video-item-thumbnail"
        />
      )}
      
      <div className="video-item-content">
        <h4 className="video-item-title">{playlistVideo.video.title}</h4>
        <div className="video-item-meta">
          <span className="video-item-category">{playlistVideo.video.category}</span>
          <span className="video-item-duration">
            {formatDuration(playlistVideo.video.duration)}
          </span>
        </div>
      </div>
      
      <button
        onClick={() => onRemove(playlistVideo.video.id)}
        className="video-item-remove"
        title="비디오 제거"
      >
        ×
      </button>
    </div>
  )
}

const PlaylistDetailModal: React.FC<PlaylistDetailModalProps> = ({
  playlist,
  isOpen,
  onClose,
  onPlaylistUpdated,
}) => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()
  const [playlistData, setPlaylistData] = useState<Playlist | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (playlist && isOpen) {
      loadPlaylistDetails()
    }
  }, [playlist, isOpen])

  const loadPlaylistDetails = async () => {
    if (!playlist) return

    setIsLoading(true)
    try {
      const response = await playlistsAPI.getPlaylistById(playlist.id)
      setPlaylistData(response.data)
    } catch (error) {
      console.error('플레이리스트 상세 정보 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const moveVideo = (dragIndex: number, hoverIndex: number) => {
    if (!playlistData) return

    const draggedVideo = playlistData.videos[dragIndex]
    const newVideos = [...playlistData.videos]
    newVideos.splice(dragIndex, 1)
    newVideos.splice(hoverIndex, 0, draggedVideo)

    setPlaylistData({
      ...playlistData,
      videos: newVideos,
    })
  }

  const removeVideo = async (videoId: string) => {
    if (!playlistData) return

    try {
      await playlistsAPI.removeVideoFromPlaylist(playlistData.id, videoId)
      setPlaylistData({
        ...playlistData,
        videos: playlistData.videos.filter(pv => pv.video.id !== videoId),
      })
      onPlaylistUpdated()
    } catch (error) {
      console.error('비디오 제거 실패:', error)
      showSnackbar({ message: '비디오 제거에 실패했습니다.', severity: 'error' })
    }
  }

  const saveOrder = async () => {
    if (!playlistData) return

    setIsSaving(true)
    try {
      const videoOrders = playlistData.videos.map((pv, index) => ({
        videoId: pv.video.id,
        order: index + 1,
      }))

      await playlistsAPI.reorderVideos(playlistData.id, { videoOrders })
      onPlaylistUpdated()
      showSnackbar({ message: '순서가 저장되었습니다.', severity: 'success' })
    } catch (error) {
      console.error('순서 저장 실패:', error)
      showSnackbar({ message: '순서 저장에 실패했습니다.', severity: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const getTotalDuration = () => {
    if (!playlistData) return 0
    return playlistData.videos.reduce((total, pv) => total + pv.video.duration, 0)
  }

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`
    }
    return `${minutes}분`
  }

  if (!isOpen || !playlist) return null

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">{playlist.name}</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {isLoading ? (
              <div className="loading-center">
                <div className="loading-spinner"></div>
                <p>로딩 중...</p>
              </div>
            ) : playlistData ? (
              <>
                <div className="playlist-stats">
                  <div className="stat-item">
                    <span className="stat-label">비디오 수:</span>
                    <span className="stat-value">{playlistData.videos.length}개</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">총 재생시간:</span>
                    <span className="stat-value">{formatTotalDuration(getTotalDuration())}</span>
                  </div>
                </div>

                <div className="playlist-videos">
                  <div className="videos-header">
                    <h3>비디오 목록</h3>
                    <button
                      onClick={saveOrder}
                      disabled={isSaving}
                      className="btn-primary"
                    >
                      {isSaving ? '저장 중...' : '순서 저장'}
                    </button>
                  </div>

                  {playlistData.videos.length === 0 ? (
                    <div className="empty-playlist">
                      <p>플레이리스트가 비어있습니다.</p>
                      <p>비디오 페이지에서 비디오를 추가해보세요.</p>
                    </div>
                  ) : (
                    <div className="videos-list">
                      {playlistData.videos.map((pv, index) => (
                        <DraggableVideoItem
                          key={pv.id}
                          playlistVideo={pv}
                          index={index}
                          moveVideo={moveVideo}
                          onRemove={removeVideo}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="error-state">
                <p>플레이리스트를 불러올 수 없습니다.</p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn-secondary">
              닫기
            </button>
          </div>
        </div>
      </div>
    </DndProvider>
  )
}

export default PlaylistDetailModal