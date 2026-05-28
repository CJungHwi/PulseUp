/**
 * 페이지 요약 — Vimeo 관리 (`/admin/vimeo`)
 *
 * 기능: Vimeo 계정 동기화·비디오 메타 조회·엑셀 가져오기/보내기 등 콘텐츠 관리.
 *
 * 호출/연동:
 * - `apiClient` (`services/api.service.ts`) — 백엔드 동기화·저장 API
 * - `fetch` → `https://api.vimeo.com/...` (Vimeo REST)
 * - DB/SP는 `packages/api-server` Vimeo 연동 라우트 참조.
 *
 * 관련 컴포넌트(`./components/`): 카드·테이블·다이얼로그·엑셀 유틸(`vimeoExcelImport`/`Export`).
 *
 * 흐름: 토큰·필터 설정 → Vimeo/서버 API로 목록 동기 → 편집·저장.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Badge } from '../../../components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../../components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select'
import {
    RefreshCw,
    Search,
    Play,
    Copy,
    Settings,
    Video,
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Info,
    Upload,
    Trash2,
    FileSpreadsheet
} from 'lucide-react'
import { apiClient } from '../../../services/api.service'
import { cn } from '../../../lib/utils'
import { downloadVimeoVideosAsXlsx } from './components/vimeoExcelExport'
import {
    parseVimeoExcelSheetFromB2,
    findVideoIdByVimeoTitle,
    countVideosWithTrimmedTitle,
} from './components/vimeoExcelImport'

// Vimeo 영상 타입 정의
interface VimeoVideo {
    id: string
    uri: string
    name: string
    description: string | null
    duration: number
    width: number
    height: number
    created_time: string
    modified_time: string
    status: string
    pictures: {
        sizes: Array<{
            width: number
            height: number
            link: string
        }>
    }
    link: string
    player_embed_url: string
    privacy: {
        view: string
        embed: string
    }
    parent_folder?: {
        name: string
        uri: string
    }
    no?: number
    created_at?: string
    updated_at?: string
    is_active?: boolean | number
    workout_category_id?: string | null
}

interface VimeoApiResponse {
    total: number
    page: number
    per_page: number
    paging: {
        next: string | null
        previous: string | null
        first: string
        last: string
    }
    data: VimeoVideo[]
}

// 로컬 스토리지 키
const VIMEO_TOKEN_KEY = 'vimeo_access_token'
const VIMEO_LAST_SYNC_AT_KEY = 'vimeo_last_sync_at'

// URI에서 영상 ID 추출
const extractVideoId = (uri: string) => uri.split('/').pop() || uri

const filterVimeoVideosByKeyword = (list: VimeoVideo[], keyword: string): VimeoVideo[] => {
    if (!keyword.trim()) return list
    const lowerKeyword = keyword.toLowerCase().trim()
    return list.filter(video => {
        const videoId = extractVideoId(video.uri ?? '')
        return (
            videoId.includes(lowerKeyword) ||
            (video.name?.toLowerCase() ?? '').includes(lowerKeyword) ||
            (video.description?.toLowerCase() ?? '').includes(lowerKeyword) ||
            (video.parent_folder?.name?.toLowerCase() ?? '').includes(lowerKeyword) ||
            (video.status?.toLowerCase() ?? '').includes(lowerKeyword) ||
            (video.privacy?.view?.toLowerCase() ?? '').includes(lowerKeyword)
        )
    })
}

/** Vimeo가 라이브러리 루트에 부여하는 parent_folder.name — 실제 하위 폴더로 보지 않음 */
const isVimeoRootLibraryFolderName = (raw: string) => {
    const t = raw.trim()
    if (t === '내 라이브러리') return true
    if (t.toLowerCase() === 'my library') return true
    return false
}

const isEligibleVimeoSyncParentFolderName = (raw: string | undefined | null) => {
    const t = (raw ?? '').trim()
    if (t === '') return false
    if (isVimeoRootLibraryFolderName(t)) return false
    return true
}

// 환경변수에서 토큰 가져오기 (Vite는 VITE_ 접두사 필요)
const ENV_VIMEO_TOKEN = import.meta.env.VITE_VIMEO_ACCESS_TOKEN as string | undefined

/** 동기화 범위 Select — "전체" 옵션 값 (실제 폴더명과 충돌 방지) */
const SYNC_FOLDER_ALL = '__ALL__'

const Vimeo: React.FC = () => {
    // 상태 관리
    const [accessToken, setAccessToken] = useState<string>('')
    const [tempToken, setTempToken] = useState<string>('')
    const [videos, setVideos] = useState<VimeoVideo[]>([])
    const [loading, setLoading] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState('')
    const [selectedVideo, setSelectedVideo] = useState<VimeoVideo | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [copySuccess, setCopySuccess] = useState<string | null>(null)
    const [isEnvToken, setIsEnvToken] = useState(false)
    const [fullSyncLoading, setFullSyncLoading] = useState(false)
    const [lastSyncAtMs, setLastSyncAtMs] = useState<number | null>(null)
    const [updateDescToVimeoLoading, setUpdateDescToVimeoLoading] = useState(false)
    const [excelImportLoading, setExcelImportLoading] = useState(false)
    const [showExcelImportConfirm, setShowExcelImportConfirm] = useState(false)
    const excelImportInputRef = useRef<HTMLInputElement>(null)
    const [editableDescription, setEditableDescription] = useState<string>('')
    const [showPurgeInactiveDialog, setShowPurgeInactiveDialog] = useState(false)
    const [purgeInactiveLoading, setPurgeInactiveLoading] = useState(false)
    const [excelExportLoading, setExcelExportLoading] = useState(false)
    /** 빈 문자열 = 범위 전체(전체 범위 DB 동기화), 값 있음 = 해당 상위폴더만 */
    const [syncFolderScope, setSyncFolderScope] = useState<string>('')

    // 스낵바(우측 상단) 알림
    const [notification, setNotification] = useState<{
        message: string
        type: 'success' | 'error' | 'info'
    } | null>(null)

    const showNotification = (
        message: string,
        type: 'success' | 'error' | 'info' = 'success',
        durationMs = 3000
    ) => {
        setNotification({ message, type })
        setTimeout(() => setNotification(null), durationMs)
    }

    // Infinite Scroll & Search 상태
    const [displayCount, setDisplayCount] = useState(20)
    const loadMoreRef = useRef<HTMLDivElement | null>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)

    const fetchingRef = useRef(false) // 중복 fetch 방지용

    // 테이블 컬럼 너비 (리사이징 가능)
    const [vimeoTableColWidths, setVimeoTableColWidths] = useState({
        no: 60,
        badge: 70,
        parent_folder: 150,
        video_id: 100,
        title: 400,
        description: 300,
        thumbnail: 200,
        duration: 80,
        status: 120,
        privacy: 120,
    })
    const [resizingCol, setResizingCol] = useState<string | null>(null)
    const resizeStartXRef = useRef<number>(0)
    const resizeStartWidthRef = useRef<number>(0)

    const vimeoTableTotalWidth = Object.values(vimeoTableColWidths).reduce((a, b) => a + b, 0)

    const handleVimeoResizeStart = useCallback((colKey: keyof typeof vimeoTableColWidths, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setResizingCol(colKey)
        resizeStartXRef.current = e.clientX
        resizeStartWidthRef.current = vimeoTableColWidths[colKey]
    }, [vimeoTableColWidths])

    useEffect(() => {
        if (!resizingCol) return
        const handleMove = (e: MouseEvent) => {
            const delta = e.clientX - resizeStartXRef.current
            const newWidth = Math.max(40, resizeStartWidthRef.current + delta)
            setVimeoTableColWidths(prev => ({ ...prev, [resizingCol]: newWidth }))
            resizeStartXRef.current = e.clientX
            resizeStartWidthRef.current = newWidth
        }
        const handleUp = () => setResizingCol(null)
        document.addEventListener('mousemove', handleMove)
        document.addEventListener('mouseup', handleUp)
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        return () => {
            document.removeEventListener('mousemove', handleMove)
            document.removeEventListener('mouseup', handleUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [resizingCol])

    // 컴포넌트 마운트 시 토큰 로드
    useEffect(() => {
        if (ENV_VIMEO_TOKEN) {
            setAccessToken(ENV_VIMEO_TOKEN)
            setTempToken(ENV_VIMEO_TOKEN)
            setIsEnvToken(true)
        } else {
            const savedToken = localStorage.getItem(VIMEO_TOKEN_KEY)
            if (savedToken) {
                setAccessToken(savedToken)
                setTempToken(savedToken)
            }
        }

        // 최종(전체) 동기화 시각 로드
        const rawLastSync = localStorage.getItem(VIMEO_LAST_SYNC_AT_KEY)
        if (rawLastSync) {
            const parsed = Number(rawLastSync)
            if (Number.isFinite(parsed) && parsed > 0) {
                setLastSyncAtMs(parsed)
            }
        }
    }, [])

    // Vimeo API를 통해 동영상 목록 가져오기 (공통 로직)
    const fetchAllVideosFromVimeo = useCallback(async (query?: string) => {
        if (!accessToken) {
            throw new Error('Vimeo Access Token이 설정되지 않았습니다.')
        }

        console.log(`🚀 비디오 로드 시작... (검색어: ${query || '없음'})`)
        let allVideos: VimeoVideo[] = []
        let page = 1
        let hasNextPage = true

        while (hasNextPage) {
            const params = new URLSearchParams({
                page: String(page),
                per_page: '100',
                sort: 'alphabetical',
                direction: 'asc',
            })

            if (query) {
                params.append('query', query)
            }

            const response = await fetch(`https://api.vimeo.com/me/videos?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                },
            })

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('인증 실패: Access Token이 유효하지 않거나 만료되었습니다.')
                }
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data: VimeoApiResponse = await response.json()

            console.log(`📦 페이지 ${page} 로드: ${data.data.length}개 (전체: ${data.total}개)`)

            allVideos = [...allVideos, ...data.data]
            hasNextPage = !!data.paging.next
            page++

            // if (page === 2) { // 첫 페이지에서만 전체 개수 업데이트
            //     // setTotalCount(data.total) -> Removed
            // }
        }

        // 상위폴더 → 영상제목 순으로 정렬
        allVideos.sort((a, b) => {
            const folderA = a.parent_folder?.name || ''
            const folderB = b.parent_folder?.name || ''
            if (folderA !== folderB) {
                return folderA.localeCompare(folderB)
            }
            return a.name.localeCompare(b.name)
        })

        // 모든 비디오에 ID와 순번 추가
        return allVideos.map((video, index) => ({
            ...video,
            id: video.uri.split('/').pop() || video.uri,
            no: index + 1
        }))
    }, [accessToken])

    // DB에서 목록 가져오기
    const loadVideosFromDb = useCallback(async (): Promise<VimeoVideo[] | null> => {
        setLoading(true)
        try {
            // 모든 데이터를 가져오기 위해 limit을 크게 설정 (클라이언트 사이드 필터링 유지)
            const response = await apiClient.get('/vimeo/videos', {
                params: { page: 1, limit: 1000 }
            })
            const dbVideos = response.data.data.videos

            // DB 형식을 UI 인터페이스 형식으로 변환
            const mappedVideos: VimeoVideo[] = dbVideos.map((v: any, index: number) => ({
                id: v.video_id,
                uri: `/videos/${v.video_id}`,
                name: v.title,
                description: v.description,
                duration: v.duration,
                status: v.status,
                pictures: {
                    sizes: [{ width: 100, height: 100, link: v.thumbnail_url }]
                },
                privacy: {
                    view: v.privacy_view,
                    embed: 'public'
                },
                parent_folder: {
                    name: v.parent_folder,
                    uri: ''
                },
                player_embed_url: `https://player.vimeo.com/video/${v.video_id}`,
                created_at: v.created_at,
                updated_at: v.updated_at,
                no: index + 1,
                is_active: v.is_active == 1 || v.is_active === true,
                workout_category_id: v.workout_category_id ?? null
            }))

            mappedVideos.sort((a, b) => {
                const folderA = a.parent_folder?.name || ''
                const folderB = b.parent_folder?.name || ''
                if (folderA !== folderB) {
                    return folderA.localeCompare(folderB)
                }
                return a.name.localeCompare(b.name)
            })

            setVideos(mappedVideos)
            return mappedVideos
        } catch (err) {
            console.error('DB 로드 오류:', err)
            showNotification('DB 데이터를 불러오는데 실패했습니다.', 'error')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    // UI용 비디오 목록 가져오기 (Vimeo API 직접 호출 - 동기화 버튼 클릭 시 혹은 명시적 새로고침 시만 사용)
    const fetchVideos = useCallback(async () => {
        if (fetchingRef.current) {
            console.log('⚠️ 이미 fetch 중입니다. 스킵합니다.')
            return
        }

        fetchingRef.current = true
        setLoading(true)

        try {
            // 검색어 없이 전체 로드 (클라이언트 사이드 필터링을 위해)
            const videosWithId = await fetchAllVideosFromVimeo()
            console.log(`✅ 로드 완료: ${videosWithId.length}개`)
            setVideos(videosWithId)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
            showNotification(errorMessage, 'error')
            console.error('Vimeo API 오류:', err)
        } finally {
            setLoading(false)
            fetchingRef.current = false
        }
    }, [fetchAllVideosFromVimeo])

    // 검색 필터링 (모든 필드 기준)
    const filteredVideos = React.useMemo(
        () => filterVimeoVideosByKeyword(videos, searchKeyword),
        [videos, searchKeyword]
    )

    /** DB 목록(vimeo_videos) 기준 동기화 가능한 상위폴더 목록 */
    const { syncParentFolderOptions, syncFolderSelectLabels } = React.useMemo(() => {
        const set = new Set<string>()
        for (const v of videos) {
            const n = v.parent_folder?.name?.trim()
            if (n && isEligibleVimeoSyncParentFolderName(n)) set.add(n)
        }
        const options = Array.from(set).sort((a, b) => a.localeCompare(b))
        const labels: Record<string, string> = { [SYNC_FOLDER_ALL]: '전체' }
        for (const f of options) labels[f] = f
        return { syncParentFolderOptions: options, syncFolderSelectLabels: labels }
    }, [videos])

    useEffect(() => {
        if (syncFolderScope && !syncParentFolderOptions.includes(syncFolderScope)) {
            setSyncFolderScope('')
        }
    }, [syncParentFolderOptions, syncFolderScope])

    // Infinite Scroll Observer 설정
    useEffect(() => {
        if (loading) return

        if (observerRef.current) observerRef.current.disconnect()

        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setDisplayCount(prev => prev + 20)
            }
        })

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current)
        }

        return () => {
            if (observerRef.current) observerRef.current.disconnect()
        }
    }, [loading, filteredVideos, displayCount])

    // 검색어 변경 시 displayCount 리셋
    useEffect(() => {
        setDisplayCount(20)
    }, [searchKeyword])

    // videos state 변화 모니터링
    useEffect(() => {
        console.log(`🎬 videos state 업데이트: ${videos.length}개`)
            // 디버깅용: 콘솔에서 window.debugVideos로 확인 가능
            ; (window as any).debugVideos = videos
    }, [videos])

    // 초기 로드 및 검색 시 리셋
    useEffect(() => {
        loadVideosFromDb()
    }, [loadVideosFromDb])

    // 토큰 저장
    const handleSaveToken = () => {
        if (tempToken.trim()) {
            localStorage.setItem(VIMEO_TOKEN_KEY, tempToken.trim())
            setAccessToken(tempToken.trim())
            setShowSettings(false)
            showNotification('Vimeo 토큰이 저장되었습니다.', 'success')
        }
    }

    // 영상 시간 포맷팅
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`
    }

    // 날짜 포맷팅
    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    // 클립보드 복사
    const handleCopyUrl = async (url: string, type: string) => {
        try {
            await navigator.clipboard.writeText(url)
            setCopySuccess(type)
            setTimeout(() => setCopySuccess(null), 2000)
        } catch (err) {
            console.error('클립보드 복사 실패:', err)
        }
    }

    // 선택된 영상 변경 시 description 동기화
    useEffect(() => {
        setEditableDescription(selectedVideo?.description ?? '')
    }, [selectedVideo?.id, selectedVideo?.description])

    // Vimeo API에 description 반영 (PATCH) + DB 동기화
    const handleUpdateDescriptionToVimeo = async () => {
        if (!selectedVideo || !accessToken) return
        const videoId = extractVideoId(selectedVideo.uri)
        setUpdateDescToVimeoLoading(true)
        try {
            const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                },
                body: JSON.stringify({ description: editableDescription || '' }),
            })
            if (!response.ok) {
                const err = await response.json().catch(() => ({}))
                throw new Error(err.error ?? `Vimeo API 오류: ${response.status}`)
            }

            await apiClient.patch(`/vimeo/videos/${videoId}/description`, { description: editableDescription || '' })

            setSelectedVideo(prev => prev ? { ...prev, description: editableDescription } : null)
            setVideos(prev => prev.map(v => v.id === videoId ? { ...v, description: editableDescription } : v))
            showNotification('Vimeo 및 DB에 설명이 반영되었습니다.', 'success')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Vimeo 업데이트 실패'
            showNotification(msg, 'error')
            console.error('Vimeo description 업데이트 오류:', err)
        } finally {
            setUpdateDescToVimeoLoading(false)
        }
    }

    /** window.confirm 직후에는 파일 선택창 click()이 보안상 막히는 경우가 있어 Dialog로 처리 */
    const handleExcelImportOpenConfirm = () => {
        setShowExcelImportConfirm(true)
    }

    const handleExcelImportConfirmYes = () => {
        excelImportInputRef.current?.click()
        setShowExcelImportConfirm(false)
    }

    const handleExcelFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (!accessToken) {
            showNotification('Vimeo Access Token이 설정되지 않았습니다.', 'error')
            return
        }
        if (videos.length === 0) {
            showNotification('목록에 영상이 없습니다. 먼저 DB 동기화로 목록을 불러오세요.', 'error')
            return
        }
        setExcelImportLoading(true)
        let success = 0
        let failed = 0
        const failSamples: string[] = []
        const pushFail = (reason: string) => {
            failed++
            if (failSamples.length < 6) failSamples.push(reason)
        }
        try {
            const parsed = await parseVimeoExcelSheetFromB2(file)
            if (parsed.rows.length === 0) {
                showNotification('엑셀에 반영할 데이터가 없습니다. (2행부터 B=제목, C=설명)', 'info')
                return
            }
            console.info('[Vimeo Excel 업로드] 시작', {
                시트: parsed.sheetName,
                행수: parsed.rows.length,
                목록영상수: videos.length,
            })
            for (const row of parsed.rows) {
                const titleKey = row.vimeoTitle.trim()
                if (!titleKey) {
                    pushFail('B열 제목이 비어 있는 행')
                    continue
                }
                const dup = countVideosWithTrimmedTitle(titleKey, videos)
                if (dup > 1) {
                    pushFail(`제목 "${titleKey}"이(가) 목록에 ${dup}건 중복 — 한 제목당 영상 1개만 두거나 구분 필요`)
                    continue
                }
                const videoId = findVideoIdByVimeoTitle(row.vimeoTitle, videos)
                if (!videoId) {
                    pushFail(`목록에 없는 제목: "${titleKey}"`)
                    continue
                }
                try {
                    const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.vimeo.*+json;version=3.4',
                        },
                        body: JSON.stringify({ description: row.description ?? '' }),
                    })
                    if (!response.ok) {
                        const errJson = await response.json().catch(() => ({} as { error?: string }))
                        const hint =
                            typeof errJson.error === 'string'
                                ? errJson.error
                                : `HTTP ${response.status}`
                        if (response.status === 404) {
                            pushFail(
                                `Vimeo 404 (ID ${videoId}): 계정에 없거나 삭제된 영상입니다. 토큰 계정·동기화·제목 중복을 확인하세요 — ${hint}`
                            )
                        } else {
                            pushFail(`Vimeo API (${titleKey}): ${hint}`)
                        }
                        continue
                    }
                    await apiClient.patch(`/vimeo/videos/${videoId}/description`, {
                        description: row.description ?? '',
                    })
                    success++
                    console.info('[Vimeo Excel 업로드] 행 반영', { videoId, title: titleKey })
                    setVideos(prev =>
                        prev.map(v =>
                            v.id === videoId || extractVideoId(v.uri) === videoId
                                ? { ...v, description: row.description ?? '' }
                                : v
                        )
                    )
                    setSelectedVideo(prev => {
                        if (!prev) return prev
                        const sid = extractVideoId(prev.uri)
                        return sid === videoId ? { ...prev, description: row.description ?? '' } : prev
                    })
                } catch (rowErr) {
                    const msg = rowErr instanceof Error ? rowErr.message : String(rowErr)
                    pushFail(`서버/Vimeo 오류 (${titleKey}): ${msg}`)
                    console.warn('[Vimeo Excel 업로드] 행 실패', { titleKey, videoId, rowErr })
                }
            }
            const detail =
                failSamples.length > 0
                    ? ` — 실패 예: ${failSamples.slice(0, 3).join(' · ')}`
                    : ''
            console.info('[Vimeo Excel 업로드] 완료', { success, failed, failSamples })
            showNotification(
                `Excel 반영: 성공 ${success}건, 실패 ${failed}건 (시트「${parsed.sheetName}」)${detail}`,
                failed > 0 ? 'info' : 'success',
                failed > 0 ? 12000 : 5000
            )
        } catch (err) {
            showNotification(err instanceof Error ? err.message : '엑셀을 읽지 못했습니다.', 'error')
            console.error('[Vimeo Excel 업로드] 파일 읽기 오류:', err)
        } finally {
            setExcelImportLoading(false)
        }
    }

    const formatDateTime = (ms: number) => {
        const d = new Date(ms)
        const pad2 = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    }

    const persistLastSyncAt = (ms: number) => {
        try {
            localStorage.setItem(VIMEO_LAST_SYNC_AT_KEY, String(ms))
        } catch (e) {
            console.warn('last sync 저장 실패:', e)
        }
        setLastSyncAtMs(ms)
    }

    const runSyncToDb = async (
        fetchedVideos: VimeoVideo[],
        isFullSync: boolean = false
    ): Promise<{ didSync: boolean; skippedNoFolder: number }> => {
        const hasSyncEligibleFolder = (video: VimeoVideo) =>
            isEligibleVimeoSyncParentFolderName(video.parent_folder?.name)

        const skippedNoFolder = fetchedVideos.filter((v) => !hasSyncEligibleFolder(v)).length
        const toSync = fetchedVideos.filter(hasSyncEligibleFolder)

        if (toSync.length === 0) {
            showNotification(
                skippedNoFolder > 0
                    ? `동기화 대상이 아닌 영상 ${skippedNoFolder}건(폴더 미지정·내 라이브러리 루트)은 제외했습니다. 저장할 항목이 없습니다.`
                    : '동기화할 영상이 없습니다.',
                'info'
            )
            return { didSync: false, skippedNoFolder }
        }

        const videosData = toSync.map(video => {
            const thumbnailUrl = video.pictures?.sizes?.length
                ? video.pictures.sizes[video.pictures.sizes.length - 1].link
                : ''

            return {
                video_id: extractVideoId(video.uri),
                parent_folder: video.parent_folder!.name.trim(),
                title: video.name,
                description: video.description || '',
                thumbnail_url: thumbnailUrl,
                duration: video.duration,
                status: video.status,
                privacy_view: video.privacy?.view || 'anybody'
            }
        })

        const syncResponse = await apiClient.post('/vimeo/sync-batch', {
            videos: videosData,
            isFullSync: isFullSync
        })
        const syncData = syncResponse.data

        if (!syncData.success) throw new Error(syncData.message || 'DB 저장 실패')

        const skipMsg = skippedNoFolder > 0 ? ` (동기화 제외 ${skippedNoFolder}건: 미지정·루트)` : ''
        showNotification(
            `Vimeo 동기화 완료: 성공 ${syncData.data?.success ?? 0}개, 실패 ${syncData.data?.failed ?? 0}개${skipMsg}`,
            'success'
        )
        loadVideosFromDb()
        return { didSync: true, skippedNoFolder }
    }

    // 동기화: Vimeo API → vimeo_videos (전체: isFullSync true, 폴더만: false)
    const handleFullSync = async () => {
        setFullSyncLoading(true)

        try {
            console.log('🔄 1/2: Vimeo에서 비디오 목록을 가져오는 중...')
            const allVideos = await fetchAllVideosFromVimeo()

            if (!allVideos || allVideos.length === 0) {
                throw new Error('Vimeo에서 가져온 비디오가 없습니다.')
            }

            let toRun = allVideos
            if (syncFolderScope) {
                toRun = allVideos.filter((v) => (v.parent_folder?.name?.trim() ?? '') === syncFolderScope)
                if (toRun.length === 0) {
                    showNotification(
                        `Vimeo API 목록에 상위폴더가 「${syncFolderScope}」인 영상이 없습니다.`,
                        'info'
                    )
                    return
                }
                console.log(
                    `📁 폴더 「${syncFolderScope}」만 동기화 (${toRun.length}개 / 전체 ${allVideos.length}개)`
                )
            }

            const isFullSyncMode = !syncFolderScope
            console.log(`💾 2/2: DB 저장 중... (${toRun.length}개, 전체 범위 모드: ${isFullSyncMode})`)
            const fullSyncResult = await runSyncToDb(toRun, isFullSyncMode)
            if (fullSyncResult.didSync) {
                persistLastSyncAt(Date.now())
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.'
            showNotification(errorMessage, 'error')
            console.error('동기화 오류:', err)
        } finally {
            setFullSyncLoading(false)
        }
    }

    // 화면 표시용 비디오 (Infinite Scroll)
    const currentVideos = filteredVideos.slice(0, displayCount)
    const totalCount = filteredVideos.length
    const isActiveTrue = (v: VimeoVideo) => v.is_active === true
    const isActiveFalse = (v: VimeoVideo) => v.is_active === false
    const activeCount = filteredVideos.filter(isActiveTrue).length
    const inactiveCount = filteredVideos.filter(isActiveFalse).length
    const markedDeleteCount = videos.filter(isActiveFalse).length

    const handleConfirmPurgeInactive = async () => {
        if (markedDeleteCount === 0) {
            setShowPurgeInactiveDialog(false)
            return
        }
        setPurgeInactiveLoading(true)
        try {
            const res = await apiClient.post('/vimeo/videos/purge-inactive')
            if (res.data?.success) {
                showNotification(res.data.message ?? '삭제 처리되었습니다.', 'success')
                setSelectedVideo(null)
                await loadVideosFromDb()
            } else {
                showNotification(res.data?.message ?? '삭제에 실패했습니다.', 'error')
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : '삭제 요청 실패'
            showNotification(msg, 'error')
        } finally {
            setPurgeInactiveLoading(false)
            setShowPurgeInactiveDialog(false)
        }
    }

    // "New" 아이콘 표시 여부 (최근 1시간 이내 생성)
    const isNewVideo = (createdAt?: string) => {
        if (!createdAt) return false
        const createdDate = new Date(createdAt)
        const now = new Date()
        const diffMs = now.getTime() - createdDate.getTime()
        return diffMs < 1000 * 60 * 60 * 24; // 24시간 이내
    }

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'available': return 'default' // success
            case 'uploading':
            case 'transcoding': return 'secondary' // warning
            case 'transcoding_error':
            case 'quota_exceeded': return 'destructive' // error
            default: return 'outline'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'available': return '사용 가능'
            case 'uploading': return '업로드 중'
            case 'transcoding': return '인코딩 중'
            case 'transcoding_error': return '인코딩 오류'
            case 'quota_exceeded': return '용량 초과'
            default: return status
        }
    }

    const getPrivacyBadgeVariant = (view: string) => {
        switch (view) {
            case 'anybody': return 'secondary' // info
            case 'disable': return 'default' // success
            case 'unlisted': return 'outline' // primary
            case 'password': return 'secondary'
            case 'nobody': return 'destructive'
            default: return 'outline'
        }
    }

    const getPrivacyLabel = (view: string) => {
        switch (view) {
            case 'anybody': return '공개'
            case 'disable': return 'Vimeo 숨김'
            case 'unlisted': return '링크 일부 공개'
            case 'password': return '비밀번호 보호'
            case 'nobody': return '나만 보기'
            default: return view || '비공개'
        }
    }

    const handleDownloadExcel = async () => {
        if (videos.length === 0) {
            showNotification('내보낼 동기화 데이터가 없습니다.', 'info')
            return
        }
        const purgedCountAtStart = markedDeleteCount
        setExcelExportLoading(true)
        try {
            if (purgedCountAtStart > 0) {
                const res = await apiClient.post('/vimeo/videos/purge-inactive')
                if (!res.data?.success) {
                    showNotification(res.data?.message ?? '삭제 마킹 영상 제거에 실패했습니다.', 'error')
                    return
                }
                setSelectedVideo(null)
            }

            const fresh = await loadVideosFromDb()
            if (fresh === null) return

            const toExport = filterVimeoVideosByKeyword(fresh, searchKeyword)
            if (toExport.length === 0) {
                showNotification('현재 검색 조건에 맞는 내보낼 데이터가 없습니다.', 'info')
                return
            }

            downloadVimeoVideosAsXlsx(
                toExport,
                {
                    extractVideoId,
                    formatDuration,
                    getStatusLabel,
                    getPrivacyLabel,
                    isActiveFalse,
                    isNewVideo,
                }
            )
            const tail = purgedCountAtStart > 0
                ? ` (삭제 마킹 ${purgedCountAtStart}건 제거 후 ${toExport.length}건)`
                : ` (${toExport.length}건)`
            showNotification(`Excel 저장 완료${tail}`, 'success')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Excel 저장 실패'
            showNotification(msg, 'error')
        } finally {
            setExcelExportLoading(false)
        }
    }

    return (
        <div className="relative p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col gap-[3px] bg-background">
            {/* 스낵바(우측 상단) */}
            {notification && (
                <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="w-auto shadow-lg">
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : notification.type === 'error' ? (
                            <AlertCircle className="h-4 w-4" />
                        ) : (
                            <Info className="h-4 w-4" />
                        )}
                        <AlertTitle>
                            {notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}
                        </AlertTitle>
                        <AlertDescription>{notification.message}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* 상단: 제목 및 설정 */}
            <Card className="shadow-md">
                <CardContent className="py-2 px-4 flex justify-between items-center bg-muted/30 border-b border-[#343637] dark:border-[#6b7280]">
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Vimeo 동영상 관리</h2>
                        {totalCount > 0 && (
                            activeCount + inactiveCount > 0 ? (
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="h-5 text-[10px]">활성 {activeCount}개</Badge>
                                    <Badge variant="outline" className="h-5 text-[10px]">비활성 {inactiveCount}개</Badge>
                                </div>
                            ) : (
                                <Badge variant="outline" className="h-5 text-[10px]">총 {totalCount}개</Badge>
                            )
                        )}
                    </div>
                    {!isEnvToken && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setShowSettings(true)}
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            설정
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* 검색 및 필터 */}
            <Card className="shadow-md">
                <CardContent className="py-3 px-4 flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[150px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="제목, ID, 설명, 상태 등으로 검색..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="pl-9 pr-9 h-9"
                        />
                        {searchKeyword && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-7 w-7"
                                onClick={() => setSearchKeyword('')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Select
                        value={syncFolderScope === '' ? SYNC_FOLDER_ALL : syncFolderScope}
                        onValueChange={(v) => setSyncFolderScope(v === SYNC_FOLDER_ALL ? '' : v)}
                        disabled={fullSyncLoading || !accessToken}
                        labels={syncFolderSelectLabels}
                    >
                        <SelectTrigger
                            className="h-9 w-[min(220px,100%)] shrink-0"
                            aria-label="동기화 범위: 전체 또는 상위폴더"
                        >
                            <SelectValue placeholder="범위 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={SYNC_FOLDER_ALL}>전체</SelectItem>
                            {syncParentFolderOptions.map((folder) => (
                                <SelectItem key={folder} value={folder}>
                                    {folder}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-9"
                        onClick={handleFullSync}
                        disabled={fullSyncLoading || !accessToken}
                        title={
                            syncFolderScope
                                ? `상위폴더 「${syncFolderScope}」에 속한 영상만 Vimeo에서 가져와 DB에 반영합니다.`
                                : 'Vimeo의 모든(접근 가능한) 영상을 가져와 DB와 일치시킵니다.'
                        }
                    >
                        {fullSyncLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        {fullSyncLoading ? '동기화 중...' : syncFolderScope ? '선택 폴더 동기화' : '동기화'}
                    </Button>
                    <input
                        ref={excelImportInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        aria-hidden
                        onChange={handleExcelFileChange}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={handleDownloadExcel}
                        disabled={excelExportLoading || loading || videos.length === 0}
                        title="현재 화면 목록을 Excel 파일로 내보냅니다."
                        aria-label="Excel 다운로드: 동기화된 목록을 스프레드시트 파일로 저장합니다. 삭제 마킹 행이 있으면 내보내기 전에 제거할 수 있습니다."
                    >
                        {excelExportLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                        )}
                        {excelExportLoading ? '저장 중...' : 'Excel 다운'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={handleExcelImportOpenConfirm}
                        disabled={excelImportLoading || !accessToken}
                        title="엑셀 2행부터 B열 제목·C열 설명으로 Vimeo와 DB에 반영합니다."
                        aria-label="엑셀 선택: 2행부터 B열 제목으로 영상을 찾고 C열 설명을 Vimeo·DB에 반영"
                    >
                        {excelImportLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                        {excelImportLoading ? '읽는 중...' : 'Excel 업로드'}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-9 bg-red-600 text-white hover:bg-red-700 shadow-sm dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                        onClick={() => setShowPurgeInactiveDialog(true)}
                        disabled={loading || markedDeleteCount === 0}
                        aria-label={`삭제 마킹 영상 ${markedDeleteCount}건 일괄 삭제`}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        삭제 ({markedDeleteCount})
                    </Button>
                    {lastSyncAtMs && (
                        <Badge variant="outline" className="h-9 px-3 font-normal text-xs">
                            최종: {formatDateTime(lastSyncAtMs)}
                        </Badge>
                    )}
                </CardContent>
            </Card>

            {/* 영상 목록 */}
            <Card className="flex-1 min-h-0 flex flex-col shadow-md">
                <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                    {!accessToken ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                            <Video className="h-16 w-16 text-muted-foreground" />
                            <h3 className="text-lg font-medium text-muted-foreground">Vimeo Access Token을 설정해주세요</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                설정 버튼을 클릭하여 Vimeo Personal Access Token을 입력하세요.<br />
                                토큰은 developer.vimeo.com에서 생성할 수 있습니다.
                            </p>
                            <Button onClick={() => setShowSettings(true)}>
                                <Settings className="h-4 w-4 mr-2" />
                                설정하기
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-hidden p-0 min-w-0">
                                <div className="h-full border border-[#343637] dark:border-[#6b7280] overflow-auto overflow-x-auto relative bg-[#f9fafb] dark:bg-[#1d1d1d]">
                                    <div style={{ minWidth: vimeoTableTotalWidth, width: vimeoTableTotalWidth }}>
                                    <Table className="w-full table-fixed border-separate border-spacing-0" style={{ width: vimeoTableTotalWidth }}>
                                        <TableHeader className="sticky top-0 z-10 shadow-sm">
                                            <TableRow className="hover:bg-transparent border-b-0">
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.no, minWidth: 40 }}>
                                                    No
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('no', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.badge, minWidth: 40 }}>
                                                    구분
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('badge', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.parent_folder, minWidth: 40 }}>
                                                    상위폴더
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('parent_folder', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.video_id, minWidth: 40 }}>
                                                    영상 ID
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('video_id', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.title, minWidth: 40 }}>
                                                    영상 제목
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('title', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.description, minWidth: 40 }}>
                                                    영상 설명
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('description', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.thumbnail, minWidth: 40 }}>
                                                    썸네일
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('thumbnail', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.duration, minWidth: 40 }}>
                                                    길이
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('duration', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.status, minWidth: 40 }}>
                                                    상태
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('status', e)} />
                                                </TableHead>
                                                <TableHead className="h-[65px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative select-none" style={{ width: vimeoTableColWidths.privacy, minWidth: 40 }}>
                                                    프라이버시
                                                    <div role="separator" aria-orientation="vertical" aria-label="컬럼 넓이 조절" tabIndex={0} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors" onMouseDown={(e) => handleVimeoResizeStart('privacy', e)} />
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading && videos.length === 0 ? (
                                                <TableRow className="border-b-0">
                                                    <TableCell colSpan={10} className="h-24 text-center border-b-0">
                                                        <div className="flex items-center justify-center">
                                                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                                            로딩 중...
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredVideos.length === 0 ? (
                                                <TableRow className="border-b-0">
                                                    <TableCell colSpan={10} className="h-24 text-center border-b-0 text-muted-foreground">
                                                        검색 결과가 없습니다.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentVideos.map((video) => (
                                                    <TableRow
                                                        key={video.id}
                                                        className={cn(
                                                            "cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                                                            "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30"
                                                        )}
                                                        onClick={() => setSelectedVideo(video)}
                                                    >
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            {video.no}
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                                                {isActiveFalse(video) ? (
                                                                    <Badge variant="destructive" className="text-[9px] h-[18px] min-h-[18px] px-1.5 leading-none bg-red-600 text-white border-transparent hover:bg-red-600">삭제</Badge>
                                                                ) : isNewVideo(video.created_at) ? (
                                                                    <Badge className="bg-red-500 hover:bg-red-600 text-[8px] h-3 px-1 leading-none">NEW</Badge>
                                                                ) : null}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{video.parent_folder?.name || '-'}</TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <div className="flex justify-center">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-5 text-[10px] px-1 cursor-pointer hover:bg-muted pointer-events-auto"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        const vid = extractVideoId(video.uri)
                                                                        handleCopyUrl(vid, vid)
                                                                    }}
                                                                >
                                                                    {extractVideoId(video.uri)}
                                                                    {copySuccess === extractVideoId(video.uri) && <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />}
                                                                </Badge>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <div className="truncate font-medium" title={video.name}>{video.name}</div>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <div className="truncate text-muted-foreground" title={video.description || ''}>
                                                                {video.description || '-'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <div className="flex justify-center">
                                                                <div className="w-16 h-8 bg-muted rounded overflow-hidden relative group/thumb">
                                                                    {video.pictures?.sizes?.[0]?.link ? (
                                                                        <img
                                                                            src={video.pictures.sizes[0].link}
                                                                            alt="thumbnail"
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center h-full">
                                                                            <Video className="h-4 w-4 text-muted-foreground" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">{formatDuration(video.duration)}</TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <Badge variant={getStatusBadgeVariant(video.status)} className="h-5 text-[10px] px-1 pointer-events-none">
                                                                {getStatusLabel(video.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit group-hover:font-inherit transition-colors">
                                                            <Badge variant={getPrivacyBadgeVariant(video.privacy?.view)} className="h-5 text-[10px] px-1 pointer-events-none">
                                                                {getPrivacyLabel(video.privacy?.view)}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                            {/* Infinite Scroll Sentinel */}
                                            {!loading && displayCount < filteredVideos.length && (
                                                <TableRow ref={loadMoreRef as any} className="border-b-0">
                                                    <TableCell colSpan={10} className="h-10 text-center text-muted-foreground">
                                                        <div className="flex items-center justify-center p-2">
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            더 불러오는 중...
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            </div>

                            {/* 하단 요약 정보 (페이지네이션 대신) */}
                            <div className="p-2 border-t text-xs text-muted-foreground text-center">
                                총 {filteredVideos.length}개 중 {Math.min(displayCount, filteredVideos.length)}개 표시
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 영상 미리보기 (선택된 영상이 있을 때) */}
            {selectedVideo && (
                <Card>
                    <CardContent className="p-4">
                        <div className="flex gap-4">
                            {/* 영상 플레이어 */}
                            <div className="w-[400px] shrink-0">
                                <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden">
                                    <iframe
                                        src={selectedVideo.player_embed_url}
                                        title={selectedVideo.name}
                                        className="absolute top-0 left-0 w-full h-full"
                                        frameBorder="0"
                                        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; storage-access-by-user-activation"
                                        allowFullScreen
                                    />
                                </div>
                            </div>

                            {/* 영상 정보 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-semibold truncate pr-4">{selectedVideo.name}</h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 -mt-1 -mr-1"
                                        onClick={() => setSelectedVideo(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                    <p><span className="font-medium text-foreground">영상 ID:</span> {extractVideoId(selectedVideo.uri)}</p>
                                    <p><span className="font-medium text-foreground">재생시간:</span> {formatDuration(selectedVideo.duration || 0)}</p>
                                    <p><span className="font-medium text-foreground">해상도:</span> {selectedVideo.width || 0} x {selectedVideo.height || 0}</p>
                                    <p><span className="font-medium text-foreground">업로드일:</span> {selectedVideo.created_time ? formatDate(selectedVideo.created_time) : '-'}</p>
                                    <div className="mt-2">
                                        <label className="text-sm font-medium text-foreground">설명 (Vimeo에 반영 가능)</label>
                                        <Textarea
                                            value={editableDescription}
                                            onChange={(e) => setEditableDescription(e.target.value)}
                                            placeholder="영상 설명을 입력하세요"
                                            className="mt-1 min-h-[80px] resize-y"
                                            aria-label="영상 설명"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopyUrl(`https://vimeo.com/${extractVideoId(selectedVideo.uri)}`, 'preview')}
                                    >
                                        <Copy className="h-3 w-3 mr-2" />
                                        {copySuccess === 'preview' ? '복사됨!' : 'URL 복사'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(selectedVideo.link, '_blank')}
                                    >
                                        <Play className="h-3 w-3 mr-2" />
                                        Vimeo에서 보기
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                        onClick={handleUpdateDescriptionToVimeo}
                                        disabled={updateDescToVimeoLoading || !accessToken}
                                        aria-label="편집한 설명을 Vimeo와 DB에 반영"
                                    >
                                        {updateDescToVimeoLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Upload className="h-3 w-3 mr-2" />}
                                        선택업로드
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={showExcelImportConfirm} onOpenChange={setShowExcelImportConfirm}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Excel 업로드</DialogTitle>
                        <DialogDescription>
                            동기화를 진행하였습니까? 동기화 후 작업해야 합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowExcelImportConfirm(false)}
                        >
                            아니오
                        </Button>
                        <Button type="button" variant="default" onClick={handleExcelImportConfirmYes}>
                            예
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showPurgeInactiveDialog} onOpenChange={setShowPurgeInactiveDialog}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>삭제 마킹 영상 일괄 삭제</DialogTitle>
                        <DialogDescription>
                            UI에서 &apos;삭제&apos; 배지가 붙은 영상(Vimeo에서 제외되어 비활성 처리된 항목) {markedDeleteCount}건을 DB에서 영구 삭제합니다.
                            해당 영상 ID를 쓰던 운동(exercises)은 비활성화되고 video_url이 해제됩니다. 이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowPurgeInactiveDialog(false)}
                            disabled={purgeInactiveLoading}
                        >
                            취소
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
                            onClick={handleConfirmPurgeInactive}
                            disabled={purgeInactiveLoading || markedDeleteCount === 0}
                            aria-busy={purgeInactiveLoading}
                        >
                            {purgeInactiveLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    처리 중...
                                </>
                            ) : (
                                '삭제 실행'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 설정 다이얼로그 */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Vimeo API 설정
                        </DialogTitle>
                        <DialogDescription>
                            Vimeo 동영상 목록을 가져오려면 Personal Access Token이 필요합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="text-sm text-muted-foreground">
                            <a
                                href="https://developer.vimeo.com/apps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                developer.vimeo.com
                            </a>
                            에서 앱을 생성하고 토큰을 발급받으세요.
                        </div>
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>토큰 권한 안내</AlertTitle>
                            <AlertDescription>
                                토큰 생성 시 <strong>'Authenticated (you)'</strong>를 선택하고,
                                <strong>'Private'</strong> 및 <strong>'Video Files'</strong> 스코프를 포함해야 합니다.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Vimeo Access Token</label>
                            <Input
                                value={tempToken}
                                onChange={(e) => setTempToken(e.target.value)}
                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                type="password"
                            />
                            <p className="text-xs text-muted-foreground">Personal Access Token을 입력하세요</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSettings(false)}>취소</Button>
                        <Button onClick={handleSaveToken} disabled={!tempToken.trim()}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default Vimeo
