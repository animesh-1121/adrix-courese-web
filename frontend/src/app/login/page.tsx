'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { scaleVariants } from '@/utilities/animations';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const { login, isLoading, isAuthenticated } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push(redirect);
    }
  }, [isLoading, isAuthenticated, redirect, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
      const result = await login(email, password);
      router.push(redirect);
    } catch (error) {
      console.error('Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      setIsLoggingIn(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          variants={scaleVariants}
          initial="hidden"
          animate="visible"
          className="max-w-md w-full"
        >
          <div className="bg-surface border border-border rounded-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">N</span>
              </div>
              <h1 className="text-2xl font-bold text-dark mb-2">Welcome back</h1>
              <p className="text-muted">Sign in to continue your nursing test preparation.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="student@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="bg-error/10 text-error text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoggingIn || isLoading}
                size="lg"
                className="w-full"
              >
                {isLoggingIn || isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Don't have an account?{' '}
                <a href="/register" className="text-primary hover:underline">
                  Register
                </a>
              </p>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/admin/login"
                className="text-sm text-primary hover:underline"
              >
                Admin Login
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
