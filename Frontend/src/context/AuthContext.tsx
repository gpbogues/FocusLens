import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  username: string;
  email: string;
  userId: number;
  avatarUrl: string | null;
}

interface InitialSettings {
  isDarkMode: boolean;
  cameraEnabled: boolean;
  micEnabled: boolean;
  avatarId: string;
}

interface AuthContextType {
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;
  sessionTrigger: number;
  notifySessionSaved: () => void;
  initialSettings: InitialSettings | null;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_URL = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTrigger, setSessionTrigger] = useState(0);
  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);

  //On mount, call /init to repopulates session and prefetch settings in one round-trip
  useEffect(() => {
    fetch(`${API_URL}/init`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser({ username: data.username, email: data.email, userId: data.userId, avatarUrl: data.avatarUrl ?? null });
          setInitialSettings(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  //Called after /login succeeds, backend already set the cookie, so just fetch /init
  const login = async () => {
    const res = await fetch(`${API_URL}/init`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      setUser({ username: data.username, email: data.email, userId: data.userId, avatarUrl: data.avatarUrl ?? null });
      setInitialSettings(data.settings);
    }
  };

  //Clears the cookie server-side then wipes local state
  const logout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setInitialSettings(null);
  };

  //Updates user fields in context only (no localStorage, cookie holds the token)
  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  const notifySessionSaved = () => setSessionTrigger(prev => prev + 1);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading, sessionTrigger, notifySessionSaved, initialSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
