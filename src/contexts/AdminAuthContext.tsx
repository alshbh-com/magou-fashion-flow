import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  username: string;
  permissions: string[];
}

interface AdminAuthContextType {
  isLocked: boolean;
  currentUser: AdminUser | null;
  unlock: (password: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
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
    // Check if already unlocked
    const unlocked = sessionStorage.getItem('adminUnlocked');
    if (unlocked === 'true') {
      setIsLocked(false);
    }

    // Check for saved user
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

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { data: user, error: userError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('is_active', true)
        .single();

      if (userError || !user) return false;

      const { data: permissions, error: permError } = await supabase
        .from('admin_user_permissions')
        .select('permission')
        .eq('user_id', user.id);

      if (permError) throw permError;

      const adminUser: AdminUser = {
        id: user.id,
        username: user.username,
        permissions: permissions?.map(p => p.permission) || []
      };

      setCurrentUser(adminUser);
      sessionStorage.setItem('adminUser', JSON.stringify(adminUser));

      // Log the login
      await logActivity('تسجيل دخول', 'auth', { username });

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

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return true; // If no user system, allow all
    return currentUser.permissions.includes(permission) || currentUser.permissions.includes('user_management');
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
      logActivity 
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
