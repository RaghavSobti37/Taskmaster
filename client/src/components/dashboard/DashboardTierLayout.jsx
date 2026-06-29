import React, { useMemo, useState, useCallback, useEffect } from 'react';
import DashboardCollapsibleSection from './DashboardCollapsibleSection';
import MyTasksDashboardCard from './MyTasksDashboardCard';
import {
  DASHBOARD_SECTIONS,
  groupElementsBySection,
  resolveSectionState,
  prepareDailyActionRenderList,
  sortSectionWidgets,
  getWidgetGridStyle,
  getSectionGridStyle,
  getWidgetMinHeightClass,
} from '../../lib/dashboardSections';

const DAILY_COMPACT = new Set(['mark-attendance', 'schedule', 'review-queue']);

export default function DashboardTierLayout({
  elements,
  permissionPreset,
  sectionState: presetSectionState,
  renderWidget,
  workspaces = [],
  tasks = [],
  projects = [],
  tasksLoading,
  onComplete,
  completingTaskId,
}) {
  const groups = useMemo(
    () => groupElementsBySection(elements, permissionPreset),
    [elements, permissionPreset]
  );

  const [sectionCollapsed, setSectionCollapsed] = useState(() =>
    resolveSectionState(presetSectionState)
  );

  useEffect(() => {
    setSectionCollapsed(resolveSectionState(presetSectionState));
  }, [presetSectionState]);

  const setSection = useCallback((sectionId, collapsed) => {
    setSectionCollapsed((prev) => ({ ...prev, [sectionId]: collapsed }));
  }, []);

  const dailyWidgets = useMemo(
    () => prepareDailyActionRenderList(groups['daily-actions'] || []),
    [groups]
  );

  const teamWidgets = useMemo(
    () => sortSectionWidgets(groups['team-context'] || []),
    [groups]
  );

  const renderLayoutWidget = (el, sectionId, widgetProps = {}) => {
    if (el.componentId === 'my-tasks') {
      return (
        <MyTasksDashboardCard
          tasks={tasks}
          projects={projects}
          workspaces={workspaces}
          loading={tasksLoading}
          onComplete={onComplete}
          completingTaskId={completingTaskId}
        />
      );
    }

    const compact = widgetProps.compact ?? DAILY_COMPACT.has(el.componentId);
    return renderWidget(el.componentId, { ...widgetProps, compact });
  };

  const renderSectionGrid = (sectionId, widgets, widgetProps = {}) => {
    if (!widgets.length) return null;
    const minH = getWidgetMinHeightClass(sectionId);

    return (
      <div
        className="grid w-full gap-3 items-stretch"
        style={getSectionGridStyle(sectionId)}
      >
        {widgets.map((el) => (
          <div
            key={el.componentId}
            className={`${minH} h-full`}
            style={getWidgetGridStyle(el, sectionId)}
          >
            {renderLayoutWidget(el, sectionId, {
              ...widgetProps,
              maxItems: el.componentId === 'leaderboard' ? 5 : widgetProps.maxItems,
            })}
          </div>
        ))}
      </div>
    );
  };

  const teamSection = DASHBOARD_SECTIONS.find((s) => s.id === 'team-context');

  return (
    <div className="space-y-5">
      {(groups['status-strip']?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="Status strip"
          subtitle="System health, last backup, and alerts"
          defaultCollapsed={sectionCollapsed['status-strip']}
          collapsed={sectionCollapsed['status-strip']}
          onCollapsedChange={(v) => setSection('status-strip', v)}
          strip
        >
          {renderSectionGrid('status-strip', sortSectionWidgets(groups['status-strip']), {
            compact: true,
            maxItems: 3,
          })}
        </DashboardCollapsibleSection>
      )}

      {dailyWidgets.length > 0 && (
        <div>
          {renderSectionGrid('daily-actions', dailyWidgets)}
        </div>
      )}

      {teamWidgets.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-0.5">
            {teamSection?.sectionLabel || 'TEAM AND WORK CONTEXT'}
          </p>
          {renderSectionGrid('team-context', teamWidgets, {
            compact: true,
            maxItems: 4,
          })}
        </div>
      )}

      {(groups.analytics?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="Analytics & reporting"
          sectionLabel="ANALYTICS AND REPORTING — secondary tab or lower fold"
          subtitle="CRM, campaigns, department stats, and more"
          defaultCollapsed={sectionCollapsed.analytics}
          collapsed={sectionCollapsed.analytics}
          onCollapsedChange={(v) => setSection('analytics', v)}
        >
          {renderSectionGrid('analytics', sortSectionWidgets(groups.analytics), {
            compact: true,
            maxItems: 4,
          })}
        </DashboardCollapsibleSection>
      )}

      {(groups.more?.length ?? 0) > 0 && (
        <DashboardCollapsibleSection
          title="More widgets"
          subtitle="Notes, pin board, missions, leave requests, reimbursements"
          defaultCollapsed={sectionCollapsed.more}
          collapsed={sectionCollapsed.more}
          onCollapsedChange={(v) => setSection('more', v)}
        >
          {renderSectionGrid('more', sortSectionWidgets(groups.more), { compact: true })}
        </DashboardCollapsibleSection>
      )}
    </div>
  );
}
