import React from 'react';
import DailyLogHoursChart from './DailyLogHoursChart';
import ReportProjectsTable from './ReportProjectsTable';
import ReportCalendarTable from './ReportCalendarTable';
import DailyLogsTable from '../DailyLogsTable';
import ReportMembersTable from './ReportMembersTable';
import { BklitBreakdownBars, BklitCategoryBarChart } from '../../charts/bklitInsightsCharts';

const MetricTile = ({ label, value, tone = 'tm-data-primary' }) => (
  <div className="min-w-0 p-3 sm:p-4">
    <p className="tm-widget-label text-[var(--color-text-muted)] truncate">{label}</p>
    <p className={`text-xl sm:text-2xl font-black tabular-nums break-words ${tone}`}>{value}</p>
  </div>
);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] overflow-hidden divide-x divide-y divide-[var(--color-bg-border)]">
        <MetricTile label="Present" value={report.attendance.present} />
        <MetricTile label="Half Days" value={report.attendance.halfDay} />
        <MetricTile label="Tasks Done" value={report.tasks.completed} />
        <MetricTile label="Log Hours" value={report.logs.totalHours.toFixed(1)} />
        <MetricTile label="Daily Logs" value={report.logs.totalEntries ?? report.logs.entries?.length ?? 0} />
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
      {showProjects && <ReportProjectsTable items={report.projects?.items || []} />}
      {showCalendar && <ReportCalendarTable events={report.calendar?.events || []} />}
      <DailyLogsTable entries={report.logs.entries} />
    </div>
  );
};

export default MonthlyReportBody;
