'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/auth';
import { fadeUpVariants, staggerContainer, useScrollReveal } from '@/utilities/animations';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const scrollReveal = useScrollReveal();

  const [dashboardData, setDashboardData] = useState<any>(null);
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

    const fetchDashboard = async () => {
      try {
        const response = await fetchWithAuth('http://localhost:5000/api/dashboard');

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        } else {
          console.error('Failed to fetch dashboard:', response.status);
          setError('Unable to load dashboard. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching dashboard:', error);
        setError(error instanceof Error ? error.message : 'Unable to connect to server.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [isAuthenticated, isLoading, router]);

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-error">{error}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold text-dark mb-2">Welcome back, {user?.name || 'Student'}</h1>
          <p className="text-muted">Continue your nursing test preparation.</p>
        </motion.div>

        {/* Your Progress */}
        <motion.div
          {...scrollReveal}
          variants={staggerContainer}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold text-dark mb-6">Your Progress</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Tests Attempted', value: dashboardData?.progress?.totalAttempts || 0 },
              { label: 'Tests Completed', value: dashboardData?.progress?.completedAttempts || 0 },
              { label: 'Average Score', value: `${dashboardData?.progress?.averageScore || 0}%` },
              { label: 'Best Score', value: dashboardData?.progress?.bestScore || 0 }
            ].map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeUpVariants}
                className="bg-surface border border-border rounded-lg p-6 text-center"
              >
                <p className="text-3xl font-bold text-primary mb-2">{stat.value}</p>
                <p className="text-sm text-muted">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Available Free Tests */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold text-dark mb-6">Available Free Tests</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData?.freeTests?.map((test: any) => (
              <div
                key={test.id}
                className="bg-surface border border-border rounded-lg p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark">{test.title}</h3>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted mb-4">
                  <span>{test.question_count} Questions</span>
                  <span>{test.duration} min</span>
                </div>
                
                <Button onClick={() => router.push(`/tests/${test.id}`)} variant="outline" size="sm" className="w-full">
                  Start Test
                </Button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Attempts */}
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
          className="mb-12"
        >
          <h2 className="text-xl font-semibold text-dark mb-6">Recent Attempts</h2>
          
          {dashboardData?.attempts && dashboardData.attempts.length > 0 ? (
            <div className="bg-surface border border-border rounded-lg divide-y divide-border">
              {dashboardData.attempts.map((attempt: any) => (
                <div key={attempt.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-dark">{attempt.test_series_title}</h3>
                    <p className="text-sm text-muted">{new Date(attempt.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${attempt.score >= 40 ? 'text-success' : attempt.score >= 35 ? 'text-primary' : 'text-error'}`}>
                      {attempt.score}/{attempt.total_questions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
              No attempts yet. Start a free test to track your progress!
            </div>
          )}
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