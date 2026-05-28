import { executeQuery } from '../lib/database.js'

export type BranchLicenseStatus = 'active' | 'revoked' | 'expired'

export const LICENSE_TERM_OPTIONS = [1, 2, 3, 5] as const
export type LicenseTermYears = typeof LICENSE_TERM_OPTIONS[number]

export interface BranchLicenseInput {
  branchId: string | number
  workoutCategoryId: string
  validFrom: string
  validTo?: string | null
  grantedBy: string
  notes?: string | null
}

export interface BranchLicenseUpdateInput {
  validFrom?: string | null
  validTo?: string | null
  status?: BranchLicenseStatus
  notes?: string | null
}

const LICENSE_SELECT_SQL = `
  SELECT
    bl.*,
    b.name AS branch_name,
    wc.major_category,
    wc.major_category_name
  FROM branch_licenses bl
  LEFT JOIN branches b ON b.id = bl.branch_id
  LEFT JOIN workout_categories wc ON wc.id = bl.workout_category_id
`

export class LicenseService {
  static async list(branchId?: string | number) {
    const params: any[] = []
    const where = branchId ? 'WHERE bl.branch_id = ?' : ''
    if (branchId) params.push(branchId)

    return executeQuery(`
      ${LICENSE_SELECT_SQL}
      ${where}
      ORDER BY bl.created_at DESC
    `, params)
  }

  static async findById(id: string) {
    const rows = await executeQuery(`
      ${LICENSE_SELECT_SQL}
      WHERE bl.id = ?
      LIMIT 1
    `, [id])
    return rows[0] ?? null
  }

  static async grant(input: BranchLicenseInput) {
    await executeQuery(`
      INSERT INTO branch_licenses (
        branch_id, workout_category_id, valid_from, valid_to, granted_by, status, notes
      ) VALUES (?, ?, ?, ?, ?, 'active', ?)
    `, [
      input.branchId,
      input.workoutCategoryId,
      input.validFrom,
      input.validTo || null,
      input.grantedBy,
      input.notes || null
    ])

    const rows = await this.list(input.branchId)
    return rows[0]
  }

  static async update(id: string, data: BranchLicenseUpdateInput) {
    const setClauses: string[] = []
    const params: any[] = []

    if (data.validFrom !== undefined) {
      setClauses.push('valid_from = ?')
      params.push(data.validFrom)
    }
    if (data.validTo !== undefined) {
      setClauses.push('valid_to = ?')
      params.push(data.validTo)
    }
    if (data.status !== undefined) {
      setClauses.push('status = ?')
      params.push(data.status)
    }
    if (data.notes !== undefined) {
      setClauses.push('notes = ?')
      params.push(data.notes)
    }

    if (setClauses.length === 0) {
      return this.findById(id)
    }

    params.push(id)
    await executeQuery(`
      UPDATE branch_licenses
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `, params)

    return this.findById(id)
  }

  /**
   * 라이선스 일괄 갱신
   * - 대상: 전달된 licenseIds (호출자가 미리 필터링)
   * - 모드 1) termYears: 각 행의 갱신 시작일 = max(valid_to + 1일, 오늘), 새 valid_to = 갱신 시작일 + termYears - 1일
   * - 모드 2) validTo: 모든 대상 행의 valid_to를 지정 종료일로 통일
   * - 모든 대상 status는 'active'로 복구
   */
  static async bulkRenew(input: {
    licenseIds: string[]
    termYears?: LicenseTermYears
    validTo?: string
  }) {
    const ids = (input.licenseIds || []).filter((id) => typeof id === 'string' && id.length > 0)
    if (ids.length === 0) {
      throw new Error('갱신할 라이선스를 선택해주세요')
    }

    const hasTerm = input.termYears !== undefined
    const hasDate = input.validTo !== undefined
    if (hasTerm === hasDate) {
      throw new Error('termYears 또는 validTo 중 하나만 지정해야 합니다')
    }

    const placeholders = ids.map(() => '?').join(', ')
    const branchIdSet = new Set<string>()

    if (hasTerm) {
      if (!LICENSE_TERM_OPTIONS.includes(input.termYears as LicenseTermYears)) {
        throw new Error('termYears는 1, 2, 3, 5 중 하나여야 합니다')
      }

      const result = await executeQuery(`
        UPDATE branch_licenses
        SET
          valid_to = DATE_SUB(
            DATE_ADD(
              GREATEST(
                IFNULL(DATE_ADD(valid_to, INTERVAL 1 DAY), CURDATE()),
                CURDATE()
              ),
              INTERVAL ${input.termYears} YEAR
            ),
            INTERVAL 1 DAY
          ),
          status = 'active'
        WHERE id IN (${placeholders})
      `, ids)

      const affectedRows = Number((result as any)?.affectedRows ?? 0)
      const rows = await executeQuery(`SELECT DISTINCT branch_id FROM branch_licenses WHERE id IN (${placeholders})`, ids)
      for (const row of rows as Array<{ branch_id: string | number }>) branchIdSet.add(String(row.branch_id))
      const licenses = await this.listByBranches(Array.from(branchIdSet))
      return { affectedRows, licenses }
    }

    const result = await executeQuery(`
      UPDATE branch_licenses
      SET valid_to = ?, status = 'active'
      WHERE id IN (${placeholders})
    `, [input.validTo, ...ids])

    const affectedRows = Number((result as any)?.affectedRows ?? 0)
    const rows = await executeQuery(`SELECT DISTINCT branch_id FROM branch_licenses WHERE id IN (${placeholders})`, ids)
    for (const row of rows as Array<{ branch_id: string | number }>) branchIdSet.add(String(row.branch_id))
    const licenses = await this.listByBranches(Array.from(branchIdSet))
    return { affectedRows, licenses }
  }

  static async listByBranches(branchIds: string[]) {
    if (branchIds.length === 0) return []
    const placeholders = branchIds.map(() => '?').join(', ')
    return executeQuery(`
      ${LICENSE_SELECT_SQL}
      WHERE bl.branch_id IN (${placeholders})
      ORDER BY bl.created_at DESC
    `, branchIds)
  }

  static async getActiveByBranch(branchId: string | number) {
    return executeQuery(`
      SELECT
        bl.*,
        wc.major_category,
        wc.major_category_name
      FROM branch_licenses bl
      INNER JOIN workout_categories wc ON wc.id = bl.workout_category_id
      WHERE bl.branch_id = ?
        AND bl.status = 'active'
        AND bl.valid_from <= CURDATE()
        AND (bl.valid_to IS NULL OR bl.valid_to >= CURDATE())
      ORDER BY wc.sort_order ASC, wc.major_category ASC
    `, [branchId])
  }

  static async hasLicense(branchId: string | number, workoutCategoryId: string): Promise<boolean> {
    const rows = await executeQuery(`
      SELECT id
      FROM branch_licenses
      WHERE branch_id = ?
        AND workout_category_id = ?
        AND status = 'active'
        AND valid_from <= CURDATE()
        AND (valid_to IS NULL OR valid_to >= CURDATE())
      LIMIT 1
    `, [branchId, workoutCategoryId])

    return rows.length > 0
  }
}
