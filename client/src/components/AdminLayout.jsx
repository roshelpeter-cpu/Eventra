import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { BrandMark, NavIcon } from './Icons.jsx';
import { ThemeToggle } from './Layout.jsx';
import { useToast } from './useToast.js';

const LINKS = [
  ['/admin', 'Overview', 'overview', true],
  ['/admin/events', 'Events', 'events', false],
  ['/admin/attendees', 'Attendees', 'attendees', false],
  ['/admin/settings', 'Settings', 'settings', false],
];

export function AdminLayout({ admin }) {
  const navigate = useNavigate();
  const toast = useToast();

  async function logout() {
    try {
      await api('/api/admin/logout', { method: 'POST' });
      navigate('/admin/login');
    } catch (error) {
      toast(error.message, 'warn');
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <NavLink to="/" className="wordmark">
          <BrandMark />
          Eventra
        </NavLink>
        <nav className="admin-nav" aria-label="Administrator">
          {LINKS.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <NavIcon name={icon} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-profile">
          <ThemeToggle />
          <div>
            <strong>{admin.name}</strong>
            <p className="hint">{admin.email}</p>
          </div>
          <button type="button" className="logout" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
