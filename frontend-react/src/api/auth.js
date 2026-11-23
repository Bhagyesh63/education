import { frappeCall, getCookie } from './client';

export const authApi = {
  login: async (usr, pwd) => {
    try {
      const res = await frappeCall('education.education.api.portal_login', { usr, pwd });
      return res;
    } catch (portalErr) {
      // Fallback to standard Frappe /api/method/login if needed
      const csrfToken = window.csrf_token || getCookie('csrf_token');
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(csrfToken && csrfToken !== 'None' ? { 'X-Frappe-CSRF-Token': csrfToken } : {}),
      };
      const response = await fetch('/api/method/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ usr, pwd }),
        credentials: 'include',
      });

      if (!response.ok) {
        let errorData = null;
        try { errorData = await response.json(); } catch {}
        const msg = errorData?.message || portalErr?.message || 'Invalid username or password';
        throw new Error(msg);
      }
      return await response.json();
    }
  },

  logout: async () => {
    try {
      return await frappeCall('logout');
    } catch {
      return null;
    }
  },

  getPortalContext: () => 
    frappeCall('education.education.api.get_portal_context'),
  
  getSchoolSettings: () => 
    frappeCall('education.education.api.get_school_abbr_logo', {}, { httpMethod: 'GET' }),

  getUserInfo: () =>
    frappeCall('education.education.api.get_user_info'),
};

export default authApi;
