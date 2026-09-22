'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/auth';
import { fadeUpVariants, useScrollReveal } from '@/utilities/animations';

export default function ProfilePage() {
  const router = useRouter();
  const scrollReveal = useScrollReveal();
  const { isAuthenticated, logout, isLoading } = useAuth();

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load before checking authentication
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetchWithAuth('http://localhost:5000/api/auth/me');

        if (response.ok) {
          const data = await response.json();
          setUserData(data.user);
        } else {
          console.error('Failed to fetch profile:', response.status);
          setError('Unable to load profile. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error instanceof Error ? error.message : 'Unable to connect to server.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated, isLoading, router]);

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted">Loading...</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-error">{error}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Header */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
          className="mb-12"
        >
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {userData?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-dark mb-1">{userData?.name || 'User'}</h1>
                <p className="text-muted">{userData?.email || 'user@example.com'}</p>
                {userData?.phone && (
                  <p className="text-sm text-muted">Phone: {userData.phone}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold text-dark mb-6">Account Information</h2>
          
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted mb-1">Name</p>
                <p className="text-dark">{userData?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Email</p>
                <p className="text-dark">{userData?.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Phone</p>
                <p className="text-dark">{userData?.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Role</p>
                <p className="text-dark">{userData?.role || 'STUDENT'}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Member Since</p>
                <p className="text-dark">{userData?.created_at ? new Date(userData.created_at).toLocaleDateString() : '-'}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
        >
          <Button onClick={logout} variant="outline">
            Logout
          </Button>
        </motion.div>
      </div>
    </MainLayout>
  );
}