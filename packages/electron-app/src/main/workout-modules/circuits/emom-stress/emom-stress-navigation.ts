/**
 * 소스 요약 — EMOM-Stress 네비게이션
 *
 * 기능: 이전/다음 운동 단위 이동. EMOM-Stress 저장 순서(A1 SET1→SET2→SET3→A2...)는 저장 순서가 곧
 *       재생 순서이므로, EMOM의 순차 stop 이동(EmomNavigation)을 그대로 사용한다.
 * 호출 프로시저: 없음(Electron 재생 컨트롤러에서 사용).
 * 관련 components/modules: `../emom/emom-navigation.ts`, `playback-controller.ts`, `circuit-registry.ts`.
 */
import { EmomNavigation } from '../emom/emom-navigation'

export class EmomStressNavigation extends EmomNavigation {}
