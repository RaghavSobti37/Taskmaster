import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import DailyLogHoursChart from './DailyLogHoursChart';
import ReportProjectsTable from './ReportProjectsTable';
import ReportCalendarTable from './ReportCalendarTable';
import DailyLogsTable from '../DailyLogsTable';
import ReportMembersTable from './ReportMembersTable';

const PIE_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#94a3b8'];

const formatAttendanceTooltip = (value) => {
  if (value === 1) return ['Present', 'Attendance'];
  if (value === 0.5) return ['Half Day', 'Attendance'];
  return ['Absent', 'Attendance'];
};

const formatTaskPieTooltip = (value, name) => [`${value} tasks`, name];

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
  const attendanceChart = report.attendance.chart.slice(-chartDays);

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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
              <Tooltip formatter={formatAttendanceTooltip} />
              <Bar dataKey="value" name="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="py-4 border-t border-[var(--color-bg-border)] lg:border-t-0">
          <p className="tm-widget-label text-[var(--color-text-muted)] mb-3">
            Task Status
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={taskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {taskPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={formatTaskPieTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <DailyLogHoursChart
          byDay={report.logs.byDay}
          totalEntries={report.logs.totalEntries ?? report.logs.entries?.length ?? 0}
        />
      </div>

      {report.members?.length > 0 && <ReportMembersTable members={report.members} />}

      {showProjects && report.projects?.items?.length > 0 && (
        <ReportProjectsTable items={report.projects.items} />
      )}

      {showCalendar && report.calendar?.events?.length > 0 && (
        <ReportCalendarTable events={report.calendar.events} />
      )}

      <DailyLogsTable entries={report.logs.entries || []} showMember={showMember} />
    </div>
  );
};

export default MonthlyReportBody;
