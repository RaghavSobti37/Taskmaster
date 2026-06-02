export const userReportToCsv = (report) => {
  const windowLabel = report.window
    ? `${report.window.start} — ${report.window.end}`
    : report.month;

  const lines = [
    `Monthly Report — ${report.user?.name} — ${windowLabel}`,
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

export const aggregatedReportToCsv = (report, title) => {
  const windowLabel = report.window
    ? `${report.window.start} — ${report.window.end}`
    : report.month;

  const lines = [
    `${title} — ${windowLabel}`,
    '',
    'Totals',
    `Present,${report.attendance.present}`,
    `Half Day,${report.attendance.halfDay}`,
    `Leave,${report.attendance.leave}`,
    `Tasks Done,${report.tasks.completed}`,
    `Log Hours,${report.logs.totalHours.toFixed(1)}`,
    '',
    'Members',
    'Name,Present,Half Days,Leave,Tasks Done,Log Hours',
    ...report.members.map((m) =>
      `"${m.name}",${m.attendance.present},${m.attendance.halfDay},${m.attendance.leave},${m.tasks.completed},${m.logs.totalHours.toFixed(1)}`
    ),
    '',
    'Daily Logs',
    'Date,Time,Member,Title,Project,Time Spent,Message',
    ...(report.logs.entries || []).map((e) =>
      `"${e.date}","${e.time}","${e.userName || ''}","${e.title}","${e.project}","${e.timeSpent}","${(e.message || '').replace(/"/g, '""')}"`
    ),
  ];
  return lines.join('\n');
};
