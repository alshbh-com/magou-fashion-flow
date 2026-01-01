import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Permission {
  permission: string;
  permission_type: 'view' | 'edit';
}

interface AdminUser {
  id: string;
  username: string;
  password: string;
  permissions: Permission[];
}

interface AdminAuthContextType {
  isLocked: boolean;
  currentUser: AdminUser | null;
  unlock: (password: string) => Promise<boolean>;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string, type?: 'view' | 'edit') => boolean;
  canEdit: (permission: string) => boolean;
  canView: (permission: string) => boolean;
  verifyUserPassword: (password: string) => boolean;
  logActivity: (action: string, section: string, details?: any) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('adminUnlocked');
    if (unlocked === 'true') {
      setIsLocked(false);
    }

    const savedUser = sessionStorage.getItem('adminUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const unlock = async (password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('system_passwords')
        .select('password')
        .eq('id', 'master')
        .single();

      if (error) throw error;

      if (data.password === password) {
        setIsLocked(false);
        sessionStorage.setItem('adminUnlocked', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking password:', error);
      return false;
    }
  };

  // Login by password only
  const login = async (password: string): Promise<boolean> => {
    try {
      const { data: user, error: userError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('password', password)
        .eq('is_active', true)
        .single();

      if (userError || !user) return false;

      const { data: permissions, error: permError } = await supabase
        .from('admin_user_permissions')
        .select('permission, permission_type')
        .eq('user_id', user.id);

      if (permError) throw permError;

      const adminUser: AdminUser = {
        id: user.id,
        username: user.username,
        password: user.password,
        permissions: permissions?.map(p => ({ 
          permission: p.permission, 
          permission_type: p.permission_type as 'view' | 'edit'
        })) || []
      };

      setCurrentUser(adminUser);
      sessionStorage.setItem('adminUser', JSON.stringify(adminUser));

      await logActivity('تسجيل دخول', 'auth', { username: user.username });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    if (currentUser) {
      logActivity('تسجيل خروج', 'auth', { username: currentUser.username });
    }
    setCurrentUser(null);
    sessionStorage.removeItem('adminUser');
  };

  // Check if user has permission (with optional type check)
  const hasPermission = (permission: string, type?: 'view' | 'edit'): boolean => {
    if (!currentUser) return false;
    
    // user_management has full access
    const hasUserMgmt = currentUser.permissions.some(p => p.permission === 'user_management');
    if (hasUserMgmt) return true;

    const userPerm = currentUser.permissions.find(p => p.permission === permission);
    if (!userPerm) return false;

    if (type === 'edit') {
      return userPerm.permission_type === 'edit';
    }
    
    return true; // view or any access
  };

  const canEdit = (permission: string): boolean => {
    return hasPermission(permission, 'edit');
  };

  const canView = (permission: string): boolean => {
    return hasPermission(permission);
  };

  // Verify the current user's password
  const verifyUserPassword = (password: string): boolean => {
    if (!currentUser) return false;
    return currentUser.password === password;
  };

  const logActivity = async (action: string, section: string, details?: any) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: currentUser?.id || null,
        username: currentUser?.username || 'نظام',
        action,
        section,
        details: details || null
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return (
    <AdminAuthContext.Provider value={{ 
      isLocked, 
      currentUser, 
      unlock, 
      login, 
      logout, 
      hasPermission,
      canEdit,
      canView,
      verifyUserPassword,
      logActivity 
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
