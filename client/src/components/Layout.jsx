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
    about: 'M12 12.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM5.2 19.5c1.2-2.8 3.5-4.2 6.8-4.2s5.6 1.4 6.8 4.2',
    contact: 'M5 6.5h14v11H5zM5 7.5l7 5 7-5',
    tickets: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11a2 2 0 0 0 0 2v2.5A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5V13a2 2 0 0 0 0-2V8.5z',
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const PRIMARY_NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/events', label: 'Events', icon: 'events', end: false },
  { to: '/about', label: 'About', icon: 'about', end: true },
  { to: '/contact', label: 'Contact', icon: 'contact', end: true },
  { to: '/tickets', label: 'My Tickets', icon: 'tickets', end: false },
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
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
            ))}
          </nav>
          <div className="nav-tools">
            <ThemeToggle />
            <NavLink className="btn btn-ghost btn-small" to="/admin/login">Login</NavLink>
            <NavLink className="btn btn-primary btn-small nav-start" to="/events" end>Get Started</NavLink>
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
            <p>Discover exciting events, connect with communities, and create unforgettable experiences.</p>
            <div className="social-row">
              <NavLink to="/contact" aria-label="Email Eventra">Email</NavLink>
              <a href="https://www.linkedin.com/sharing/share-offsite/?url=http%3A%2F%2Flocalhost%3A5173" target="_blank" rel="noreferrer">LinkedIn</a>
              <a href="https://wa.me/?text=Eventra%20http%3A%2F%2Flocalhost%3A5173" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
          <div>
            <h2>Explore</h2>
            {PRIMARY_NAV.filter((item) => item.to !== '/tickets').map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
            ))}
          </div>
          <div>
            <h2>Account</h2>
            <NavLink to="/admin/login">Login</NavLink>
            <NavLink to="/tickets">My Tickets</NavLink>
          </div>
          <div>
            <h2>Platform</h2>
            <p>A place to discover events, secure your spot, and stay connected with experiences that matter.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Eventra</p>
          <p>Photographs stored with the app. Unsplash license.</p>
        </div>
      </footer>
      <nav className="bottom-nav" aria-label="Mobile">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
