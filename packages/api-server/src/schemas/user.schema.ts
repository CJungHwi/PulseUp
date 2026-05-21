import { z } from 'zod'

export const createUserSchema = z.object({
  userid: z.string().min(6, '아이디는 최소 6자 이상이어야 합니다').max(50, '아이디는 50자를 초과할 수 없습니다'),
  email: z.string().email('유효한 이메일 주소를 입력해주세요').nullable().optional().or(z.literal('').transform(() => null)),
  name: z.string().min(1, '이름은 필수입니다'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  role: z.enum(['user', 'admin'/* , 'super_admin' */]).default('user'),
  branchId: z.string().uuid('올바른 지점 ID가 아닙니다').nullable().optional().or(z.literal('').transform(() => null)),
})

export const loginSchema = z.object({
  userid: z.string().min(1, '아이디를 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
})

export const updateUserSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').optional(),
  email: z.string().email('유효한 이메일 주소를 입력해주세요').optional(),
  branchId: z.string().uuid('올바른 지점 ID가 아닙니다').optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>