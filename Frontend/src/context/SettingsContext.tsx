import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

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
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => {
    const stored = localStorage.getItem('isDarkMode');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [cameraEnabled, setCameraEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('cameraEnabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [micEnabled, setMicEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('micEnabled');
    return stored !== null ? JSON.parse(stored) : false;
  });

  const [avatarId, setAvatarIdState] = useState<string>(() => {
    return localStorage.getItem('avatarId') || 'fox';
  });

  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  const setIsDarkMode = (v: boolean) => {
    setIsDarkModeState(v);
    localStorage.setItem('isDarkMode', JSON.stringify(v));
  };

  const setCameraEnabled = (v: boolean) => {
    setCameraEnabledState(v);
    localStorage.setItem('cameraEnabled', JSON.stringify(v));
  };

  const setMicEnabled = (v: boolean) => {
    setMicEnabledState(v);
    localStorage.setItem('micEnabled', JSON.stringify(v));
  };

  const setAvatarId = (id: string) => {
    setAvatarIdState(id);
    localStorage.setItem('avatarId', id);
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
