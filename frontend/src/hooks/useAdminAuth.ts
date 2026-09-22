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

const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_USER_KEY = 'adminUser';

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true
  });

  useEffect(() => {
    // Check localStorage on mount
    const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const storedUser = localStorage.getItem(ADMIN_USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setAuthState({
          isAuthenticated: true,
          user: parsed,
          isLoading: false
        });
      } catch (error) {
        console.error('Error parsing admin auth state:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false
        });
      }
    } else {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ user: User }> => {
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

      // Verify user is admin
      if (data.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin role required.');
      }

      // Store in admin-specific localStorage keys
      localStorage.setItem(ADMIN_TOKEN_KEY, data.authToken);
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(data.user));

      setAuthState({
        isAuthenticated: true,
        user: data.user,
        isLoading: false
      });

      return {
        user: data.user
      };
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

    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setAuthState(newAuthState);
  };

  return {
    ...authState,
    login,
    logout
  };
}
