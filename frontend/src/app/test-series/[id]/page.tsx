'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { fadeUpVariants, useScrollReveal } from '@/utilities/animations';

interface TestSeries {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  duration: number;
  isFree: boolean;
  price?: number;
}

export default function TestSeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const testSeriesId = params.id as string;
  const scrollReveal = useScrollReveal();
  const { isAuthenticated } = useAuth();
  const [testSeries, setTestSeries] = useState<TestSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestSeries = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/test-series/${testSeriesId}`);
        if (response.ok) {
          const data = await response.json();
          setTestSeries(data);
        } else {
          console.error('Failed to fetch test series:', response.status);
          setError('Unable to load test series. Please try again.');
        }
      } catch (error) {
        console.error('Failed to fetch test series:', error);
        setError('Unable to connect to server. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTestSeries();
  }, [testSeriesId]);

  const handleStartTest = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/tests/${testSeriesId}`);
      return;
    }
    router.push(`/tests/${testSeriesId}`);
  };

  const handleUnlock = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/unlock/${testSeriesId}`);
      return;
    }
    router.push(`/unlock/${testSeriesId}`);
  };

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

  if (!testSeries) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-muted">Test series not found.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-dark mb-2">{testSeries.title}</h1>
            <p className="text-muted">{testSeries.description}</p>
          </div>

          {/* Test Info */}
          <div className="bg-surface border border-border rounded-lg p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted mb-1">Questions</p>
                <p className="text-2xl font-bold text-dark">{testSeries.questionCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Duration</p>
                <p className="text-2xl font-bold text-dark">{testSeries.duration} min</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Difficulty</p>
                <p className="text-2xl font-bold text-dark">Moderate</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Price</p>
                <p className="text-2xl font-bold text-dark">
                  {testSeries.isFree ? 'FREE' : `₹${testSeries.price}`}
                </p>
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-dark mb-4">Topics Covered</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['Nursing Fundamentals', 'Medical-Surgical Nursing', 'Pharmacology', 'Patient Assessment', 'Infection Control', 'Patient Safety'].map((topic, index) => (
                <div key={index} className="flex items-center space-x-2 text-muted">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{topic}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center space-x-4">
            {testSeries.isFree ? (
              <Button onClick={handleStartTest} size="lg">
                Start Test
              </Button>
            ) : (
              <>
                <div className="flex items-center space-x-2 text-muted mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>This test series requires access.</span>
                </div>
                <Button onClick={handleUnlock} size="lg">
                  Unlock Test Series
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}