import { useEffect, useRef } from 'react';
import { pageTitle } from '../format.js';

export function PageTitle({ title }) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
  return null;
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="hint" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="field-error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    confirmed: 'Confirmed',
    waitlisted: 'Waitlist',
    cancelled: 'Cancelled',
    checked_in: 'Checked in',
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
  };
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

export function Meter({ value, muted = false }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={muted ? 'meter meter-muted' : 'meter'} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="error-block" role="alert">
      <h2>That did not load.</h2>
      <p>{message}</p>
      {onRetry ? <button type="button" className="btn btn-dark" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="event-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div key={index} className="skeleton skeleton-card" />)}
    </div>
  );
}

export function Dialog({ open, title, onClose, children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    ref.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        tabIndex={-1}
        ref={ref}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="info-dialog-title">{title}</h2>
        {children}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel, danger, busy, onConfirm, onClose }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    ref.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape' && !busy) onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, busy]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={() => { if (!busy) onClose(); }}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        ref={ref}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
          <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-dark'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
