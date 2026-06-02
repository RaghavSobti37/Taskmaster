import React from 'react';
import ScheduleTaskPill from './ScheduleTaskPill';

const ScheduleMemberTaskGrid = ({ lanes, slotCount, cellPad, compact, workspaces, projects, onTaskClick }) => {
  const laneGap = compact ? 'gap-0.5' : 'gap-1';
  const laneCount = Math.max(lanes.length, 1);

  return (
    <div className="min-w-0">
      <div
        className={`relative grid w-full ${laneGap}`}
        style={{
          gridTemplateColumns: `repeat(${slotCount}, minmax(90px, 1fr))`,
          gridTemplateRows: `repeat(${laneCount}, auto)`,
          minHeight: lanes.length === 0 ? '1.25rem' : undefined,
        }}
      >
        {[...Array(Math.max(slotCount - 1, 0))].map((_, index) => (
          <div
            key={`divider-${index}`}
            className="pointer-events-none absolute top-0 bottom-0 border-l border-[var(--color-bg-border)]/40"
            style={{ left: `${((index + 1) / slotCount) * 100}%` }}
            aria-hidden
          />
        ))}
        {lanes.flatMap((lane, laneIdx) =>
          lane.map(({ task, startCol, span }) => (
            <div
              key={task._id}
              className={`${cellPad} min-w-0 overflow-hidden`}
              style={{
                gridColumn: `${startCol + 1} / span ${span}`,
                gridRow: laneIdx + 1,
              }}
            >
              <ScheduleTaskPill
                task={task}
                workspaces={workspaces}
                projects={projects}
                compact={compact}
                onTaskClick={onTaskClick}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScheduleMemberTaskGrid;
