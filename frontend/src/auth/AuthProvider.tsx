import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import type { LoginResponse, User } from "../types/auth";
import { apiRequest } from "../services/api";

const tokenKey = "grant-review.auth-token";
const userKey = "grant-review.auth-user";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function storedUser() {
  try {
    const value = localStorage.getItem(userKey);
    return value ? JSON.parse(value) as User : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [user, setUser] = useState<User | null>(() => storedUser());
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    let active = true;
    apiRequest<{ user: User }>("/auth/me", { token })
      .then(({ user: restoredUser }) => {
        if (!active) return;
        localStorage.setItem(userKey, JSON.stringify(restoredUser));
        setUser(restoredUser);
      })
      .catch(() => { if (active) clearSession(); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token]);

  const login = async (email: string, password: string) => {
    const result = await apiRequest<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem(tokenKey, result.token);
    localStorage.setItem(userKey, JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = () => clearSession();

  return <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
