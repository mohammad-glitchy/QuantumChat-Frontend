import { useEffect, useMemo, useRef, useState } from 'react';

function toLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDayOptions(count = 60) {
  const days = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        days.push({ value: toLocalDateKey(d), label });
  }
  return days;
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function MiniCalendar({ value, onChange }) {
  const selected = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstWeekday = startOfMonth(viewMonth).getDay();
  const totalDays = daysInMonth(viewMonth);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

   function keyFor(d) {
    return toLocalDateKey(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }

  return (
    <div className="capsule-calendar">
      <div className="capsule-calendar-header">
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
        <span>{viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="capsule-calendar-weekdays">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="capsule-calendar-grid">
        {cells.map((d, i) => {
          if (d == null) return <span key={`blank-${i}`} />;
          const key = keyFor(d);
          const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
          cellDate.setHours(0, 0, 0, 0);
          const disabled = cellDate.getTime() < today.getTime();
          return (
            <button
              type="button"
              key={key}
              disabled={disabled}
              className={`capsule-calendar-day ${key === value ? 'is-selected' : ''}`}
              onClick={() => onChange(key)}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TimeCapsuleModal({ open, onCancel, onConfirm }) {
  const dayOptions = useMemo(() => buildDayOptions(60), []);
  const [day, setDay] = useState(dayOptions[1]?.value);
 const [time, setTime] = useState('09:00');
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setDay(dayOptions[1]?.value || dayOptions[0]?.value);
    setTime('09:00');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const chosen = new Date(`${day}T${time}:00`);
  const isPast = chosen.getTime() <= Date.now();

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog capsule-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capsule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="capsule-dialog-close" onClick={onCancel} title="Cancel">
          ×
        </button>
        <h2 id="capsule-title" className="confirm-dialog-title">⏳ Time capsule</h2>
        <p className="confirm-dialog-message">Pick when this message should unlock.</p>

        <div className="capsule-field-row">
          <label>
            <span>Day</span>
            <MiniCalendar value={day} onChange={setDay} />
          </label>
        </div>

        <div className="capsule-field-row">
  <label>
    <span>Time</span>
    <input
      type="time"
      step="60"
      value={time}
      onChange={(e) => setTime(e.target.value)}
    />
  </label>
</div>

        {isPast && <p className="clear-chat-starred-warning">Pick a time in the future.</p>}

        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="confirm-btn danger"
            onClick={() => !isPast && onConfirm?.(chosen.toISOString())}
            disabled={isPast}
          >
            Set capsule
          </button>
        </div>
      </div>
    </div>
  );
}