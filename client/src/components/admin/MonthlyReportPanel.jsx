import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { FileText, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, Button, DataLoading } from '../ui';
import DailyLogsTable from './DailyLogsTable';
import DailyLogHoursChart from './reports/DailyLogHoursChart';
import ReportProjectsTable from './reports/ReportProjectsTable';
import ReportCalendarTable from './reports/ReportCalendarTable';

const PIE_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#94a3b8'];

const formatAttendanceTooltip = (value) => {
  if (value === 1) return ['Present', 'Attendance'];
  if (value === 0.5) return ['Half Day', 'Attendance'];
  return ['Absent', 'Attendance'];
};

const formatTaskPieTooltip = (value, name) => [`${value} tasks`, name];

const fetchMonthlyReport = async (userId, month) => {
  const { data } = await axios.get(`/api/users/${userId}/monthly-report`, { params: { month } });
  return data;
};

const toCsv = (report) => {
  const lines = [
    `Monthly Report — ${report.user?.name} — ${report.month}`,
    '',
    'Attendance Summary',
    `Present,${report.attendance.present}`,
    `Half Day,${report.attendance.halfDay}`,
    `Leave,${report.attendance.leave}`,
    '',
    'Tasks Summary',
    `Total,${report.tasks.total}`,
    `Completed,${report.tasks.completed}`,
    `In Progress,${report.tasks.inProgress}`,
    `Overdue,${report.tasks.overdue}`,
    '',
    'Projects',
    'Name,Status,Workspace,Progress',
    ...report.projects.items.map((p) => `"${p.name}",${p.status},${p.workspace || ''},${p.progress}`),
    '',
    'Daily Logs',
    'Date,Time,Title,Project,Time Spent,Message',
    ...(report.logs.entries || []).map((e) =>
      `"${e.date}","${e.time}","${e.title}","${e.project}","${e.timeSpent}","${(e.message || '').replace(/"/g, '""')}"`
    ),
  ];
  return lines.join('\n');
};

const MonthlyReportPanel = ({ userId, userName }) => {
  const [month, setMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'));
  const printRef = useRef(null);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['monthlyReport', userId, month],
    queryFn: () => fetchMonthlyReport(userId, month),
    enabled: !!userId,
  });

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  const handleDownloadCsv = () => {
    if (!report) return;
    const blob = new Blob([toCsv(report)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${userName || userId}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Report ${month}</title></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const taskPie = report
    ? [
        { name: 'Done', value: report.tasks.completed },
        { name: 'In Progress', value: report.tasks.inProgress },
        { name: 'Todo', value: report.tasks.todo },
        { name: 'In Review', value: report.tasks.inReview },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <FileText size={14} /> Monthly Report
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="xs" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Button>
          <span className="text-sm font-bold min-w-[100px] text-center">{month}</span>
          <Button variant="ghost" size="xs" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadCsv} disabled={!report}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!report}>
            <Printer size={14} className="mr-1" /> Print / PDF
          </Button>
        </div>
      </div>

      {isLoading && <DataLoading message="Generating report..." />}
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-500">
            {error.response?.data?.error || error.message || 'Failed to load report.'}
          </p>
        </div>
      )}

      {report && (
        <div ref={printRef} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-3"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Present</p><p className="text-2xl font-black">{report.attendance.present}</p></Card>
            <Card className="p-3"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Half Days</p><p className="text-2xl font-black">{report.attendance.halfDay}</p></Card>
            <Card className="p-3"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Tasks Done</p><p className="text-2xl font-black">{report.tasks.completed}</p></Card>
            <Card className="p-3"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Log Hours</p><p className="text-2xl font-black">{report.logs.totalHours.toFixed(1)}</p></Card>
            <Card className="p-3"><p className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Daily Logs</p><p className="text-2xl font-black">{report.logs.totalEntries ?? report.logs.entries?.length ?? 0}</p></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Attendance by Day</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={report.attendance.chart.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
                  <Tooltip formatter={formatAttendanceTooltip} />
                  <Bar dataKey="value" name="Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Task Status</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={taskPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {taskPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={formatTaskPieTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <DailyLogHoursChart
              byDay={report.logs.byDay}
              totalEntries={report.logs.totalEntries ?? report.logs.entries?.length ?? 0}
            />
          </div>

          <ReportProjectsTable items={report.projects.items} />

          <ReportCalendarTable events={report.calendar.events} />

          <DailyLogsTable entries={report.logs.entries || []} />
        </div>
      )}
    </section>
  );
};

export default MonthlyReportPanel;
