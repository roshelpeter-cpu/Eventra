import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark, MoonIcon, SearchIcon, SunIcon } from './Icons.jsx';
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

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function search(event) {
    event.preventDefault();
    const next = query.trim();
    navigate(next ? `/events?q=${encodeURIComponent(next)}` : '/events');
    setOpen(false);
  }

  function close() {
    setOpen(false);
  }

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="topbar">
        <div className={open ? 'topbar-inner open' : 'topbar-inner'}>
          <NavLink to="/" className="brand" end onClick={close}>
            <BrandMark />
            Eventra
          </NavLink>
          <button
            type="button"
            className="btn btn-ghost btn-small menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
          <nav id="site-nav" className="site-nav">
            <NavLink to="/" end onClick={close}>Home</NavLink>
            <NavLink to="/events" onClick={close}>Events</NavLink>
            <NavLink to="/about" onClick={close}>About</NavLink>
            <NavLink to="/contact" onClick={close}>Contact</NavLink>
          </nav>
          <form className="nav-search" onSubmit={search} role="search">
            <SearchIcon />
            <input
              aria-label="Search events"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <div className="nav-actions">
            <ThemeToggle />
            <NavLink className="btn btn-ghost btn-small" to="/admin/login" onClick={close}>Log in</NavLink>
            <NavLink className="btn btn-primary btn-small" to="/events" onClick={close}>Get Started</NavLink>
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
            <NavLink to="/events">Browse events</NavLink>
          </div>
          <div>
            <h2>Platform</h2>
            <p>One administrator publishes every event. Visitors register without creating an account.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Eventra · fictional demo events</p>
          <p>Photographs stored with the app. Unsplash license.</p>
        </div>
      </footer>
    </>
  );
}
