import React from 'react';
import DailyLogHoursChart from './DailyLogHoursChart';
import ReportProjectsTable from './ReportProjectsTable';
import ReportCalendarTable from './ReportCalendarTable';
import DailyLogsTable from '../DailyLogsTable';
import ReportMembersTable from './ReportMembersTable';
import { BklitBreakdownBars, BklitCategoryBarChart } from '../../charts/bklitInsightsCharts';

const MonthlyReportBody = ({
  report,
  printRef,
  showMember = false,
  showProjects = true,
  showCalendar = true,
}) => {
  const taskPie = [
    { name: 'Done', value: report.tasks.completed },
    { name: 'In Progress', value: report.tasks.inProgress },
    { name: 'Todo', value: report.tasks.todo },
    { name: 'In Review', value: report.tasks.inReview },
  ].filter((d) => d.value > 0);

  const chartDays = report.window?.days || 30;
  const attendanceChart = report.attendance.chart.slice(-chartDays).map((row) => ({
    ...row,
    label: row.date?.slice(5) || row.date,
  }));

  return (
    <div ref={printRef} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] divide-x divide-y divide-[var(--color-bg-border)]">
        <div className="p-3">
          <p className="tm-widget-label text-[var(--color-text-muted)]">Present</p>
          <p className="text-2xl font-black tabular-nums tm-data-primary">{report.attendance.present}</p>
        </div>
        <div className="p-3">
          <p className="tm-widget-label text-[var(--color-text-muted)]">Half Days</p>
          <p className="text-2xl font-black tabular-nums tm-data-primary">{report.attendance.halfDay}</p>
        </div>
        <div className="p-3">
          <p className="tm-widget-label text-[var(--color-text-muted)]">Tasks Done</p>
          <p className="text-2xl font-black tabular-nums tm-data-primary">{report.tasks.completed}</p>
        </div>
        <div className="p-3">
          <p className="tm-widget-label text-[var(--color-text-muted)]">Log Hours</p>
          <p className="text-2xl font-black tabular-nums tm-data-primary">{report.logs.totalHours.toFixed(1)}</p>
        </div>
        <div className="p-3">
          <p className="tm-widget-label text-[var(--color-text-muted)]">Daily Logs</p>
          <p className="text-2xl font-black tabular-nums tm-data-primary">{report.logs.totalEntries ?? report.logs.entries?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="py-4 border-t border-[var(--color-bg-border)] lg:border-t-0 lg:border-r lg:pr-4">
          <p className="tm-widget-label text-[var(--color-text-muted)] mb-3">
            Attendance by Day
          </p>
          <BklitCategoryBarChart
            emptyLabel="No attendance in range"
            fill="#10b981"
            height={200}
            labelKey="label"
            series={attendanceChart}
            valueKey="value"
          />
        </section>

        <section className="py-4 border-t border-[var(--color-bg-border)] lg:border-t-0">
          <p className="tm-widget-label text-[var(--color-text-muted)] mb-3">
            Task Status
          </p>
          <BklitBreakdownBars
            emptyLabel="No tasks in range"
            height={200}
            items={taskPie}
          />
        </section>

        <DailyLogHoursChart
          byDay={report.logs.byDay}
          totalEntries={report.logs.totalEntries ?? report.logs.entries?.length ?? 0}
        />
      </div>

      {report.members?.length > 0 && <ReportMembersTable members={report.members} />}
      {showMember && report.member && (
        <ReportMembersTable members={[report.member]} single />
      )}
      {showProjects && <ReportProjectsTable projects={report.projects} />}
      {showCalendar && <ReportCalendarTable events={report.calendar} />}
      <DailyLogsTable entries={report.logs.entries} />
    </div>
  );
};

export default MonthlyReportBody;
