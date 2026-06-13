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

const STORAGE_USER    = 'tpfcs_user';
const STORAGE_ACCESS  = 'access_token';
const STORAGE_REFRESH = 'refresh_token';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token  = localStorage.getItem(STORAGE_ACCESS);
        const stored = localStorage.getItem(STORAGE_USER);

        if (!token || isTokenExpired(token)) {
          localStorage.removeItem(STORAGE_USER);
          localStorage.removeItem(STORAGE_ACCESS);
          localStorage.removeItem(STORAGE_REFRESH);
          setIsLoading(false);
          return;
        }

        if (stored) {
          try {
            const parsed: User = JSON.parse(stored);
            setUser(parsed);
            setIsLoading(false);
            // Background: refresh icdv_name if missing
            if (parsed.icdv_id && !parsed.icdv_name) {
              try {
                const base = import.meta.env.VITE_API_URL ?? '/api';
                const res  = await fetch(`${base}/v1/auth/me`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                  const fresh: User = await res.json();
                  const updated = { ...parsed, icdv_name: fresh.icdv_name ?? null };
                  localStorage.setItem(STORAGE_USER, JSON.stringify(updated));
                  setUser(updated);
                }
              } catch { /* silent */ }
            }
            return;
          } catch { /* fall through */ }
        }

        setIsLoading(false);

      } catch {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_ACCESS);
        localStorage.removeItem(STORAGE_REFRESH);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = (u: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem(STORAGE_USER,    JSON.stringify(u));
    localStorage.setItem(STORAGE_ACCESS,  accessToken);
    localStorage.setItem(STORAGE_REFRESH, refreshToken);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_ACCESS);
    localStorage.removeItem(STORAGE_REFRESH);
    setUser(null);
    // React Router redirects to /signin via ProtectedRoute
  };

  const updateUser = (partial: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem(STORAGE_USER, JSON.stringify(updated));
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
        isFuelOfficer:        user?.role === 'fuel_officer',
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
