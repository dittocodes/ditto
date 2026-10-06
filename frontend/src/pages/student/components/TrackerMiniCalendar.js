import React, { useMemo } from 'react';

/** Simple month grid for dashboard / meetings mockup (highlights days with events). */
export default function TrackerMiniCalendar({
  eventDates = [],
  onDayClick,
  selectedDayKey,
  viewYear,
  viewMonth,
}) {
  const now = new Date();
  const year = viewYear ?? now.getFullYear();
  const month = viewMonth ?? now.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventSet = useMemo(() => {
    const pad = (n) => String(n).padStart(2, '0');
    return new Set(
      eventDates.map((raw) => {
        const d = new Date(raw);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }),
    );
  }, [eventDates]);

  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="tracker-mini-cal">
      <div className="tracker-mini-cal-title">{monthLabel}</div>
      <div className="tracker-mini-cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
          <span key={w} className="tracker-mini-cal-dow">{w}</span>
        ))}
        {cells.map((d, i) => (
          <button
            type="button"
            key={i}
            disabled={!d}
            className={`tracker-mini-cal-day${
              d
              && year === now.getFullYear()
              && month === now.getMonth()
              && d === now.getDate()
                ? ' today'
                : ''
            }${
              d && eventSet.has(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
                ? ' event'
                : ''
            }${
              d
              && selectedDayKey
              === `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                ? ' selected'
                : ''
            }`}
            onClick={() => {
              if (!d) return;
              onDayClick?.(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            }}
          >
            {d || ''}
          </button>
        ))}
      </div>
    </div>
  );
}
