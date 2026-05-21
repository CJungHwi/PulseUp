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
  
  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';
  
  return {
    user: user as User | null,
    isAuthenticated,
    isAdmin,
    isUser,
    role: user?.role || null
  };
};