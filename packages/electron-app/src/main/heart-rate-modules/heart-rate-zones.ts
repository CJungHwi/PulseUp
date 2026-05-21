/**
 * 웹 API 배치 저장 시 zone 필드에 쓰는 문자열 (HeartRateManager 규칙)
 */
export function calculateHeartRateZoneForApi(heartRate: number): string {
  if (heartRate < 100) return 'rest'
  if (heartRate < 140) return 'fat-burn'
  if (heartRate < 170) return 'cardio'
  return 'peak'
}
