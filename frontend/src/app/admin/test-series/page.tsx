'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/layouts/AdminLayout';
import { fetchWithAdminAuth } from '@/lib/adminAuth';

export default function AdminTestSeriesPage() {
  const [testSeries, setTestSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestSeries = async () => {
      try {
        const response = await fetchWithAdminAuth('http://localhost:5000/api/admin/test-series');
        
        if (response.ok) {
          const data = await response.json();
          setTestSeries(data);
        } else {
          console.error('Failed to fetch test series:', response.status);
          setError('Unable to load test series. Please try again.');
        }
      } catch (error) {
        console.error('Error fetching test series:', error);
        setError(error instanceof Error ? error.message : 'Unable to connect to server.');
      } finally {
        setLoading(false);
      }
    };

    fetchTestSeries();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-error">{error}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-dark">Test Series</h1>
          <Link
            href="/admin/test-series/new"
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
          >
            Create Test Series
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-primary/5">
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Title</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Duration</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Price</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Questions</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Status</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-dark">Actions</th>
              </tr>
            </thead>
            <tbody>
              {testSeries.map((ts) => (
                <tr key={ts.id} className="border-b border-border hover:bg-primary/5">
                  <td className="py-4 px-6 text-sm text-dark">{ts.title}</td>
                  <td className="py-4 px-6 text-sm text-muted">{ts.duration} min</td>
                  <td className="py-4 px-6 text-sm text-dark">
                    {ts.is_free ? 'FREE' : `₹${ts.price}`}
                  </td>
                  <td className="py-4 px-6 text-sm text-muted">{ts.question_count}</td>
                  <td className="py-4 px-6">
                    <span className={`text-xs px-2 py-1 rounded ${
                      ts.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 
                      ts.status === 'DRAFT' ? 'bg-warning/10 text-warning' : 
                      'bg-muted/10 text-muted'
                    }`}>
                      {ts.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Link href={`/admin/test-series/${ts.id}`} className="text-primary hover:underline text-sm">
                        View
                      </Link>
                      <Link href={`/admin/test-series/${ts.id}/questions`} className="text-primary hover:underline text-sm">
                        Questions
                      </Link>
                      <Link href={`/admin/test-series/${ts.id}/import`} className="text-primary hover:underline text-sm">
                        Import
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}