import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export const THEMES = ['dark', 'light', 'sunset', 'rose', 'stormy', 'hydrangea', 'pistachio', 'softspring'] as const;
export type Theme = typeof THEMES[number];

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (v: boolean) => void;
  micEnabled: boolean;
  setMicEnabled: (v: boolean) => void;
  avatarId: string;
  setAvatarId: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);
const API_URL = import.meta.env.VITE_API_URL;

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user, initialSettings } = useAuth();
  const userId = user?.userId;

  const [theme, setThemeState] = useState<Theme>('dark');
  const [cameraEnabled, setCameraEnabledState] = useState<boolean>(true);
  const [micEnabled, setMicEnabledState] = useState<boolean>(false);
  const [avatarId, setAvatarIdState] = useState<string>('fox');

  //Track whether initial settings have been loaded for this user
  const loadedForUser = useRef<number | undefined>(undefined);

  //When the logged-in user changes, apply settings — from /init prefetch if available, else fetch
  useEffect(() => {
    if (!userId) return;
    if (loadedForUser.current === userId) return;
    loadedForUser.current = userId;

    if (initialSettings) {
      //Settings arrived with /init, no extra round-trip needed
      setThemeState((initialSettings.theme as Theme) ?? 'dark');
      setCameraEnabledState(Boolean(initialSettings.cameraEnabled));
      setMicEnabledState(Boolean(initialSettings.micEnabled));
      setAvatarIdState(initialSettings.avatarId ?? 'fox');
    } else {
      //Fallback: fetch separately (should rarely happen)
      fetch(`${API_URL}/user/settings`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setThemeState((data.theme as Theme) ?? 'dark');
            setCameraEnabledState(Boolean(data.cameraEnabled));
            setMicEnabledState(Boolean(data.micEnabled));
            setAvatarIdState(data.avatarId ?? 'fox');
          }
        })
        .catch(() => {});
    }
  }, [userId, initialSettings]);

  //When user logs out, reset to defaults and clear the loaded marker
  useEffect(() => {
    if (!userId) {
      loadedForUser.current = undefined;
      setThemeState('dark');
      setCameraEnabledState(true);
      setMicEnabledState(false);
      setAvatarIdState('fox');
    }
  }, [userId]);

  //Apply theme to DOM whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const saveSettings = (patch: Partial<{ theme: Theme; cameraEnabled: boolean; micEnabled: boolean; avatarId: string }>) => {
    if (!userId) return;
    fetch(`${API_URL}/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, theme, cameraEnabled, micEnabled, avatarId, ...patch }),
    }).catch(() => {});
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    saveSettings({ theme: t });
  };

  const setCameraEnabled = (v: boolean) => {
    setCameraEnabledState(v);
    saveSettings({ cameraEnabled: v });
  };

  const setMicEnabled = (v: boolean) => {
    setMicEnabledState(v);
    saveSettings({ micEnabled: v });
  };

  const setAvatarId = (id: string) => {
    setAvatarIdState(id);
    saveSettings({ avatarId: id });
  };

  return (
    <SettingsContext.Provider value={{
      theme, setTheme,
      cameraEnabled, setCameraEnabled,
      micEnabled, setMicEnabled,
      avatarId, setAvatarId,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
