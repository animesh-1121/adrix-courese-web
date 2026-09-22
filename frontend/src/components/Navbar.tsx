'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100' 
          : 'bg-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="text-xl font-semibold text-dark">Nursing Level Up</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className="text-muted hover:text-primary transition-colors text-sm font-medium"
            >
              Home
            </Link>
            <Link 
              href="/test-series" 
              className="text-muted hover:text-primary transition-colors text-sm font-medium"
            >
              Test Series
            </Link>
            {isAuthenticated && (
              <Link 
                href="/results" 
                className="text-muted hover:text-primary transition-colors text-sm font-medium"
              >
                Results
              </Link>
            )}
            
            {!isAuthenticated ? (
              <Link
                href="/login"
                className="bg-primary text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                Login
              </Link>
            ) : (
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard" 
                  className="text-muted hover:text-primary transition-colors text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link 
                  href="/profile" 
                  className="text-muted hover:text-primary transition-colors text-sm font-medium"
                >
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="text-muted hover:text-error transition-colors text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button - simplified for now */}
          <div className="md:hidden">
            <button className="text-muted hover:text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}