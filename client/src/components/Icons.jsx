export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.5 3.5a8.5 8.5 0 1 0 4 12.2A7.2 7.2 0 0 1 16.5 3.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 14s4.5-4.1 4.5-7.2A4.5 4.5 0 0 0 3.5 6.8C3.5 9.9 8 14 8 14z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="6.7" r="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5.2V8l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path d="M7 4.5V3.2M17 4.5V3.2M5 8.5h14" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4" y="5.2" width="16" height="15" rx="3" fill="none" stroke="white" strokeWidth="1.8" />
        <path d="M8 13.2l2.3 2.3 5.2-5.4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function stroke(children) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export function CategoryIcon({ name }) {
  if (name === 'Technology') {
    return stroke(<><rect x="6" y="7" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M9 18h6M12 15v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>);
  }
  if (name === 'Business') {
    return stroke(<path d="M4 18V8.5L12 4l8 4.5V18M4 18h16M9 18v-4h6v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />);
  }
  if (name === 'Design') {
    return stroke(<path d="M12 4l2.2 5.2L20 11l-5.8 1.8L12 18l-2.2-5.2L4 11l5.8-1.8L12 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />);
  }
  if (name === 'Community') {
    return stroke(<><circle cx="8" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="16" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4.5 17.5c.6-2.2 2.2-3.3 3.5-3.3s2.9 1.1 3.5 3.3M12.5 17.5c.6-2.2 2.2-3.3 3.5-3.3s2.9 1.1 3.5 3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>);
  }
  if (name === 'Arts') {
    return stroke(<path d="M12 4a7 7 0 1 0 0 14h1.2a2 2 0 0 0 0-4H12a3 3 0 1 1 0-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />);
  }
  return stroke(<path d="M5 7.5h14M7 4.5v3M17 4.5v3M6 10.5h12v7.5H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />);
}

export function StatIcon({ name }) {
  const paths = {
    events: <path d="M7 4.5V3.2M17 4.5V3.2M5 8.5h14M6 5.5h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
    people: <><circle cx="12" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M6.5 18.5c.8-2.8 2.8-4.2 5.5-4.2s4.7 1.4 5.5 4.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
    cities: <path d="M4 19V9l5-3 5 3v10M14 19V7l5-2v14M4 19h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
    seats: <path d="M6 11h12v6H6zM8 11V8a4 4 0 0 1 8 0v3M6 17v2M18 17v2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
  };
  return stroke(paths[name]);
}

export function NavIcon({ name }) {
  const paths = {
    overview: <><rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="4" width="7" height="4" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="10" width="7" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" /><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" /></>,
    events: <path d="M7 4.5V3.2M17 4.5V3.2M5 8.5h14M6 5.5h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />,
    attendees: <><circle cx="9" cy="8" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="16" cy="9" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M4.8 18c.6-2.5 2.3-3.8 4.2-3.8s3.6 1.3 4.2 3.8M14 14.4c1.2-.3 2.4.1 3.2 1.1.7.9 1 2 1.1 2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
    settings: <><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 4.2v1.8M12 18v1.8M4.2 12h1.8M18 12h1.8M6.4 6.4l1.3 1.3M16.3 16.3l1.3 1.3M17.6 6.4l-1.3 1.3M7.7 16.3l-1.3 1.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>,
  };
  return stroke(paths[name]);
}
