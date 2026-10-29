import { formatChartDay } from '../format.js';

export function LineChart({ points }) {
  const width = 560;
  const height = 180;
  const max = Math.max(1, ...points.map((point) => point.count));
  const step = points.length > 1 ? (width - 24) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = 12 + index * step;
    const y = height - 28 - (point.count / max) * (height - 48);
    return { x, y, ...point };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `12,${height - 28} ${line} ${width - 12},${height - 28}`;
  const summary = points.map((point) => `${formatChartDay(point.day)} ${point.count}`).join(', ');
  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Registrations over 14 days: ${summary}`}>
      <polygon className="chart-area" points={area} />
      <polyline className="chart-line" points={line} />
      {coords.map((point) => <circle key={point.day} className="chart-dot" cx={point.x} cy={point.y} r="3" />)}
      {coords.filter((_, index) => index === 0 || index === coords.length - 1 || index === Math.floor((coords.length - 1) / 2)).map((point) => (
        <text key={`${point.day}-label`} className="chart-label" x={point.x} y={height - 8} textAnchor="middle">{formatChartDay(point.day)}</text>
      ))}
    </svg>
  );
}

export function Donut({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  const colors = ['#3b63ff', '#7a5cff', '#2f9bff', '#22b8cf', '#8b7cff', '#5b8def'];
  const slices = rows.reduce((state, row, index) => {
    const start = state.cursor / total;
    const cursor = state.cursor + row.value;
    return {
      cursor,
      slices: [...state.slices, { ...row, start, end: cursor / total, color: colors[index % colors.length] }],
    };
  }, { cursor: 0, slices: [] }).slices;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" role="img" aria-label={rows.map((row) => `${row.label} ${row.value}`).join(', ')}>
        <circle className="donut-track" cx="60" cy="60" r="42" fill="none" strokeWidth="14" />
        {slices.map((slice) => (
          <circle
            key={slice.label}
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke={slice.color}
            strokeWidth="14"
            strokeDasharray={`${(slice.end - slice.start) * 264} 264`}
            strokeDashoffset={-slice.start * 264}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text className="donut-center" x="60" y="64" textAnchor="middle">{total}</text>
      </svg>
      <ul className="perk-list">
        {slices.map((slice) => (
          <li key={slice.label}><span style={{ color: slice.color }}>{slice.label}</span> {slice.value}</li>
        ))}
      </ul>
    </div>
  );
}

export function HorizontalBars({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div>
      {rows.map((row) => (
        <div key={row.label} className="hbar">
          <span>{row.label}</span>
          <div className="hbar-track" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
