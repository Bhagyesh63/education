import { frappeCall, getCookie, resetCsrfToken } from './client';

export const authApi = {
  login: async (usr, pwd) => {
    try {
      const res = await frappeCall('education.education.api.portal_login', { usr, pwd });
      resetCsrfToken();
      return res;
    } catch (portalErr) {
      // Wrong credentials: don't retry against /api/method/login, that would count
      // every failed attempt twice towards Frappe's login-attempt lockout.
      if (portalErr?.status === 401 || portalErr?.data?.exc_type === 'AuthenticationError') {
        throw portalErr;
      }
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
      resetCsrfToken();
      return await response.json();
    }
  },

  logout: async () => {
    try {
      return await frappeCall('logout');
    } catch {
      return null;
    } finally {
      resetCsrfToken();
    }
  },

  getPortalContext: () => 
    frappeCall('education.education.api.get_portal_context'),
  
  getSchoolSettings: () => 
    frappeCall('education.education.api.get_school_abbr_logo', {}, { httpMethod: 'GET' }),

  getUserInfo: () =>
    frappeCall('education.education.api.get_user_info'),

  // Developer-mode quick-pick login directory (empty lists when developer_mode is off)
  getDemoAccounts: () =>
    frappeCall('education.education.api.get_demo_accounts', {}, { httpMethod: 'GET' }),

  // Administrator "preview as" (System Manager only, enforced server-side)
  getPreviewTargets: () =>
    frappeCall('education.education.api.get_preview_targets', {}, { httpMethod: 'GET' }),

  getPreviewContext: (target_role, target) =>
    frappeCall('education.education.api.get_preview_context', { target_role, target }),

  // Role-scoped dashboard widgets (student: self, guardian: own wards, staff: institution)
  getDashboardStats: (student, program) =>
    frappeCall('education.education.api.get_dashboard_stats', {
      ...(student ? { student } : {}),
      ...(program ? { program } : {}),
    }, { httpMethod: 'GET' }),

  getDashboardSchedule: (student, limit = 3) =>
    frappeCall('education.education.api.get_dashboard_schedule', {
      ...(student ? { student } : {}),
      limit,
    }, { httpMethod: 'GET' }),

  getRecentAssessments: (student, limit = 4) =>
    frappeCall('education.education.api.get_recent_assessments', {
      ...(student ? { student } : {}),
      limit,
    }, { httpMethod: 'GET' }),

  getDashboardAnnouncements: (student, limit = 20) =>
    frappeCall('education.education.api.get_dashboard_announcements', {
      ...(student ? { student } : {}),
      limit,
    }, { httpMethod: 'GET' }),
};

export default authApi;
