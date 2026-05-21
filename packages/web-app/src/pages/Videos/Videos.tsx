import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { fetchVideos, fetchCategories, setFilters, Video } from '../../store/slices/videosSlice'
import VideoCard from './components/VideoCard'
import AddVideoModal from './components/AddVideoModal'
import './Videos.css'
import { useSnackbar } from '@/contexts/SnackbarContext'

const Videos: React.FC = () => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()
  const { videos, categories, isLoading, pagination, filters } = useAppSelector(
    (state) => state.videos
  )

  const [searchTerm, setSearchTerm] = useState(filters.search)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchVideos(filters))
    dispatch(fetchCategories())
  }, [dispatch, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(setFilters({ search: searchTerm, page: 1 }))
  }

  const handleCategoryChange = (category: string) => {
    dispatch(setFilters({ category, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    dispatch(setFilters({ page }))
  }

  const handleVideoUpdated = () => {
    dispatch(fetchVideos(filters))
  }

  const handleAddToPlaylist = (video: Video) => {
    // TODO: 플레이리스트 추가 모달 구현
    console.log('플레이리스트에 추가:', video)
    showSnackbar({ message: '플레이리스트 추가 기능은 다음 단계에서 구현됩니다.', severity: 'info' })
  }

  if (isLoading) {
    return (
      <div className="videos-loading">
        <div className="videos-loading-text">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="videos-container">
      <div className="videos-header">
        <h1 className="videos-title">운동 비디오</h1>
        <p className="videos-subtitle">
          YouTube에서 가져온 운동 비디오들을 관리하세요.
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="videos-filters">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="비디오 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input search-input"
          />
          <button type="submit" className="btn-primary">
            검색
          </button>
        </form>

        {/* 카테고리 필터 */}
        <div className="category-filters">
          <button
            onClick={() => handleCategoryChange('')}
            className={`category-filter-btn ${filters.category === '' ? 'active' : ''}`}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`category-filter-btn ${filters.category === category ? 'active' : ''}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* 비디오 그리드 */}
      <div className="videos-grid">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onVideoUpdated={handleVideoUpdated}
            onAddToPlaylist={handleAddToPlaylist}
          />
        ))}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="videos-pagination">
          <nav className="pagination-nav">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
                >
                  {page}
                </button>
              )
            )}
          </nav>
        </div>
      )}

      {/* 빈 상태 */}
      {videos.length === 0 && (
        <div className="videos-empty">
          <div className="videos-empty-title">비디오가 없습니다.</div>
          <p className="videos-empty-subtitle">
            YouTube에서 운동 비디오를 추가해보세요.
          </p>
        </div>
      )}

      {/* 비디오 추가 버튼 */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="add-video-btn"
        title="비디오 추가"
      >
        +
      </button>

      {/* 비디오 추가 모달 */}
      <AddVideoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}

export default Videos