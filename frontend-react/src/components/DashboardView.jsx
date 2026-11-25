import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatsOverview from './StatsOverview';
import TodayScheduleWidget from './TodayScheduleWidget';
import RecentGradesWidget from './RecentGradesWidget';
import AnnouncementsWidget from './AnnouncementsWidget';

export default function DashboardView() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full min-w-0 overflow-hidden">
      {/* 4 Responsive KPI Metric Cards */}
      <StatsOverview onNavigate={(path) => navigate(path)} />

      {/* Announcements Banner */}
      <AnnouncementsWidget />

      {/* 2-Column Responsive Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <TodayScheduleWidget />
        <RecentGradesWidget />
      </div>
    </div>
  );
}
