'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import CircularProgress from '@/components/CircularProgress';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/auth';
import { fadeUpVariants, useScrollReveal, progressVariants } from '@/utilities/animations';

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.id as string;
  const { isAuthenticated, isLoading } = useAuth();
  const scrollReveal = useScrollReveal();

  const [result, setResult] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
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

    const fetchResult = async () => {
      try {
        const response = await fetchWithAuth(`http://localhost:5000/api/tests/${attemptId}/result`);

        if (response.ok) {
          const data = await response.json();
          setResult(data.attempt);
          setAnswers(data.answers);
        } else {
          console.error('Failed to fetch result:', response.status);
          setError('Unable to load result. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching result:', error);
        setError(error instanceof Error ? error.message : 'Unable to connect to server.');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [attemptId, isAuthenticated, isLoading, router]);

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

  if (!result) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted">Result not found</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const percentage = result.total_questions > 0 
    ? Math.round((result.score / result.total_questions) * 100) 
    : 0;
  const timeTaken = result.time_taken 
    ? `${Math.floor(result.time_taken / 60)}:${(result.time_taken % 60).toString().padStart(2, '0')}`
    : '0:00';

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          {...scrollReveal}
          variants={fadeUpVariants}
        >
          <h1 className="text-3xl font-bold text-dark mb-2">Test Completed</h1>
          <p className="text-muted mb-8">{result.test_series_title || 'Test Series'}</p>

          {/* Score Display */}
          <div className="bg-surface border border-border rounded-lg p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-12">
              <motion.div
                variants={progressVariants}
                initial="hidden"
                animate="visible"
              >
                <CircularProgress 
                  progress={percentage} 
                  size={200}
                  strokeWidth={12}
                />
              </motion.div>
              
              <div className="text-center md:text-left">
                <div className="text-5xl font-bold text-dark mb-2">
                  {result.score} / {result.total_questions}
                </div>
                <div className="text-2xl font-semibold text-primary mb-6">
                  {percentage}%
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Correct:</span>
                    <span className="text-success font-medium">{result.correct_answers}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Incorrect:</span>
                    <span className="text-error font-medium">{result.incorrect_answers}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Unanswered:</span>
                    <span className="text-muted font-medium">{result.unanswered}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Time Taken:</span>
                    <span className="text-dark font-medium">{timeTaken}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Answer Review */}
          <div className="bg-surface border border-border rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-dark mb-4">Answer Review</h2>
            <div className="space-y-4">
              {answers.map((answer, index) => (
                <div key={answer.id} className={`border rounded-lg p-4 ${answer.is_correct ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dark">Question {index + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded ${answer.is_correct ? 'bg-success text-white' : 'bg-error text-white'}`}>
                      {answer.is_correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <p className="text-sm text-dark mb-3">{answer.question_text}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted">Selected:</span>
                      <span className="text-dark ml-2">{answer.selected_answer}. {answer[`option_${answer.selected_answer.toLowerCase()}`]}</span>
                    </div>
                    <div>
                      <span className="text-muted">Correct:</span>
                      <span className="text-dark ml-2">{answer.correct_answer}. {answer[`option_${answer.correct_answer.toLowerCase()}`]}</span>
                    </div>
                  </div>
                  {answer.explanation && (
                    <p className="text-sm text-muted italic">{answer.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}