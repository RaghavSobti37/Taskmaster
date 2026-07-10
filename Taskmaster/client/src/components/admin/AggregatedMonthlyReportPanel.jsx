import React, { useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, DataLoading } from '../ui';
import { aggregatedReportToCsv } from '../../utils/monthlyReportCsv';
import { reportRangeQueryKey } from '../../utils/monthlyReportRange';
import { useMonthlyReportRangeState } from '../../hooks/useMonthlyReportRangeState';
import ReportRangeControls from './reports/ReportRangeControls';
import MonthlyReportBody from './reports/MonthlyReportBody';

const fetchAggregatedReport = async (url, params) => {
  const { data } = await axios.get(url, {
    params: {
      month: params.month,
      timeframe: params.timeframe,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  });
  return data;
};

const AggregatedReportContent = ({ report, title, filenameBase, exportRangeSuffix }) => {
  const printRef = useRef(null);

  const handleDownloadCsv = () => {
    if (!report) return;
    const blob = new Blob([aggregatedReportToCsv(report, title)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}-${report.month}-${exportRangeSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${title} ${report.month}</title></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={handleDownloadCsv} disabled={!report}>
          <Download size={14} className="mr-1" /> CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!report}>
          <Printer size={14} className="mr-1" /> Print / PDF
        </Button>
      </div>

      <MonthlyReportBody
        report={report}
        printRef={printRef}
        showMember
        showProjects={false}
        showCalendar={false}
      />
    </div>
  );
};

const AggregatedReportShell = ({
  title,
  extraTitle,
  report,
  isLoading,
  error,
  refetch,
  rangeControls,
  subtitle,
  children,
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <FileText size={14} /> {title}
          {extraTitle}
        </h3>
        {subtitle && (
          <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rangeControls}
      </div>
    </div>
    {isLoading && <DataLoading />}
    {error && (
      <div className="space-y-2">
        <p className="text-sm text-red-500">
          {error.response?.data?.error || error.message || 'Failed to load report.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    )}
    {children}
  </div>
);

export const DepartmentMonthlyReportPanel = ({ departmentId, departmentName, isOpen }) => {
  const {
    month,
    shiftMonth,
    rangeMode,
    setRangeMode,
    timeframe,
    setTimeframe,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    queryParams,
    queryEnabled,
    rangeSubtitle,
    exportRangeSuffix,
  } = useMonthlyReportRangeState();

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: reportRangeQueryKey(
      ['departmentMonthlyReport', departmentId],
      month,
      rangeMode,
      timeframe,
      customStart,
      customEnd
    ),
    queryFn: () => fetchAggregatedReport(`/api/departments/${departmentId}/monthly-report`, queryParams),
    enabled: isOpen && !!departmentId && queryEnabled,
  });

  if (!isOpen) return null;

  const rangeControls = (
    <>
      <ReportRangeControls
        month={month}
        rangeMode={rangeMode}
        onRangeModeChange={setRangeMode}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
      <Button variant="ghost" size="xs" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Button>
      <span className="text-sm font-bold min-w-[100px] text-center">{month}</span>
      <Button variant="ghost" size="xs" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Button>
    </>
  );

  return (
    <AggregatedReportShell
      title={`${departmentName} — Monthly Report`}
      report={report}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      rangeControls={rangeControls}
      subtitle={rangeSubtitle(report)}
    >
      {report && (
        <AggregatedReportContent
          report={report}
          title={`${departmentName} Report`}
          filenameBase={`dept-${departmentName}`}
          exportRangeSuffix={exportRangeSuffix}
        />
      )}
    </AggregatedReportShell>
  );
};

export const TeamMonthlyReportPanel = ({ isOpen }) => {
  const {
    month,
    shiftMonth,
    rangeMode,
    setRangeMode,
    timeframe,
    setTimeframe,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    queryParams,
    queryEnabled,
    rangeSubtitle,
    exportRangeSuffix,
  } = useMonthlyReportRangeState();

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: reportRangeQueryKey(['teamMonthlyReport'], month, rangeMode, timeframe, customStart, customEnd),
    queryFn: () => fetchAggregatedReport('/api/departments/team/monthly-report', queryParams),
    enabled: isOpen && queryEnabled,
  });

  if (!isOpen) return null;

  const rangeControls = (
    <>
      <ReportRangeControls
        month={month}
        rangeMode={rangeMode}
        onRangeModeChange={setRangeMode}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
      <Button variant="ghost" size="xs" onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></Button>
      <span className="text-sm font-bold min-w-[100px] text-center">{month}</span>
      <Button variant="ghost" size="xs" onClick={() => shiftMonth(1)}><ChevronRight size={14} /></Button>
    </>
  );

  const extraTitle = report?.department?.memberCount != null ? (
    <span className="text-[10px] font-normal normal-case text-[var(--color-text-muted)]">
      ({report.department.memberCount} members)
    </span>
  ) : null;

  return (
    <AggregatedReportShell
      title="Team Monthly Report"
      extraTitle={extraTitle}
      report={report}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      rangeControls={rangeControls}
      subtitle={rangeSubtitle(report)}
    >
      {report && (
        <AggregatedReportContent
          report={report}
          title="Team Report"
          filenameBase="team-report"
          exportRangeSuffix={exportRangeSuffix}
        />
      )}
    </AggregatedReportShell>
  );
};

