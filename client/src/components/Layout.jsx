import { NavLink, Outlet } from 'react-router-dom';
import { BrandMark, MoonIcon, SunIcon } from './Icons.jsx';
import { useTheme } from '../theme.jsx';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function NavIcon({ name }) {
  const paths = {
    home: 'M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5z',
    events: 'M7 3.5V2.2M17 3.5V2.2M4.5 8h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6.5A1.5 1.5 0 0 1 6 5z',
    search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM16.5 16.5 21 21',
    saved: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z',
    tickets: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11a2 2 0 0 0 0 2v2.5A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5V13a2 2 0 0 0 0-2V8.5z',
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const BOTTOM = [
  ['/', 'Home', 'home', true],
  ['/events', 'Events', 'events', false],
  ['/events?focus=search', 'Search', 'search', false],
  ['/saved', 'Saved', 'saved', false],
  ['/tickets', 'Tickets', 'tickets', false],
];

export function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" end>
            <BrandMark />
            Eventra
          </NavLink>
          <nav id="site-nav" className="site-nav" aria-label="Primary">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <div className="nav-actions">
            <ThemeToggle />
            <NavLink className="btn btn-ghost btn-small" to="/admin/login">Log in</NavLink>
            <NavLink className="btn btn-primary btn-small" to="/events">Get Started</NavLink>
          </div>
        </div>
      </header>
      <main id="content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <p className="brand"><BrandMark /> Eventra</p>
            <p>Discover gatherings, claim a seat, and keep a ticket that matches the registration saved in the database.</p>
            <div className="social-row">
              <a href="mailto:organizer@eventra.demo" aria-label="Email Eventra">Email</a>
              <a href="https://www.linkedin.com/sharing/share-offsite/?url=http%3A%2F%2Flocalhost%3A5173" target="_blank" rel="noreferrer">LinkedIn</a>
              <a href="https://wa.me/?text=Eventra%20http%3A%2F%2Flocalhost%3A5173" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
          <div>
            <h2>Explore</h2>
            <NavLink to="/">Home</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </div>
          <div>
            <h2>Account</h2>
            <NavLink to="/admin/login">Administrator login</NavLink>
            <NavLink to="/tickets">My tickets</NavLink>
            <NavLink to="/saved">Saved events</NavLink>
          </div>
          <div>
            <h2>Platform</h2>
            <p>One administrator publishes every event. Visitors register without creating an account. Saved events stay on this device.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Eventra · fictional demo events</p>
          <p>Photographs stored with the app. Unsplash license.</p>
        </div>
      </footer>
      <nav className="bottom-nav" aria-label="Mobile">
        {BOTTOM.map(([to, label, icon, end]) => (
          <NavLink key={label} to={to} end={end}>
            <NavIcon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
