import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { AdminLayout } from '../components/AdminLayout.jsx';
import { PageTitle } from '../components/ui.jsx';

export function RequireAdmin() {
  const [state, setState] = useState({ status: 'loading', admin: null });

  useEffect(() => {
    let cancelled = false;
    api('/api/admin/me')
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', admin: data.admin });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous', admin: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="page">
        <PageTitle title="Administrator" />
        <div className="wrap"><div className="skeleton skeleton-card" /></div>
      </div>
    );
  }
  if (state.status === 'anonymous') return <Navigate to="/admin/login" replace />;
  return <AdminLayout admin={state.admin} />;
}

export function AdminNotFound() {
  return (
    <div className="empty">
      <h1>That page does not exist.</h1>
      <Link className="btn btn-dark" to="/admin">Back to overview</Link>
    </div>
  );
}
  export function NotFoundPage() {
  return (
    <div className="page">
      <PageTitle title="Not found" />
      <div className="wrap empty">
        <p className="kicker">404</p>
        <h1>That page is not available.</h1>
        <p>The link may be old, or the event was never published.</p>
        <Link className="btn btn-primary" to="/events">Browse events</Link>
      </div>
    </div>
  );
}
