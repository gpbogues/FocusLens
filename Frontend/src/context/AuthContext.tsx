import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface User {
  username: string;
  email: string;
  userId: number;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const login = (userData: User) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/*
SebGu Notes:
this file is basically a bucket, bucket has stored values to be pulled from,
example, after login, profile section will contain username and email info via,

interface User {
  username: string;
  email: string;
}

meaning any info that needs to be used, for context or any-else, can be stored here,
to be more specific, its user identification info that are stored here 
*/