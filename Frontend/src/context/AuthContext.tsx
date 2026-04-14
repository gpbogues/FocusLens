import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  username: string;
  email: string;
  userId: number;
  avatarUrl: string | null;
}

interface InitialSettings {
  theme: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  avatarId: string;
}

interface LoginPayload {
  userId: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  settings: InitialSettings;
}

interface AuthContextType {
  user: User | null;
  login: (payload: LoginPayload) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;
  sessionTrigger: number;
  notifySessionSaved: () => void;
  initialSettings: InitialSettings | null;
  highlightSession: boolean;
  requestHighlightSession: () => void;
  clearHighlightSession: () => void;
  openSnapshot: boolean;
  requestOpenSnapshot: () => void;
  clearOpenSnapshot: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const API_URL = import.meta.env.VITE_API_URL;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTrigger, setSessionTrigger] = useState(0);
  const [initialSettings, setInitialSettings] = useState<InitialSettings | null>(null);
  const [highlightSession, setHighlightSession] = useState(false);
  const [openSnapshot, setOpenSnapshot] = useState(false);

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

  //Called after /login succeeds, the login response already contains user + settings,
  //so we set state directly without an extra round-trip
  const login = (payload: LoginPayload) => {
    setUser({ username: payload.username, email: payload.email, userId: payload.userId, avatarUrl: payload.avatarUrl });
    setInitialSettings(payload.settings);
  };

  //Clears local state immediately(kinda), then fires /logout in the background to clear
  //the httpOnly cookie server-side, no await needed, user is effectively logged out instantly(kinda)
  const logout = () => {
    setUser(null);
    setInitialSettings(null);
    fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  //Updates user fields in context only (no localStorage, cookie holds the token)
  const updateUser = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  const notifySessionSaved = () => setSessionTrigger(prev => prev + 1);
  const requestHighlightSession = () => setHighlightSession(true);
  const clearHighlightSession = () => setHighlightSession(false);
  const requestOpenSnapshot = () => setOpenSnapshot(true);
  const clearOpenSnapshot = () => setOpenSnapshot(false);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading, sessionTrigger, notifySessionSaved, initialSettings, highlightSession, requestHighlightSession, clearHighlightSession, openSnapshot, requestOpenSnapshot, clearOpenSnapshot }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
