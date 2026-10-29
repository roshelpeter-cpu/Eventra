import { useContext } from 'react';
import { ToastContext } from './toast-context.js';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastProvider is missing');
  return context.push;
}
