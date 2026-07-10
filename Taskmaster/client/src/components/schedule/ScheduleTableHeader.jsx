import React from 'react';

const ScheduleTableHeader = ({ dayColumns, slotHeaders, memberPad }) => (
  <thead>
    <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
      <th
        className={`text-left ${memberPad} text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] w-36`}
      >
        Member
      </th>
      {dayColumns.map((col) => (
        <th
          key={col.key}
          colSpan={2}
          className="text-center px-1.5 py-1.5 border-l border-[var(--color-bg-border)]"
        >
          <div className="text-[9px] font-black uppercase tracking-widest">{col.label}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] font-normal normal-case tracking-normal">
            {col.sub}
          </div>
        </th>
      ))}
    </tr>
    <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50">
      <th />
      {slotHeaders.map((slot, index) => (
        <th
          key={slot.key}
          className={`text-center px-1 py-1 text-[8px] font-bold uppercase text-[var(--color-text-muted)] ${
            index % 2 === 0 ? 'border-l border-[var(--color-bg-border)]' : ''
          }`}
        >
          {slot.label}
        </th>
      ))}
    </tr>
  </thead>
);

export default ScheduleTableHeader;
