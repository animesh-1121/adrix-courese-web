'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'STUDENT' | 'ADMIN';
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

const AUTH_STORAGE_KEY = 'nursing_level_up_auth';
const AUTH_TOKEN_KEY = 'nursing_level_up_token';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true
  });

  useEffect(() => {
    // Check localStorage on mount
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);

    console.log('Auth initialization:', { hasAuth: !!storedAuth, hasToken: !!storedToken });

    if (storedAuth && storedToken) {
      try {
        const parsed = JSON.parse(storedAuth);
        console.log('Restored auth state:', { user: parsed, token: storedToken });
        setAuthState({
          isAuthenticated: true,
          user: parsed,
          isLoading: false
        });
      } catch (error) {
        console.error('Error parsing auth state:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false
        });
      }
    } else {
      console.log('No stored auth found');
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      console.log('Login successful:', { user: data.user, token: data.authToken });

      // Store in localStorage
      localStorage.setItem(AUTH_TOKEN_KEY, data.authToken);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));

      console.log('Stored auth data:', {
        token: localStorage.getItem(AUTH_TOKEN_KEY),
        user: localStorage.getItem(AUTH_STORAGE_KEY)
      });

      setAuthState({
        isAuthenticated: true,
        user: data.user,
        isLoading: false
      });

      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const register = async (name: string, email: string, phone: string, password: string): Promise<User> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();

      // Store in localStorage
      localStorage.setItem(AUTH_TOKEN_KEY, String(data.authToken));
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));

      setAuthState({
        isAuthenticated: true,
        user: data.user,
        isLoading: false
      });

      return data.user;
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = (): void => {
    const newAuthState: AuthState = {
      isAuthenticated: false,
      user: null,
      isLoading: false
    };

    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthState(newAuthState);
  };

  return {
    ...authState,
    login,
    register,
    logout
  };
}