// Base HTTP and Session Client for Frappe Education
// Handles cookie inspection, session user decoding, and CSRF token propagation.

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export function getSessionUser() {
  const user = getCookie('user_id');
  return (!user || user === 'Guest') ? null : decodeURIComponent(user);
}

export async function frappeCall(method, args = {}, options = {}) {
  const csrfToken = window.csrf_token || getCookie('csrf_token');
  const isGet = (options.httpMethod || 'POST').toUpperCase() === 'GET' || (options.httpMethod || '').toUpperCase() === 'HEAD';

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(csrfToken && csrfToken !== 'None' ? { 'X-Frappe-CSRF-Token': csrfToken } : {}),
    ...(options.headers || {}),
  };

  let url = `/api/method/${method}`;
  if (isGet && args && Object.keys(args).length > 0) {
    const qs = new URLSearchParams(args).toString();
    url += `?${qs}`;
  }

  const fetchOpts = {
    method: isGet ? 'GET' : (options.httpMethod || 'POST'),
    headers,
    credentials: 'include',
  };

  if (!isGet && args !== undefined && args !== null) {
    fetchOpts.body = JSON.stringify(args);
  }

  const response = await fetch(url, fetchOpts);

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore
    }
    const message = errorData?._server_messages 
      ? JSON.parse(errorData._server_messages).map(m => {
          try { return JSON.parse(m).message; } catch { return m; }
        }).join(' ')
      : (errorData?.exception || errorData?.message || `Request failed with status ${response.status}`);
    
    const error = new Error(message);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  const result = await response.json();
  return result.message !== undefined ? result.message : result;
}
