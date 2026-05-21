import React, { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { fetchPlaylists, createPlaylist, updatePlaylist, setFilters, Playlist } from '../../store/slices/playlistsSlice'
import PlaylistCard from './components/PlaylistCard'
import PlaylistDetailModal from './components/PlaylistDetailModal'
import './Playlists.css'
import { useSnackbar } from '@/contexts/SnackbarContext'

const Playlists: React.FC = () => {
  const dispatch = useAppDispatch()
  const { showSnackbar } = useSnackbar()
  const { playlists, isLoading, pagination, filters } = useAppSelector(
    (state) => state.playlists
  )

  const [searchTerm, setSearchTerm] = useState(filters.search)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null)
  const [editName, setEditName] = useState('')
  const [detailPlaylist, setDetailPlaylist] = useState<Playlist | null>(null)

  useEffect(() => {
    dispatch(fetchPlaylists(filters))
  }, [dispatch, filters])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    dispatch(setFilters({ search: searchTerm, page: 1 }))
  }

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPlaylistName.trim()) {
      try {
        await dispatch(createPlaylist({ name: newPlaylistName.trim() })).unwrap()
        setNewPlaylistName('')
        setShowCreateModal(false)
        dispatch(fetchPlaylists(filters))
      } catch (error) {
        console.error('플레이리스트 생성 실패:', error)
        showSnackbar({ message: '플레이리스트 생성에 실패했습니다.', severity: 'error' })
      }
    }
  }

  const handleEditPlaylist = (playlist: Playlist) => {
    setEditingPlaylist(playlist)
    setEditName(playlist.name)
  }

  const handleUpdatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlaylist || !editName.trim()) return

    try {
      await dispatch(updatePlaylist({ 
        id: editingPlaylist.id, 
        name: editName.trim() 
      })).unwrap()
      setEditingPlaylist(null)
      setEditName('')
      dispatch(fetchPlaylists(filters))
    } catch (error) {
      console.error('플레이리스트 수정 실패:', error)
      showSnackbar({ message: '플레이리스트 수정에 실패했습니다.', severity: 'error' })
    }
  }

  const handleOpenPlaylist = (playlist: Playlist) => {
    setDetailPlaylist(playlist)
  }

  const handleStartWorkout = (playlist: Playlist) => {
    // TODO: 운동 시작 기능 구현
    console.log('운동 시작:', playlist)
    showSnackbar({ message: '운동 시작 기능은 다음 단계에서 구현됩니다.', severity: 'info' })
  }

  const handlePlaylistUpdated = () => {
    dispatch(fetchPlaylists(filters))
  }

  const handlePageChange = (page: number) => {
    dispatch(setFilters({ page }))
  }

  if (isLoading) {
    return (
      <div className="videos-loading">
        <div className="videos-loading-text">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="playlists-container">
      <div className="playlists-header">
        <div>
          <h1 className="playlists-title">플레이리스트</h1>
          <p className="playlists-subtitle">
            운동 비디오를 플레이리스트로 구성하여 관리하세요.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          새 플레이리스트
        </button>
      </div>

      {/* 검색 */}
      <div className="playlists-search">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="플레이리스트 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input search-input"
          />
          <button type="submit" className="btn-primary">
            검색
          </button>
        </form>
      </div>

      {/* 플레이리스트 그리드 */}
      <div className="playlists-grid">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            onEdit={handleEditPlaylist}
            onOpen={handleOpenPlaylist}
            onStartWorkout={handleStartWorkout}
            onPlaylistUpdated={handlePlaylistUpdated}
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
      {playlists.length === 0 && (
        <div className="playlists-empty">
          <div className="playlists-empty-title">플레이리스트가 없습니다.</div>
          <p className="playlists-empty-subtitle">
            첫 번째 플레이리스트를 만들어보세요.
          </p>
        </div>
      )}

      {/* 플레이리스트 생성 모달 */}
      {showCreateModal && (
        <div className="create-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="create-modal-title">새 플레이리스트 만들기</h2>
            <form onSubmit={handleCreatePlaylist}>
              <div className="form-group">
                <label className="form-label">
                  플레이리스트 이름
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="form-input"
                  placeholder="예: 아침 운동 루틴"
                  required
                />
              </div>
              <div className="create-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewPlaylistName('')
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button type="submit" className="btn-primary">
                  만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 플레이리스트 수정 모달 */}
      {editingPlaylist && (
        <div className="create-modal-overlay" onClick={() => setEditingPlaylist(null)}>
          <div className="create-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="create-modal-title">플레이리스트 수정</h2>
            <form onSubmit={handleUpdatePlaylist}>
              <div className="form-group">
                <label className="form-label">
                  플레이리스트 이름
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="create-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlaylist(null)
                    setEditName('')
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button type="submit" className="btn-primary">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 플레이리스트 상세 모달 */}
      <PlaylistDetailModal
        playlist={detailPlaylist}
        isOpen={!!detailPlaylist}
        onClose={() => setDetailPlaylist(null)}
        onPlaylistUpdated={handlePlaylistUpdated}
      />
    </div>
  )
}

export default Playlists