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

// The SPA is not served from a Frappe template, so no csrf_token is injected into
// the page. Fetch it from the session on demand (and again whenever Frappe rejects
// a write with CSRFTokenError, e.g. after a desk login rotated the session).
let csrfTokenCache = null;
let csrfTokenRequest = null;

function refreshCsrfToken() {
  // de-duplicate concurrent refreshes (many components fire requests on mount)
  if (!csrfTokenRequest) {
    csrfTokenRequest = fetchCsrfToken().finally(() => {
      csrfTokenRequest = null;
    });
  }
  return csrfTokenRequest;
}

async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/method/education.education.api.get_csrf_token', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    const data = res.ok ? await res.json() : null;
    csrfTokenCache = data?.message || null;
  } catch {
    csrfTokenCache = null;
  }
  return csrfTokenCache;
}

// Human-readable message from a Frappe error response. Prefers the user-facing
// _server_messages / message over the raw `exception` string, and strips Python
// class prefixes such as "frappe.exceptions.PermissionError: ".
function extractErrorMessage(errorData) {
  if (!errorData) return '';
  if (errorData._server_messages) {
    try {
      const msgs = JSON.parse(errorData._server_messages)
        .map((m) => {
          try { return JSON.parse(m).message; } catch { return m; }
        })
        .filter(Boolean);
      if (msgs.length) return stripHtml(msgs.join(' '));
    } catch {
      // fall through
    }
  }
  if (typeof errorData.message === 'string' && errorData.message.trim()) {
    return errorData.message;
  }
  if (errorData.exception) {
    return String(errorData.exception).replace(/^[\w.]*(Error|Exception)\b:?\s*/, '').trim();
  }
  return '';
}

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function resetCsrfToken() {
  csrfTokenCache = null;
}

export async function frappeCall(method, args = {}, options = {}, _retried = false) {
  const isGet = (options.httpMethod || 'POST').toUpperCase() === 'GET' || (options.httpMethod || '').toUpperCase() === 'HEAD';
  let csrfToken = csrfTokenCache || window.csrf_token || getCookie('csrf_token');
  if (!isGet && !csrfToken && getSessionUser()) {
    csrfToken = await refreshCsrfToken();
  }

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
    if (!isGet && !_retried && errorData?.exc_type === 'CSRFTokenError') {
      await refreshCsrfToken();
      return frappeCall(method, args, options, true);
    }
    const message = extractErrorMessage(errorData) || `Request failed with status ${response.status}`;
    
    const error = new Error(message);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  const result = await response.json();
  return result.message !== undefined ? result.message : result;
}
