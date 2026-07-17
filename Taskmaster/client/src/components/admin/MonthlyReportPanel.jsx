import React, { useRef } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, DataLoading, QueryErrorBanner, getQueryErrorMessage } from '../ui';
import { userReportToCsv } from '../../utils/monthlyReportCsv';
import { reportRangeQueryKey } from '../../utils/monthlyReportRange';
import { useMonthlyReportRangeState } from '../../hooks/useMonthlyReportRangeState';
import ReportRangeControls from './reports/ReportRangeControls';
import MonthlyReportBody from './reports/MonthlyReportBody';

const fetchMonthlyReport = async (params) => {
  const { data } = await axios.get(`/api/users/${params.userId}/monthly-report`, {
    params: {
      month: params.month,
      timeframe: params.timeframe,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  });
  return data;
};

const MonthlyReportPanel = ({ userId, userName }) => {
  const printRef = useRef(null);
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
      ['monthlyReport', userId],
      month,
      rangeMode,
      timeframe,
      customStart,
      customEnd
    ),
    queryFn: () => fetchMonthlyReport({ userId, ...queryParams }),
    enabled: !!userId && queryEnabled,
  });

  const handleDownloadCsv = () => {
    if (!report) return;
    const blob = new Blob([userReportToCsv(report)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${userName || userId}-${month}-${exportRangeSuffix}.csv`;
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

  const subtitle = rangeSubtitle(report);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <FileText size={14} /> Monthly Report
          </h3>
          {subtitle && (
            <p className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="secondary" size="sm" onClick={handleDownloadCsv} disabled={!report}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!report}>
            <Printer size={14} className="mr-1" /> Print / PDF
          </Button>
        </div>
      </div>

      {isLoading && <DataLoading />}
      {error && (
        <QueryErrorBanner
          message={getQueryErrorMessage(error, 'Failed to load report.')}
          onRetry={() => refetch()}
        />
      )}

      {report && (
        <MonthlyReportBody report={report} printRef={printRef} />
      )}
    </section>
  );
};

export default MonthlyReportPanel;
