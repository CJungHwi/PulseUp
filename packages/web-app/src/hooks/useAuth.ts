import { useSelector } from 'react-redux';
import { RootState } from '../store';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  userid: string;
  branchId?: string;
  branchName?: string;
}

export const useAuth = () => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  const isSuperAdmin = user?.role === 'super_admin';
  const isBranchAdmin = user?.role === 'branch_admin';
  const isAdmin = isSuperAdmin || isBranchAdmin;
  const isUser = user?.role === 'user';
  
  return {
    user: user as User | null,
    isAuthenticated,
    isSuperAdmin,
    isBranchAdmin,
    isAdmin,
    isUser,
    role: user?.role || null
  };
};