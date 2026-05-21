import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../hooks/redux'
import { videosAPI } from '../../../services/api'
import { fetchVideos } from '../../../store/slices/videosSlice'

interface AddVideoModalProps {
  isOpen: boolean
  onClose: () => void
}

const AddVideoModal: React.FC<AddVideoModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const { categories, filters } = useAppSelector((state) => state.videos)
  
  const [formData, setFormData] = useState({
    youtubeUrl: '',
    category: '',
    customCategory: '',
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewData, setPreviewData] = useState<any>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handlePreview = async () => {
    if (!formData.youtubeUrl) {
      setError('YouTube URL을 입력해주세요')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const response = await videosAPI.getYouTubeMetadata(formData.youtubeUrl)
      setPreviewData(response.data)
    } catch (error: any) {
      setError(error.response?.data?.error || '비디오 정보를 가져올 수 없습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!previewData) {
      setError('먼저 미리보기를 확인해주세요')
      return
    }

    const category = formData.category === 'custom' ? formData.customCategory : formData.category
    if (!category) {
      setError('카테고리를 선택하거나 입력해주세요')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await videosAPI.importFromYouTube({
        youtubeUrl: formData.youtubeUrl,
        category,
      })
      
      // 비디오 목록 새로고침
      dispatch(fetchVideos(filters))
      
      // 모달 닫기 및 폼 초기화
      onClose()
      setFormData({ youtubeUrl: '', category: '', customCategory: '' })
      setPreviewData(null)
    } catch (error: any) {
      setError(error.response?.data?.error || '비디오 추가에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">YouTube 비디오 추가</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="youtubeUrl" className="form-label">
              YouTube URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                id="youtubeUrl"
                name="youtubeUrl"
                value={formData.youtubeUrl}
                onChange={handleInputChange}
                placeholder="https://www.youtube.com/watch?v=..."
                className="form-input flex-1"
                required
              />
              <button
                type="button"
                onClick={handlePreview}
                disabled={isLoading || !formData.youtubeUrl}
                className="btn-secondary"
              >
                {isLoading ? '로딩...' : '미리보기'}
              </button>
            </div>
          </div>

          {previewData && (
            <div className="video-preview">
              <h3 className="text-lg font-semibold mb-2">미리보기</h3>
              <div className="flex gap-4">
                {previewData.thumbnailUrl && (
                  <img
                    src={previewData.thumbnailUrl}
                    alt={previewData.title}
                    className="w-32 h-24 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">{previewData.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {previewData.description?.substring(0, 100)}...
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    재생시간: {formatDuration(previewData.duration)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="category" className="form-label">
              카테고리
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="form-input"
              required
            >
              <option value="">카테고리 선택</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value="custom">새 카테고리 만들기</option>
            </select>
          </div>

          {formData.category === 'custom' && (
            <div className="form-group">
              <label htmlFor="customCategory" className="form-label">
                새 카테고리 이름
              </label>
              <input
                type="text"
                id="customCategory"
                name="customCategory"
                value={formData.customCategory}
                onChange={handleInputChange}
                placeholder="카테고리 이름 입력"
                className="form-input"
                required
              />
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || !previewData}
            >
              {isLoading ? '추가 중...' : '비디오 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddVideoModal