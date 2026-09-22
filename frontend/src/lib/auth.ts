// Helper to get auth token from localStorage
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nursing_level_up_token');
}

// Helper to get auth token for admin
export function getAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('adminToken');
}

// Helper to add auth token to API requests
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'X-Auth-Token': token }),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle 401 - redirect to login
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
    throw new Error('Authentication required');
  }

  // Handle 403 - unauthorized
  if (response.status === 403) {
    const error = await response.json();
    if (error.code === 'PURCHASE_REQUIRED') {
      throw new Error('PURCHASE_REQUIRED');
    }
    throw new Error('Insufficient permissions');
  }

  return response;
}