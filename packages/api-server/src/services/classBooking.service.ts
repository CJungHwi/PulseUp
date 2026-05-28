/**
 * 소스 요약 — 수업예약 비즈니스 서비스
 *
 * 기능: 지점별 수업 슬롯 조회/등록/수정/삭제, 사용자 예약/변경/취소, 지점관리자의 출석 상태 변경을 처리한다.
 *
 * 호출/연동: `classSlots.routes`, `classBookings.routes`, `LicenseService`, `class_slots`, `class_bookings`, `users`.
 *
 * 관련 컴포넌트: DB 유틸 `executeQuery/executeTransaction`, 라이선스 서비스.
 *
 * 흐름: 라우트 입력 → 지점/라이선스/정원/시간 중복 검증 → DB 저장 → 화면용 데이터 반환.
 */

import { randomUUID } from 'node:crypto'
import { executeQuery, executeTransaction } from '../lib/database.js'
import { LicenseService } from './license.service.js'
import type { AttendanceStatus } from '../schemas/classBooking.schema.js'

const ACTIVE_BOOKING_STATUSES = "('reserved','attended','noshow')"

export interface ClassSlotInput {
  branchId: string | number
  workoutCategoryId: string
  title: string
  startAt: string
  endAt: string
  capacity: number
  recurrenceRule?: string | null
  createdBy: string
}

export interface ClassSlotUpdateInput {
  branchId: string | number
  workoutCategoryId?: string
  title?: string
  startAt?: string
  endAt?: string
  capacity?: number
  recurrenceRule?: string | null
}

const assertFutureDate = (value: string | Date, message: string) => {
  if (new Date(value).getTime() <= Date.now()) {
    throw new Error(message)
  }
}

export class ClassBookingService {
  static async listSlots(params: { branchId: string | number; start?: string; end?: string }) {
    const where = ['cs.branch_id = ?', 'cs.is_active = TRUE']
    const values: any[] = [params.branchId]

    if (params.start) {
      where.push('cs.end_at >= ?')
      values.push(params.start)
    }
    if (params.end) {
      where.push('cs.start_at <= ?')
      values.push(params.end)
    }

    return executeQuery(`
      SELECT
        cs.*,
        wc.major_category,
        wc.major_category_name,
        COUNT(CASE WHEN cb.status IN ${ACTIVE_BOOKING_STATUSES} THEN 1 END) AS reserved_count,
        COUNT(CASE WHEN cb.status = 'attended' THEN 1 END) AS attended_count,
        COUNT(CASE WHEN cb.status = 'noshow' THEN 1 END) AS noshow_count
      FROM class_slots cs
      INNER JOIN workout_categories wc ON wc.id = cs.workout_category_id
      LEFT JOIN class_bookings cb ON cb.slot_id = cs.id
      WHERE ${where.join(' AND ')}
      GROUP BY cs.id, wc.major_category, wc.major_category_name
      ORDER BY cs.start_at ASC
    `, values)
  }

  static async createSlot(input: ClassSlotInput) {
    const licensed = await LicenseService.hasLicense(input.branchId, input.workoutCategoryId)
    if (!licensed) throw new Error('라이선스가 없는 운동 대분류는 수업으로 등록할 수 없습니다')
    assertFutureDate(input.startAt, '지난 시간에는 수업을 등록할 수 없습니다')

    const slotId = randomUUID()
    await executeQuery(`
      INSERT INTO class_slots (
        id, branch_id, workout_category_id, title, start_at, end_at, capacity, recurrence_rule, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      slotId,
      input.branchId,
      input.workoutCategoryId,
      input.title,
      input.startAt,
      input.endAt,
      input.capacity,
      input.recurrenceRule || null,
      input.createdBy
    ])

    const rows = await this.getSlotById(slotId, input.branchId)
    return rows[0]
  }

  static async getSlotById(slotId: string, branchId: string | number) {
    return executeQuery(`
      SELECT
        cs.*,
        wc.major_category,
        wc.major_category_name,
        COUNT(CASE WHEN cb.status IN ${ACTIVE_BOOKING_STATUSES} THEN 1 END) AS reserved_count,
        COUNT(CASE WHEN cb.status = 'attended' THEN 1 END) AS attended_count,
        COUNT(CASE WHEN cb.status = 'noshow' THEN 1 END) AS noshow_count
      FROM class_slots cs
      INNER JOIN workout_categories wc ON wc.id = cs.workout_category_id
      LEFT JOIN class_bookings cb ON cb.slot_id = cs.id
      WHERE cs.id = ? AND cs.branch_id = ? AND cs.is_active = TRUE
      GROUP BY cs.id, wc.major_category, wc.major_category_name
      LIMIT 1
    `, [slotId, branchId])
  }

  static async updateSlot(slotId: string, input: ClassSlotUpdateInput) {
    const rows = await executeQuery(
      `SELECT
         cs.id,
         cs.branch_id,
         cs.workout_category_id,
         cs.title,
         cs.start_at,
         cs.end_at,
         cs.capacity,
         cs.recurrence_rule,
         COUNT(CASE WHEN cb.status IN ${ACTIVE_BOOKING_STATUSES} THEN 1 END) AS reserved_count
       FROM class_slots cs
       LEFT JOIN class_bookings cb ON cb.slot_id = cs.id
       WHERE cs.id = ? AND cs.branch_id = ? AND cs.is_active = TRUE
       GROUP BY cs.id`,
      [slotId, input.branchId]
    )
    const slot = rows?.[0]
    if (!slot) throw new Error('수정할 수업을 찾을 수 없습니다')

    const nextWorkoutCategoryId = input.workoutCategoryId || slot.workout_category_id
    const nextStartAt = input.startAt || slot.start_at
    const nextEndAt = input.endAt || slot.end_at
    const nextCapacity = Number(input.capacity ?? slot.capacity)
    const reservedCount = Number(slot.reserved_count || 0)

    if (new Date(nextStartAt).getTime() >= new Date(nextEndAt).getTime()) {
      throw new Error('종료 시간은 시작 시간보다 늦어야 합니다')
    }
    assertFutureDate(nextStartAt, '지난 시간으로 수업을 수정할 수 없습니다')
    if (nextCapacity < reservedCount) {
      throw new Error('예약 인원보다 적은 정원으로 수정할 수 없습니다')
    }

    if (input.workoutCategoryId && input.workoutCategoryId !== slot.workout_category_id) {
      const licensed = await LicenseService.hasLicense(input.branchId, input.workoutCategoryId)
      if (!licensed) throw new Error('라이선스가 없는 운동 대분류는 수업으로 등록할 수 없습니다')
    }

    await executeQuery(`
      UPDATE class_slots
      SET
        workout_category_id = ?,
        title = ?,
        start_at = ?,
        end_at = ?,
        capacity = ?,
        recurrence_rule = ?
      WHERE id = ? AND branch_id = ? AND is_active = TRUE
    `, [
      nextWorkoutCategoryId,
      input.title ?? slot.title,
      nextStartAt,
      nextEndAt,
      nextCapacity,
      input.recurrenceRule === undefined ? slot.recurrence_rule : input.recurrenceRule,
      slotId,
      input.branchId,
    ])

    const updatedRows = await this.getSlotById(slotId, input.branchId)
    return updatedRows[0]
  }

  static async cancelSlot(slotId: string, branchId: string | number) {
    const result = await executeQuery(
      'UPDATE class_slots SET is_active = FALSE WHERE id = ? AND branch_id = ?',
      [slotId, branchId]
    )
    return result.affectedRows > 0
  }

  static async listMyBookings(userId: string) {
    return executeQuery(`
      SELECT
        cb.*,
        cs.title,
        cs.start_at,
        cs.end_at,
        cs.capacity,
        wc.major_category,
        wc.major_category_name
      FROM class_bookings cb
      INNER JOIN class_slots cs ON cs.id = cb.slot_id
      INNER JOIN workout_categories wc ON wc.id = cs.workout_category_id
      WHERE cb.user_id = ?
      ORDER BY cs.start_at DESC
    `, [userId])
  }

  static async createBooking(slotId: string, userId: string, userBranchId: string | number) {
    return executeTransaction([
      async (connection) => {
        const [slotRows] = await connection.execute(
          `SELECT id, branch_id, workout_category_id, capacity, start_at
           FROM class_slots
           WHERE id = ? AND is_active = TRUE
           FOR UPDATE`,
          [slotId]
        ) as any
        const slot = slotRows?.[0]
        if (!slot) throw new Error('예약 가능한 수업을 찾을 수 없습니다')
        if (String(slot.branch_id) !== String(userBranchId)) throw new Error('소속 지점 수업만 예약할 수 있습니다')
        assertFutureDate(slot.start_at, '지난 수업은 예약할 수 없습니다')

        const licensed = await LicenseService.hasLicense(slot.branch_id, slot.workout_category_id)
        if (!licensed) throw new Error('라이선스가 만료된 수업은 예약할 수 없습니다')

        const [countRows] = await connection.execute(
          `SELECT COUNT(*) AS total
           FROM class_bookings
           WHERE slot_id = ? AND status IN ${ACTIVE_BOOKING_STATUSES}`,
          [slotId]
        ) as any
        if ((countRows?.[0]?.total || 0) >= slot.capacity) throw new Error('정원이 마감되었습니다')

        const [overlapRows] = await connection.execute(
          `SELECT cb.id
           FROM class_bookings cb
           INNER JOIN class_slots cs ON cs.id = cb.slot_id
           WHERE cb.user_id = ?
             AND cb.status IN ${ACTIVE_BOOKING_STATUSES}
             AND cs.start_at < (SELECT end_at FROM class_slots WHERE id = ?)
             AND cs.end_at > (SELECT start_at FROM class_slots WHERE id = ?)
           LIMIT 1`,
          [userId, slotId, slotId]
        ) as any
        if (overlapRows.length > 0) throw new Error('동일 시간대에 이미 예약된 수업이 있습니다')

        await connection.execute(
          `INSERT INTO class_bookings (slot_id, user_id, branch_id, status)
           VALUES (?, ?, ?, 'reserved')
           ON DUPLICATE KEY UPDATE status = 'reserved', cancelled_at = NULL, reserved_at = CURRENT_TIMESTAMP`,
          [slotId, userId, userBranchId]
        )

        return true
      }
    ])
  }

  static async changeBooking(bookingId: string, nextSlotId: string, userId: string, userBranchId: string | number) {
    return executeTransaction([
      async (connection) => {
        const [bookingRows] = await connection.execute(
          `SELECT cb.id, cb.slot_id, cb.user_id, cb.branch_id, cb.status, cs.start_at
           FROM class_bookings cb
           INNER JOIN class_slots cs ON cs.id = cb.slot_id
           WHERE cb.id = ? AND cb.user_id = ? AND cb.status = 'reserved'
           FOR UPDATE`,
          [bookingId, userId]
        ) as any
        const booking = bookingRows?.[0]
        if (!booking) throw new Error('변경 가능한 예약을 찾을 수 없습니다')
        assertFutureDate(booking.start_at, '시작된 수업 예약은 변경할 수 없습니다')

        if (booking.slot_id === nextSlotId) {
          return true
        }

        const [slotRows] = await connection.execute(
          `SELECT id, branch_id, workout_category_id, capacity, start_at, end_at
           FROM class_slots
           WHERE id = ? AND is_active = TRUE
           FOR UPDATE`,
          [nextSlotId]
        ) as any
        const slot = slotRows?.[0]
        if (!slot) throw new Error('변경할 수업을 찾을 수 없습니다')
        if (String(slot.branch_id) !== String(userBranchId)) throw new Error('소속 지점 수업으로만 변경할 수 있습니다')
        assertFutureDate(slot.start_at, '지난 수업으로 예약을 변경할 수 없습니다')

        const licensed = await LicenseService.hasLicense(slot.branch_id, slot.workout_category_id)
        if (!licensed) throw new Error('라이선스가 만료된 수업은 예약할 수 없습니다')

        const [countRows] = await connection.execute(
          `SELECT COUNT(*) AS total
           FROM class_bookings
           WHERE slot_id = ? AND status IN ${ACTIVE_BOOKING_STATUSES}`,
          [nextSlotId]
        ) as any
        if ((countRows?.[0]?.total || 0) >= slot.capacity) throw new Error('정원이 마감되었습니다')

        const [overlapRows] = await connection.execute(
          `SELECT cb.id
           FROM class_bookings cb
           INNER JOIN class_slots cs ON cs.id = cb.slot_id
           WHERE cb.user_id = ?
             AND cb.id <> ?
             AND cb.status IN ${ACTIVE_BOOKING_STATUSES}
             AND cs.start_at < ?
             AND cs.end_at > ?
           LIMIT 1`,
          [userId, bookingId, slot.end_at, slot.start_at]
        ) as any
        if (overlapRows.length > 0) throw new Error('동일 시간대에 이미 예약된 수업이 있습니다')

        await connection.execute(
          `DELETE FROM class_bookings
           WHERE slot_id = ? AND user_id = ? AND status = 'cancelled'`,
          [nextSlotId, userId]
        )

        await connection.execute(
          `UPDATE class_bookings
           SET slot_id = ?, branch_id = ?, status = 'reserved', cancelled_at = NULL, reserved_at = CURRENT_TIMESTAMP
           WHERE id = ? AND user_id = ?`,
          [nextSlotId, userBranchId, bookingId, userId]
        )

        return true
      }
    ])
  }

  static async cancelBooking(bookingId: string, userId: string) {
    const result = await executeQuery(`
      UPDATE class_bookings cb
      INNER JOIN class_slots cs ON cs.id = cb.slot_id
      SET cb.status = 'cancelled', cb.cancelled_at = NOW()
      WHERE cb.id = ?
        AND cb.user_id = ?
        AND cb.status = 'reserved'
        AND cs.start_at > NOW()
    `, [bookingId, userId])

    return result.affectedRows > 0
  }

  static async listSlotBookings(slotId: string, branchId: string | number) {
    const slotRows = await executeQuery(
      `SELECT id FROM class_slots WHERE id = ? AND branch_id = ? AND is_active = TRUE LIMIT 1`,
      [slotId, branchId]
    )
    if (!slotRows?.length) throw new Error('수업을 찾을 수 없습니다')

    return executeQuery(`
      SELECT
        cb.id,
        cb.slot_id,
        cb.user_id,
        cb.branch_id,
        cb.status,
        cb.reserved_at,
        cb.cancelled_at,
        u.userid,
        u.name,
        u.email
      FROM class_bookings cb
      INNER JOIN users u ON u.id = cb.user_id
      WHERE cb.slot_id = ?
      ORDER BY
        FIELD(cb.status, 'reserved', 'attended', 'noshow', 'cancelled'),
        cb.reserved_at ASC
    `, [slotId])
  }

  static async updateBookingAttendance(
    bookingId: string,
    branchId: string | number,
    status: AttendanceStatus
  ) {
    const rows = await executeQuery(
      `SELECT cb.id, cb.status
       FROM class_bookings cb
       INNER JOIN class_slots cs ON cs.id = cb.slot_id
       WHERE cb.id = ? AND cs.branch_id = ? AND cs.is_active = TRUE
       LIMIT 1`,
      [bookingId, branchId]
    )
    const booking = rows?.[0]
    if (!booking) throw new Error('변경할 예약을 찾을 수 없습니다')
    if (booking.status === 'cancelled') {
      throw new Error('취소된 예약은 출석 상태를 변경할 수 없습니다')
    }

    await executeQuery(
      `UPDATE class_bookings
       SET status = ?,
           cancelled_at = NULL
       WHERE id = ?`,
      [status, bookingId]
    )

    return true
  }
}
