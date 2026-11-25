// Consolidated Barrel and Unified API Export for Frappe Education
// Assembles all modular domain-specific API files into a single, cohesive, fully backward-compatible interface.

import { getCookie, getSessionUser, frappeCall } from './client';
import { authApi } from './auth';
import { studentsApi } from './students';
import { curriculumApi } from './curriculum';
import { scheduleApi } from './schedule';
import { attendanceApi } from './attendance';
import { gradesApi } from './grades';
import { feesApi } from './fees';
import { achievementsApi } from './achievements';
import { admissionsApi } from './admissions';
import { enrollmentApi } from './enrollment';

// Export all transport helpers and utilities
export * from './client';

// Export individual domain modules for modular imports
export { authApi } from './auth';
export { studentsApi } from './students';
export { curriculumApi } from './curriculum';
export { scheduleApi } from './schedule';
export { attendanceApi } from './attendance';
export { gradesApi } from './grades';
export { feesApi } from './fees';
export { achievementsApi } from './achievements';
export { admissionsApi } from './admissions';
export { enrollmentApi } from './enrollment';

// Unified API object with all domain methods attached
export const api = {
  // Transport & Utilities
  getCookie,
  getSessionUser,
  frappeCall,

  // Domain APIs
  ...authApi,
  ...studentsApi,
  ...curriculumApi,
  ...scheduleApi,
  ...attendanceApi,
  ...gradesApi,
  ...feesApi,
  ...achievementsApi,
  ...admissionsApi,
  ...enrollmentApi,
};

export default api;
