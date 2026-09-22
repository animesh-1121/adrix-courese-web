'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ProgressBar from '@/components/ProgressBar';
import { mcqTransition, useScrollReveal } from '@/utilities/animations';
import { useAuth } from '@/hooks/useAuth';
import { fetchWithAuth } from '@/lib/auth';

interface Question {
  id: string;
  test_series_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  explanation: string;
  order_index: number;
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const testSeriesId = params.id as string;
  const scrollReveal = useScrollReveal();
  const { isAuthenticated, user, isLoading } = useAuth();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(45 * 60); // 45 minutes in seconds
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [testSeries, setTestSeries] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load before checking authentication
    if (isLoading) {
      return;
    }

    // Check authentication
    if (!isAuthenticated) {
      router.push(`/login?redirect=/tests/${testSeriesId}`);
      return;
    }

    const fetchData = async () => {
      try {
        // Start attempt
        const startResponse = await fetchWithAuth(`http://localhost:5000/api/tests/${testSeriesId}/start`, {
          method: 'POST'
        });

        if (startResponse.ok) {
          const startData = await startResponse.json();
          setAttemptId(startData.attemptId);
        } else {
          const errorData = await startResponse.json();
          if (errorData.code === 'PURCHASE_REQUIRED') {
            router.push(`/unlock/${testSeriesId}`);
            return;
          }
          throw new Error(errorData.error || 'Failed to start test');
        }

        // Fetch test series info
        const seriesResponse = await fetch(`http://localhost:5000/api/test-series/${testSeriesId}`);
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          setTestSeries(seriesData);
        } else {
          console.error('Failed to fetch test series:', seriesResponse.status);
          setError('Unable to load test series. Please try again.');
        }

        // Fetch questions WITHOUT correct answers
        const questionsResponse = await fetchWithAuth(`http://localhost:5000/api/test-series/${testSeriesId}/questions`);
        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          setQuestions(questionsData);
        } else if (questionsResponse.status === 403) {
          const errorData = await questionsResponse.json();
          setError(errorData.error || 'This test series requires purchase.');
        } else {
          console.error('Failed to fetch questions:', questionsResponse.status);
          setError('Unable to load questions. Please try again.');
        }
      } catch (error) {
        console.error('Failed to fetch test data:', error);
        if (error instanceof Error && error.message === 'Authentication required') {
          // Already handled by fetchWithAuth
          return;
        }
        setError(error instanceof Error ? error.message : 'Unable to connect to server. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testSeriesId, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!testSeries) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testSeries]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleMarkForReview = () => {
    const currentQuestion = questions[currentQuestionIndex];
    setMarkedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion.id)) {
        newSet.delete(currentQuestion.id);
      } else {
        newSet.add(currentQuestion.id);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    if (!attemptId) {
      console.error('No attempt ID');
      return;
    }

    try {
      const response = await fetchWithAuth(`http://localhost:5000/api/tests/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: selectedAnswers })
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/results/${attemptId}`);
      } else {
        console.error('Failed to submit test:', response.status);
        alert('Failed to submit test. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Unable to connect to server. Please try again.');
    }
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;

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

  if (!testSeries || questions.length === 0) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-muted">Test series not found or no questions available.</p>
        </div>
      </MainLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isTimeLow = timeRemaining < 300; // Less than 5 minutes

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Test Header */}
        <motion.div
          {...scrollReveal}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-dark">{testSeries.title}</h1>
              <p className="text-sm text-muted">Question {currentQuestionIndex + 1} of {questions.length}</p>
            </div>
            <div className={`px-6 py-3 rounded-lg font-mono text-lg font-bold ${
              isTimeLow 
                ? 'bg-error/10 text-error border border-error/30' 
                : 'bg-primary/10 text-primary border border-primary/30'
            }`}>
              {formatTime(timeRemaining)}
            </div>
          </div>
          
          <ProgressBar progress={((currentQuestionIndex + 1) / questions.length) * 100} showLabel={false} size="sm" />
        </motion.div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            variants={mcqTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="bg-surface border border-border rounded-lg p-6 md:p-8 mb-6"
          >
            <div className="mb-6">
              <span className="text-sm text-muted font-medium">Question {currentQuestionIndex + 1}</span>
            </div>
            
            <h3 className="text-lg md:text-xl font-semibold text-dark mb-6">
              {currentQuestion.question_text}
            </h3>
            
            <div className="space-y-3">
              {[
                currentQuestion.option_a,
                currentQuestion.option_b,
                currentQuestion.option_c,
                currentQuestion.option_d
              ].map((option, index) => {
                const isSelected = selectedAnswers[currentQuestion.id] === index;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-white hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        isSelected ? 'border-primary bg-primary text-white' : 'border-border'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-dark font-medium' : 'text-muted'}`}>
                        {option}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div
          {...scrollReveal}
          className="flex items-center justify-between"
        >
          <Button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            variant="outline"
          >
            Previous
          </Button>
          
          <Button
            onClick={handleMarkForReview}
            variant={markedForReview.has(currentQuestion.id) ? 'outline' : 'secondary'}
          >
            {markedForReview.has(currentQuestion.id) ? 'Unmark Review' : 'Mark for Review'}
          </Button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit}>
              Submit Test
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </motion.div>

        {/* Question Navigator */}
        <motion.div
          {...scrollReveal}
          className="mt-8 bg-surface border border-border rounded-lg p-6"
        >
          <h3 className="font-semibold text-dark mb-4">Question Navigator</h3>
          
          <div className="grid grid-cols-10 gap-2 mb-4">
            {questions.map((q, index) => {
              const isAnswered = selectedAnswers[q.id] !== undefined;
              const isMarked = markedForReview.has(q.id);
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-primary text-white'
                      : isMarked
                      ? 'bg-warning text-white'
                      : isAnswered
                      ? 'bg-success text-white'
                      : 'bg-border text-muted hover:bg-border/80'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-muted">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-success rounded"></div>
              <span>Answered</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-border rounded"></div>
              <span>Unanswered</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-warning rounded"></div>
              <span>Marked</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-primary rounded"></div>
              <span>Current</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Submit Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Test?"
      >
        <div className="space-y-4">
          <p className="text-muted">
            You have {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}. Are you sure you want to submit?
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Answered:</span>
            <span className="text-dark font-medium">{answeredCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Unanswered:</span>
            <span className="text-dark font-medium">{unansweredCount}</span>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={() => setShowSubmitModal(false)}
              variant="outline"
              className="flex-1"
            >
              Continue Test
            </Button>
            <Button
              onClick={confirmSubmit}
              className="flex-1"
            >
              Submit Test
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}