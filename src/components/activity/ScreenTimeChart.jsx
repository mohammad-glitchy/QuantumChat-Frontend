import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'qc_screen_time_v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function formatShortDate(d) {
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return String(d); }
}

// Same local-day key as screenTimeCollector.js — both files must agree on
// what "today" means, or totals silently disappear across the boundary.
function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatScreenTime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  if (mins < 60) {
    return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export default function ScreenTimeChart() {
  const [data, setData] = useState(() => read());

  useEffect(() => {
    const reload = () => setData(read());
    window.addEventListener('storage', reload);
    window.addEventListener('qc:screen-time:updated', reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener('qc:screen-time:updated', reload);
    };
  }, []);

  const daily = useMemo(() => {
    const map = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      map[k] = (map[k] || 0) + Number(v || 0);
    });
    return map;
  }, [data]);

  const todayKey = localDayKey(new Date());
  const total = daily[todayKey] || 0;
  const todaySeconds = Math.round(total / 1000);

  // last 7 calendar days (including today)
  const last7 = useMemo(() => {
    const arr = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(d);
    }
    return arr;
  }, []);

  const valuesSec = useMemo(() => {
    return last7.map((d) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const v = daily[key] || 0;
      return Number(v) / 1000;
    });
  }, [daily, last7]);

  const anyData = Object.keys(data || {}).length > 0;
  const maxVal = Math.max(...valuesSec, 1);

  return (
    <div className="screen-time-chart">
      <div className="screen-time-metric">
        <div className="big-count">{formatScreenTime(todaySeconds)}</div>
      </div>
      <div className="muted screen-time-sub">
        {todaySeconds > 0 ? `${todaySeconds.toLocaleString()}s active today` : 'No activity logged today'}
      </div>

      {anyData ? (
        <svg
          className="screen-time-graph"
          viewBox="0 0 280 124"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="stLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent, #064e3b)" />
              <stop offset="100%" stopColor="var(--accent-hover, #053d2e)" />
            </linearGradient>
            <linearGradient id="stAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent, #064e3b)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent, #064e3b)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {(() => {
            const viewBoxW = 280;
            const viewBoxH = 124;
            const padLeft = 42;
            const padRight = 12;
            const padTop = 14;
            const padBottom = 26;

            const chartW = viewBoxW - padLeft - padRight; // 226
            const chartH = viewBoxH - padTop - padBottom; // 84
            const baselineY = padTop + chartH; // 98

            const n = valuesSec.length;
            const points = valuesSec.map((v, i) => {
              const x = padLeft + (i / (n - 1)) * chartW;
              const norm = v / (maxVal || 1);
              const y = padTop + (1 - norm) * chartH;
              return { x, y, val: v };
            });

            const coords = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const areaPoints = `${padLeft},${baselineY} ${coords} ${padLeft + chartW},${baselineY}`;

            const yTicks = [0, Math.round(maxVal / 2), Math.round(maxVal)];

            return (
              <>
                {/* Horizontal grid lines & Y-axis labels */}
                {yTicks.map((t, idx) => {
                  const norm = t / (maxVal || 1);
                  const yy = padTop + (1 - norm) * chartH;
                  return (
                    <g key={`y${idx}`}>
                      {/* Gridline strictly across chart plotting area */}
                      <line
                        x1={padLeft}
                        y1={yy}
                        x2={padLeft + chartW}
                        y2={yy}
                        stroke="var(--border-subtle, #2a2e37)"
                        strokeWidth={0.8}
                        strokeDasharray={idx > 0 ? '3 3' : undefined}
                        opacity={0.65}
                      />
                      {/* Y-axis label right-aligned to the left of the chart area with guaranteed separation */}
                      <text
                        x={padLeft - 8}
                        y={yy + 3}
                        fontSize="9"
                        fill="var(--text-muted, #808ea3)"
                        textAnchor="end"
                        fontFamily="inherit"
                      >
                        {t}s
                      </text>
                    </g>
                  );
                })}

                {/* Soft gradient area fill */}
                <polygon points={areaPoints} fill="url(#stAreaGrad)" />

                {/* Main line curve */}
                <polyline
                  fill="none"
                  stroke="url(#stLineGrad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={coords}
                />

                {/* Data points */}
                {points.map((p, i) => {
                  const isToday = i === points.length - 1;
                  const d = last7[i];
                  const label = d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '';
                  const formatted = formatScreenTime(Math.round(p.val));

                  return (
                    <g key={`dot${i}`} className="screen-time-dot-group">
                      <title>{`${label}: ${formatted} (${Math.round(p.val)}s)`}</title>
                      {/* Today outer highlight ring */}
                      {isToday && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={5.5}
                          fill="none"
                          stroke="var(--accent, #14b8a6)"
                          strokeWidth={1.2}
                          opacity={0.5}
                        />
                      )}
                      {/* Crisp dot with card-surface border */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isToday ? 3.2 : 2.5}
                        fill={isToday ? 'var(--accent, #14b8a6)' : 'var(--accent-secondary, #06b6d4)'}
                        stroke="var(--bg-surface, #1a1d23)"
                        strokeWidth={1.2}
                      />
                    </g>
                  );
                })}

                {/* X-axis labels (days of the week) */}
                {last7.map((d, i) => {
                  const x = padLeft + (i / (n - 1)) * chartW;
                  const label = d.toLocaleDateString(undefined, { weekday: 'short' });
                  const isToday = i === last7.length - 1;
                  return (
                    <text
                      key={`x${i}`}
                      x={x}
                      y={baselineY + 16}
                      fontSize="9.5"
                      fontWeight={isToday ? '600' : '400'}
                      fill={isToday ? 'var(--accent, #14b8a6)' : 'var(--text-muted, #808ea3)'}
                      textAnchor="middle"
                      fontFamily="inherit"
                    >
                      {label}
                    </text>
                  );
                })}
              </>
            );
          })()}
        </svg>
      ) : (
        <div className="empty-hint">Not enough screen-time data to show a graph.</div>
      )}
    </div>
  );
}
