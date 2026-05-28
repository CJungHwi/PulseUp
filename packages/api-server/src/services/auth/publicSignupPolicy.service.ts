import { BranchService } from '../database.service.js'

export interface PublicSignupInput {
  userid: string
  email: string | null
  name: string
  password: string
  branchId?: string | null
}

export interface NormalizedPublicSignupInput extends PublicSignupInput {
  role: 'user' | 'branch_admin'
  branchId: string | null
}

export class PublicSignupPolicyService {
  static async normalize(input: PublicSignupInput): Promise<NormalizedPublicSignupInput> {
    const branchId = String(input.branchId || '').trim()
    if (!branchId) {
      return {
        userid: input.userid.trim(),
        email: input.email,
        name: input.name.trim(),
        password: input.password,
        branchId: null,
        role: 'branch_admin'
      }
    }

    const branch = await BranchService.getBranchById(branchId)
    if (!branch) {
      throw new Error('존재하지 않는 지점입니다')
    }

    return {
      userid: input.userid.trim(),
      email: input.email,
      name: input.name.trim(),
      password: input.password,
      branchId,
      role: 'user'
    }
  }
}
