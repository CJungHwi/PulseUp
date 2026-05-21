import React, { useState } from 'react'
import { Video } from '../../../store/slices/videosSlice'
import { videosAPI } from '../../../services/api'
import { useSnackbar } from '@/contexts/SnackbarContext'

interface VideoCardProps {
  video: Video
  onVideoUpdated: () => void
  onAddToPlaylist: (video: Video) => void
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onVideoUpdated, onAddToPlaylist }) => {
  const { showSnackbar } = useSnackbar()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editData, setEditData] = useState({
    title: video.title,
    description: video.description || '',
    category: video.category,
  })

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await videosAPI.updateVideo(video.id, editData)
      setIsEditing(false)
      onVideoUpdated()
    } catch (error) {
      console.error('비디오 수정 실패:', error)
      showSnackbar({ message: '비디오 수정에 실패했습니다.', severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말로 이 비디오를 삭제하시겠습니까?')) {
      return
    }

    setIsDeleting(true)
    try {
      await videosAPI.deleteVideo(video.id)
      onVideoUpdated()
    } catch (error) {
      console.error('비디오 삭제 실패:', error)
      showSnackbar({ message: '비디오 삭제에 실패했습니다.', severity: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData(prev => ({ ...prev, [name]: value }))
  }

  if (isEditing) {
    return (
      <div className="video-card editing">
        <form onSubmit={handleEdit} className="p-4">
          <div className="form-group mb-3">
            <label className="form-label">제목</label>
            <input
              type="text"
              name="title"
              value={editData.title}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>
          
          <div className="form-group mb-3">
            <label className="form-label">설명</label>
            <textarea
              name="description"
              value={editData.description}
              onChange={handleInputChange}
              className="form-input"
              rows={3}
            />
          </div>
          
          <div className="form-group mb-3">
            <label className="form-label">카테고리</label>
            <input
              type="text"
              name="category"
              value={editData.category}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>
          
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              저장
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-secondary flex-1"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="video-card">
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="video-thumbnail"
        />
      )}
      
      <div className="video-content">
        <h3 className="video-title">{video.title}</h3>
        
        {video.description && (
          <p className="video-description">
            {video.description}
          </p>
        )}
        
        <div className="video-meta">
          <span className="video-category">{video.category}</span>
          <span className="video-duration">{formatDuration(video.duration)}</span>
        </div>
        
        <div className="video-actions">
          <button
            onClick={() => onAddToPlaylist(video)}
            className="btn-primary video-action-btn"
          >
            플레이리스트에 추가
          </button>
          
          <a
            href={video.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary video-action-btn"
          >
            YouTube
          </a>
          
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary video-action-btn"
          >
            수정
          </button>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-danger video-action-btn"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VideoCard