import React, { useState } from 'react'
import { useAppDispatch } from '../../../hooks/redux'
import { deletePlaylist, duplicatePlaylist } from '../../../store/slices/playlistsSlice'
import { useSnackbar } from '@/contexts/SnackbarContext'

interface Playlist {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count?: {
    videos: number
  }
  videos?: Array<{
    id: string
    video: {
      id: string
      title: string
      thumbnailUrl?: string
    }
  }>
}

interface PlaylistCardProps {
  playlist: Playlist
  onEdit: (playlist: Playlist) => void
  onOpen: (playlist: Playlist) => void
  onStartWorkout: (playlist: Playlist) => void
  onPlaylistUpdated: () => void
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onEdit,
  onOpen,
  onStartWorkout,
  onPlaylistUpdated,
}) => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`"${playlist.name}" 플레이리스트를 삭제하시겠습니까?`)) {
      return
    }

    setIsDeleting(true)
    try {
      await dispatch(deletePlaylist(playlist.id)).unwrap()
      onPlaylistUpdated()
    } catch (error) {
      console.error('플레이리스트 삭제 실패:', error)
      showSnackbar({ message: '플레이리스트 삭제에 실패했습니다.', severity: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      await dispatch(duplicatePlaylist(playlist.id)).unwrap()
      onPlaylistUpdated()
    } catch (error) {
      console.error('플레이리스트 복제 실패:', error)
      showSnackbar({ message: '플레이리스트 복제에 실패했습니다.', severity: 'error' })
    } finally {
      setIsDuplicating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  return (
    <div className="playlist-card">
      <div className="playlist-content">
        <h3 className="playlist-title">{playlist.name}</h3>
        
        <div className="playlist-meta">
          <span className="playlist-video-count">
            {playlist._count?.videos || 0}개의 비디오
          </span>
          <span className="playlist-date">
            {formatDate(playlist.updatedAt)}
          </span>
        </div>

        {/* 미리보기 비디오들 */}
        {playlist.videos && playlist.videos.length > 0 && (
          <div className="playlist-preview">
            <div className="preview-grid">
              {playlist.videos.slice(0, 3).map((pv) => (
                <div key={pv.id} className="preview-item">
                  {pv.video.thumbnailUrl ? (
                    <img
                      src={pv.video.thumbnailUrl}
                      alt={pv.video.title}
                      className="preview-thumbnail"
                    />
                  ) : (
                    <div className="preview-placeholder">
                      🎥
                    </div>
                  )}
                </div>
              ))}
              {playlist.videos.length > 3 && (
                <div className="preview-more">
                  +{playlist.videos.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="playlist-actions">
          <button
            onClick={() => onOpen(playlist)}
            className="btn-primary playlist-action-btn"
          >
            열기
          </button>
          
          <button
            onClick={() => onStartWorkout(playlist)}
            className="btn-success playlist-action-btn"
            disabled={!playlist._count?.videos}
          >
            운동 시작
          </button>
        </div>

        <div className="playlist-menu">
          <button
            onClick={() => onEdit(playlist)}
            className="btn-secondary playlist-menu-btn"
          >
            수정
          </button>
          
          <button
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="btn-secondary playlist-menu-btn"
          >
            {isDuplicating ? '복제 중...' : '복제'}
          </button>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-danger playlist-menu-btn"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlaylistCard