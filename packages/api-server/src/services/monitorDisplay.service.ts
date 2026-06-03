import { callProcedure, executeQuery, unwrapProcedureRows } from '../lib/database.js'

export type MonitorSide = 'left' | 'center' | 'right'
export type MonitorImageKind = 'default' | 'intro'
export type MonitorDisplayContext = 'default' | 'intro'

export interface MonitorImageSet {
  leftImageUrl: string
  centerImageUrl: string
  rightImageUrl: string
}

export interface MonitorDisplayProfile {
  defaultImages: MonitorImageSet
  introImages: MonitorImageSet
  displayText: string
}

export interface ResolvedMonitorDisplay extends MonitorImageSet {
  displayText: string
}

export interface ExerciseMonitorConfigRow {
  exerciseId: string
  imageKind?: MonitorImageKind | null
  side?: MonitorSide | null
  imageUrl?: string | null
  displayText?: string | null
}

export interface ExerciseMonitorConfigPayload {
  exerciseId: string
  defaultImages?: Partial<MonitorImageSet>
  introImages?: Partial<MonitorImageSet>
  displayText?: string
}

type ImageRow = { image_kind?: string; side: string; image_url: string }

const emptyImageSet = (): MonitorImageSet => ({
  leftImageUrl: '',
  centerImageUrl: '',
  rightImageUrl: ''
})

const stripApiSuffix = (url: string): string => url.replace(/\/api\/?$/, '').replace(/\/$/, '')

const MONITOR_UPLOAD_PUBLIC_ORIGIN = stripApiSuffix(
  process.env.PUBLIC_UPLOAD_BASE_URL ||
  process.env.API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://linkhiit.co.kr' : 'http://127.0.0.1:3001')
)

/** Electron 등 외부 클라이언트가 /uploads 경로를 일관되게 로드하도록 */
const normalizePublicUploadUrl = (url: string): string => {
  if (!url?.trim()) return ''
  const trimmed = url.trim()
  try {
    const u = new URL(trimmed)
    if (u.pathname.startsWith('/uploads')) {
      return `${MONITOR_UPLOAD_PUBLIC_ORIGIN}${u.pathname}${u.search}`
    }
  } catch {
    if (trimmed.startsWith('/uploads')) {
      return `${MONITOR_UPLOAD_PUBLIC_ORIGIN}${trimmed}`
    }
  }
  return trimmed
}

function firstProcedureResultRows(procedureResult: unknown): unknown[] {
  return unwrapProcedureRows(procedureResult)
}

const readRowField = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const val = row[key]
    if (val != null && String(val).trim()) return String(val).trim()
  }
  return ''
}

const normalizeImageRows = (rows: unknown[]): ImageRow[] =>
  rows
    .filter(
      (row): row is Record<string, unknown> =>
        row != null && typeof row === 'object' && !Array.isArray(row)
    )
    .map((row) => ({
      image_kind: readRowField(row, 'image_kind', 'imageKind') || 'default',
      side: readRowField(row, 'side', 'Side').toLowerCase(),
      image_url: readRowField(row, 'image_url', 'imageUrl')
    }))
    .filter(
      (row) => row.side && ['left', 'center', 'right'].includes(row.side) && row.image_url
    )

const normalizeImageSetUrls = (set: MonitorImageSet): MonitorImageSet => ({
  leftImageUrl: normalizePublicUploadUrl(set.leftImageUrl),
  centerImageUrl: normalizePublicUploadUrl(set.centerImageUrl),
  rightImageUrl: normalizePublicUploadUrl(set.rightImageUrl)
})

const rowsToImageSet = (
  rows: ImageRow[],
  kind: MonitorImageKind
): MonitorImageSet => {
  const safeRows = Array.isArray(rows) ? rows : []
  const filtered = safeRows.filter(
    (r) => (r.image_kind || 'default') === kind
  )
  return {
    leftImageUrl: filtered.find((r) => r.side === 'left')?.image_url || '',
    centerImageUrl: filtered.find((r) => r.side === 'center')?.image_url || '',
    rightImageUrl: filtered.find((r) => r.side === 'right')?.image_url || ''
  }
}

const pickUrl = (
  exerciseUrl: string | undefined,
  userUrl: string | undefined,
  systemUrl: string | undefined
): string => {
  const e = (exerciseUrl || '').trim()
  if (e) return e
  const u = (userUrl || '').trim()
  if (u) return u
  return (systemUrl || '').trim()
}

const pickText = (
  exerciseText: string | undefined,
  userText: string | undefined,
  systemText: string | undefined
): string => {
  const e = (exerciseText || '').trim()
  if (e) return e
  const u = (userText || '').trim()
  if (u) return u
  return (systemText || '').trim()
}

/** SP/컬럼 미적용 DB에서도 빈 값으로 동작하도록 SQL 폴백 */
const fetchUserImageRows = async (userId: string): Promise<ImageRow[]> => {
  try {
    const imgResult = await callProcedure('sp_GetMonitorDefaultImageProfile', [userId])
    const rows = normalizeImageRows(firstProcedureResultRows(imgResult))
    if (rows.length > 0) return rows
  } catch {
    /* SP 미적용 */
  }
  try {
    return normalizeImageRows(
      (await executeQuery(
        `SELECT side, image_url,
                COALESCE(image_kind, 'default') AS image_kind
         FROM monitor_default_image_profile
         WHERE owner_user_id = ? AND is_active = TRUE`,
        [userId]
      )) as ImageRow[]
    )
  } catch {
    return []
  }
}

const fetchUserDisplayText = async (userId: string): Promise<string> => {
  try {
    const textResult = await callProcedure('sp_GetMonitorDisplayTextProfile', [userId])
    const textRows = firstProcedureResultRows(textResult) as { display_text?: string }[]
    return textRows[0]?.display_text || ''
  } catch {
    try {
      const rows = (await executeQuery(
        `SELECT display_text FROM monitor_display_text_profile
         WHERE owner_user_id = ? AND is_active = TRUE LIMIT 1`,
        [userId]
      )) as { display_text?: string }[]
      return rows[0]?.display_text || ''
    } catch {
      return ''
    }
  }
}

const fetchSystemImageRows = async (): Promise<ImageRow[]> => {
  try {
    const imgResult = await callProcedure('sp_GetSystemDefaultImages', [])
    const rows = normalizeImageRows(firstProcedureResultRows(imgResult))
    if (rows.length > 0) return rows
  } catch {
    /* SP 미적용 */
  }
  try {
    return normalizeImageRows(
      (await executeQuery(
        `SELECT side, image_url,
                COALESCE(image_kind, 'default') AS image_kind
         FROM system_default_image
         WHERE is_active = TRUE`
      )) as ImageRow[]
    )
  } catch {
    return []
  }
}

const fetchSystemDisplayText = async (): Promise<string> => {
  try {
    const textResult = await callProcedure('sp_GetSystemDisplayText', [])
    const textRows = firstProcedureResultRows(textResult) as { display_text?: string }[]
    return textRows[0]?.display_text || ''
  } catch {
    try {
      const rows = (await executeQuery(
        `SELECT display_text FROM system_display_text
         WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1`
      )) as { display_text?: string }[]
      return rows[0]?.display_text || ''
    } catch {
      return ''
    }
  }
}

const fetchWorkoutImageRows = async (masterId: string): Promise<ImageRow[]> => {
  const normalizedMasterId = masterId.trim()
  if (!normalizedMasterId) return []

  const loadFromSql = async (): Promise<ImageRow[]> => {
    try {
      return normalizeImageRows(
        (await executeQuery(
          `SELECT side, image_url,
                  COALESCE(image_kind, 'default') AS image_kind
           FROM workout_monitor_display_image
           WHERE workout_history_master_id = ? AND is_active = TRUE`,
          [normalizedMasterId]
        )) as ImageRow[]
      )
    } catch {
      return []
    }
  }

  // SP 미적용·구버전 환경 대비 — SQL 직접 조회 우선
  const sqlRows = await loadFromSql()
  if (sqlRows.length > 0) return sqlRows

  try {
    const imgResult = await callProcedure('sp_GetWorkoutMonitorDisplayImages', [normalizedMasterId])
    return normalizeImageRows(firstProcedureResultRows(imgResult))
  } catch {
    return []
  }
}

const fetchWorkoutDisplayText = async (masterId: string): Promise<string> => {
  const normalizedMasterId = masterId.trim()
  if (!normalizedMasterId) return ''

  try {
    const rows = (await executeQuery(
      `SELECT display_text FROM workout_monitor_display_text
       WHERE workout_history_master_id = ? AND is_active = TRUE LIMIT 1`,
      [normalizedMasterId]
    )) as { display_text?: string }[]
    if (rows[0]?.display_text) return rows[0].display_text
  } catch {
    /* 테이블 미적용 */
  }

  try {
    const textResult = await callProcedure('sp_GetWorkoutMonitorDisplayText', [normalizedMasterId])
    const textRows = firstProcedureResultRows(textResult) as { display_text?: string }[]
    return textRows[0]?.display_text || ''
  } catch {
    return ''
  }
}

export class MonitorDisplayService {
  async getWorkoutProfile(masterId: string): Promise<MonitorDisplayProfile> {
    const imgRows = await fetchWorkoutImageRows(masterId)
    const displayText = await fetchWorkoutDisplayText(masterId)

    return {
      defaultImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'default')),
      introImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'intro')),
      displayText
    }
  }

  async saveWorkoutProfile(masterId: string, profile: MonitorDisplayProfile): Promise<void> {
    const normalizedMasterId = masterId.trim()
    if (!normalizedMasterId) {
      throw new Error('workout_history_master_id가 필요합니다')
    }

    const upsertImage = async (kind: MonitorImageKind, side: MonitorSide, url: string) => {
      try {
        await callProcedure('sp_UpsertWorkoutMonitorDisplayImage', [normalizedMasterId, kind, side, url])
      } catch {
        await executeQuery(
          `INSERT INTO workout_monitor_display_image (
             workout_history_master_id, image_kind, side, image_url, is_active
           ) VALUES (?, ?, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE
             image_url = VALUES(image_url),
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP`,
          [normalizedMasterId, kind, side, url]
        )
      }
    }

    const deleteImage = async (kind: MonitorImageKind, side: MonitorSide) => {
      try {
        await callProcedure('sp_DeleteWorkoutMonitorDisplayImageSide', [normalizedMasterId, kind, side])
      } catch {
        try {
          await executeQuery(
            `DELETE FROM workout_monitor_display_image
             WHERE workout_history_master_id = ? AND image_kind = ? AND side = ?`,
            [normalizedMasterId, kind, side]
          )
        } catch {
          /* 테이블 미적용 */
        }
      }
    }

    const saveSet = async (kind: MonitorImageKind, set: MonitorImageSet) => {
      const sides: MonitorSide[] = ['left', 'center', 'right']
      const keys = ['leftImageUrl', 'centerImageUrl', 'rightImageUrl'] as const
      for (let i = 0; i < sides.length; i++) {
        const side = sides[i]
        const val = set[keys[i]]?.trim() || ''
        if (!val) {
          await deleteImage(kind, side)
        } else {
          await upsertImage(kind, side, val)
        }
      }
    }

    await saveSet('default', profile.defaultImages)
    await saveSet('intro', profile.introImages)

    const text = profile.displayText ?? ''
    try {
      await callProcedure('sp_UpsertWorkoutMonitorDisplayText', [normalizedMasterId, text])
    } catch {
      await executeQuery(
        `INSERT INTO workout_monitor_display_text (workout_history_master_id, display_text, is_active)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           display_text = VALUES(display_text),
           is_active = TRUE,
           updated_at = CURRENT_TIMESTAMP`,
        [normalizedMasterId, text]
      )
    }
  }

  async getUserProfile(userId: string): Promise<MonitorDisplayProfile> {
    const imgRows = await fetchUserImageRows(userId)
    const displayText = await fetchUserDisplayText(userId)

    return {
      defaultImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'default')),
      introImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'intro')),
      displayText
    }
  }

  async getSystemProfile(): Promise<MonitorDisplayProfile> {
    const imgRows = await fetchSystemImageRows()
    const displayText = await fetchSystemDisplayText()

    return {
      defaultImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'default')),
      introImages: normalizeImageSetUrls(rowsToImageSet(imgRows, 'intro')),
      displayText
    }
  }

  async getWorkoutExerciseConfigs(masterId: string): Promise<ExerciseMonitorConfigPayload[]> {
    let rows: {
      exercise_id: string
      image_kind: string | null
      side: string | null
      image_url: string | null
      display_text: string | null
    }[] = []

    try {
      const result = await callProcedure('sp_GetWorkoutExerciseMonitorConfig', [masterId])
      rows = firstProcedureResultRows(result) as typeof rows
    } catch {
      try {
        rows = (await executeQuery(
          `SELECT exercise_id, image_kind, side, image_url, display_text
           FROM workout_exercise_monitor_config
           WHERE workout_history_master_id = ?`,
          [masterId]
        )) as typeof rows
      } catch {
        rows = []
      }
    }

    const byExercise = new Map<string, ExerciseMonitorConfigPayload>()

    for (const row of rows) {
      const exerciseId = String(row.exercise_id)
      if (!byExercise.has(exerciseId)) {
        byExercise.set(exerciseId, { exerciseId })
      }
      const entry = byExercise.get(exerciseId)!

      if (row.display_text != null && row.image_kind == null) {
        entry.displayText = row.display_text
        continue
      }

      const kind = row.image_kind as MonitorImageKind
      const side = row.side as MonitorSide
      if (!kind || !side || !row.image_url) continue

      const target = kind === 'intro' ? 'introImages' : 'defaultImages'
      if (!entry[target]) {
        entry[target] = {}
      }
      const key =
        side === 'left'
          ? 'leftImageUrl'
          : side === 'center'
            ? 'centerImageUrl'
            : 'rightImageUrl'
      entry[target]![key] = row.image_url
    }

    return Array.from(byExercise.values())
  }

  flattenExerciseConfigs(configs: ExerciseMonitorConfigPayload[]): ExerciseMonitorConfigRow[] {
    const flat: ExerciseMonitorConfigRow[] = []

    for (const cfg of configs) {
      const exerciseId = cfg.exerciseId
      if (!exerciseId) continue

      for (const kind of ['default', 'intro'] as MonitorImageKind[]) {
        const set = kind === 'default' ? cfg.defaultImages : cfg.introImages
        if (!set) continue
        for (const side of ['left', 'center', 'right'] as MonitorSide[]) {
          const urlKey =
            side === 'left'
              ? 'leftImageUrl'
              : side === 'center'
                ? 'centerImageUrl'
                : 'rightImageUrl'
          const url = set[urlKey]?.trim()
          if (url) {
            flat.push({
              exerciseId,
              imageKind: kind,
              side,
              imageUrl: url
            })
          }
        }
      }

      if (cfg.displayText?.trim()) {
        flat.push({
          exerciseId,
          displayText: cfg.displayText.trim()
        })
      }
    }

    return flat
  }

  async saveWorkoutExerciseConfigs(
    masterId: string,
    configs: ExerciseMonitorConfigPayload[]
  ): Promise<void> {
    const flat = this.flattenExerciseConfigs(configs)
    await callProcedure('sp_SaveWorkoutExerciseMonitorConfig', [
      masterId,
      JSON.stringify(
        flat.map((row) => ({
          exerciseId: row.exerciseId,
          imageKind: row.imageKind ?? null,
          side: row.side ?? null,
          imageUrl: row.imageUrl ?? null,
          displayText: row.displayText ?? null
        }))
      )
    ])
  }

  async resolveDisplayConfig(params: {
    userId: string
    masterId?: string
    exerciseId?: string
    context: MonitorDisplayContext
  }): Promise<ResolvedMonitorDisplay> {
    const { userId, masterId, exerciseId, context } = params
    const imageKind: MonitorImageKind = context === 'intro' ? 'intro' : 'default'

    const [userProfile, systemProfile] = await Promise.all([
      this.getUserProfile(userId),
      this.getSystemProfile()
    ])

    const userSet =
      imageKind === 'intro' ? userProfile.introImages : userProfile.defaultImages
    const systemSet =
      imageKind === 'intro' ? systemProfile.introImages : systemProfile.defaultImages

    let workoutSet: Partial<MonitorImageSet> = {}
    let workoutText = ''

    if (masterId) {
      const workoutProfile = await this.getWorkoutProfile(masterId)
      workoutSet =
        imageKind === 'intro' ? workoutProfile.introImages : workoutProfile.defaultImages
      workoutText = workoutProfile.displayText || ''
    }

    return {
      leftImageUrl: normalizePublicUploadUrl(
        pickUrl(workoutSet.leftImageUrl, userSet.leftImageUrl, systemSet.leftImageUrl)
      ),
      centerImageUrl: normalizePublicUploadUrl(
        pickUrl(workoutSet.centerImageUrl, userSet.centerImageUrl, systemSet.centerImageUrl)
      ),
      rightImageUrl: normalizePublicUploadUrl(
        pickUrl(workoutSet.rightImageUrl, userSet.rightImageUrl, systemSet.rightImageUrl)
      ),
      displayText: pickText(workoutText, userProfile.displayText, systemProfile.displayText)
    }
  }
}

export const monitorDisplayService = new MonitorDisplayService()
