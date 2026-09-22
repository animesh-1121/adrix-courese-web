// Helper to get admin token from localStorage
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('adminToken');
}

// Helper to add admin auth token to API requests
export async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const token = getAdminToken();
  
  if (!token) {
    throw new Error('Admin authentication required');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Admin-Auth': token,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle 401 - redirect to admin login
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new Error('Authentication required');
  }

  // Handle 403 - unauthorized
  if (response.status === 403) {
    throw new Error('Insufficient permissions');
  }

  return response;
}