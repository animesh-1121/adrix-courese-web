'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/Button';
import { scaleVariants } from '@/utilities/animations';

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();

      // Verify user is admin
      if (data.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin role required.');
      }

      // Store admin auth with separate keys
      localStorage.setItem('adminToken', data.authToken);
      localStorage.setItem('adminUser', JSON.stringify(data.user));

      setIsLoading(false);
      router.push('/admin');
    } catch (error) {
      console.error('Admin login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 bg-background">
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
            <h1 className="text-2xl font-bold text-dark mb-2">Admin Login</h1>
            <p className="text-muted">Nursing Level Up Administration</p>
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="admin@nursinglevelup.com"
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
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-sm text-primary hover:underline"
            >
              Back to Student Login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
