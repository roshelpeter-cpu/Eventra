import { useCallback, useMemo, useState } from 'react';
import { ToastContext } from './toast-context.js';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <p key={toast.id} className={toast.tone === 'warn' ? 'toast toast-warn' : 'toast'}>
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
