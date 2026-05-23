import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext } from '../store/authStore';
import type { User } from '../types';

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem('tpfcs_user');
        const token  = localStorage.getItem('access_token');

        if (stored && token && !isTokenExpired(token)) {
          const parsed: User = JSON.parse(stored);
          setUser(parsed);

          // If the stored user is missing icdv_name (old session before the fix),
          // fetch fresh user data from /auth/me to get it.
          if (parsed.icdv_id && !parsed.icdv_name) {
            try {
              const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000/api';
              const res = await fetch(`${BASE_URL}/v1/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const fresh: User = await res.json();
                const updated = { ...parsed, icdv_name: fresh.icdv_name ?? null };
                localStorage.setItem('tpfcs_user', JSON.stringify(updated));
                setUser(updated);
              }
            } catch {
              // silent — use stored user without icdv_name
            }
          }
        } else {
          localStorage.removeItem('tpfcs_user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } catch {
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = (u: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('tpfcs_user',    JSON.stringify(u));
    localStorage.setItem('access_token',  accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('tpfcs_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const updateUser = (partial: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem('tpfcs_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated:      !!user,
        isLoading,
        isSuperAdmin:         user?.role === 'super_admin',
        isSystemAdmin:        user?.role === 'system_admin',
        isDischargeOfficer:   user?.role === 'discharge_officer',
        isBackofficeOfficer:  user?.role === 'backoffice_officer',
        isTransferOfficer:    user?.role === 'transfer_officer',
        isYardOfficer:        user?.role === 'yard_officer',
        icdvId:               user?.icdv_id   ?? null,
        icdvName:             user?.icdv_name ?? null,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
