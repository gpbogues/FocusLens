import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (v: boolean) => void;
  micEnabled: boolean;
  setMicEnabled: (v: boolean) => void;
  avatarId: string;
  setAvatarId: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.userId;

  // Prefix every localStorage key with the userId so settings are per-user
  const k = (key: string) => `user_${userId}_${key}`;

  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => {
    const stored = localStorage.getItem(k('isDarkMode'));
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [cameraEnabled, setCameraEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(k('cameraEnabled'));
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [micEnabled, setMicEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem(k('micEnabled'));
    return stored !== null ? JSON.parse(stored) : false;
  });

  const [avatarId, setAvatarIdState] = useState<string>(() => {
    return localStorage.getItem(k('avatarId')) || 'fox';
  });

  // When the logged-in user changes, reload all settings for the new user
  useEffect(() => {
    const dark = localStorage.getItem(k('isDarkMode'));
    setIsDarkModeState(dark !== null ? JSON.parse(dark) : true);

    const cam = localStorage.getItem(k('cameraEnabled'));
    setCameraEnabledState(cam !== null ? JSON.parse(cam) : true);

    const mic = localStorage.getItem(k('micEnabled'));
    setMicEnabledState(mic !== null ? JSON.parse(mic) : false);

    setAvatarIdState(localStorage.getItem(k('avatarId')) || 'fox');
  }, [userId]);

  // Apply dark/light theme to DOM whenever isDarkMode changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const setIsDarkMode = (v: boolean) => {
    setIsDarkModeState(v);
    localStorage.setItem(k('isDarkMode'), JSON.stringify(v));
  };

  const setCameraEnabled = (v: boolean) => {
    setCameraEnabledState(v);
    localStorage.setItem(k('cameraEnabled'), JSON.stringify(v));
  };

  const setMicEnabled = (v: boolean) => {
    setMicEnabledState(v);
    localStorage.setItem(k('micEnabled'), JSON.stringify(v));
  };

  const setAvatarId = (id: string) => {
    setAvatarIdState(id);
    localStorage.setItem(k('avatarId'), id);
  };

  return (
    <SettingsContext.Provider value={{
      isDarkMode, setIsDarkMode,
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
