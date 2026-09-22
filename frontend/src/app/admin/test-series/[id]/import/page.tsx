'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminLayout from '@/layouts/AdminLayout';
import { fetchWithAdminAuth } from '@/lib/adminAuth';

export default function ImportQuestionsPage() {
  const params = useParams();
  const [htmlContent, setHtmlContent] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = async () => {
    try {
      const response = await fetchWithAdminAuth(`http://localhost:5000/api/admin/test-series/${params.id}/import/html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent })
      });
      
      if (response.ok) {
        const data = await response.json();
        setParsedQuestions(data.validQuestions);
        setShowPreview(true);
      } else {
        const errorData = await response.json();
        console.error('Failed to parse HTML:', response.status, errorData);
        alert(`Failed to parse HTML: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error parsing HTML:', error);
      alert(error instanceof Error ? error.message : 'Unable to connect to server. Please try again.');
    }
  };

  const handleConfirmImport = async () => {
    try {
      const response = await fetchWithAdminAuth(`http://localhost:5000/api/admin/test-series/${params.id}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: parsedQuestions })
      });

      if (response.ok) {
        alert('Questions imported successfully!');
        setShowPreview(false);
        setHtmlContent('');
        setParsedQuestions([]);
      } else {
        const errorData = await response.json();
        console.error('Failed to import questions:', response.status, errorData);
        alert(`Failed to import questions: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error importing questions:', error);
      alert(error instanceof Error ? error.message : 'Unable to connect to server. Please try again.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Link href={`/admin/test-series/${params.id}`} className="text-primary hover:underline text-sm">
            ← Back to Test Series
          </Link>
          <h1 className="text-2xl font-bold text-dark mt-2">Import Questions</h1>
        </div>

        {!showPreview ? (
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-dark mb-4">Upload HTML File</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Paste HTML Content
                </label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={10}
                  placeholder="Paste your HTML content here..."
                />
              </div>
              <button
                onClick={handleParse}
                disabled={!htmlContent}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Parse Questions
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-dark">Import Preview</h2>
                <p className="text-sm text-muted">Found {parsedQuestions.length} questions</p>
              </div>
              
              <div className="space-y-4">
                {parsedQuestions.map((q, index) => (
                  <div key={index} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-dark">Question {index + 1}</span>
                      <span className="text-xs px-2 py-1 rounded bg-success/10 text-success">✓ Valid</span>
                    </div>
                    <p className="text-sm text-dark mb-3">{q.question}</p>
                    <div className="space-y-1 mb-3">
                      {q.options.map((opt: string, i: number) => (
                        <div key={i} className="text-sm text-muted">
                          {String.fromCharCode(65 + i)}. {opt}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Correct: {q.correctAnswer}</span>
                      <span className="text-muted">{q.explanation?.substring(0, 50)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 border border-border rounded-lg hover:bg-primary/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors"
              >
                Confirm Import
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}