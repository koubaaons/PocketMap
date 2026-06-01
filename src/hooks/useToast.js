/**
 * @fileoverview useToast hook — lightweight notification system.
 *
 * Provides toast(message, type, duration) to any component.
 * Type: 'success' | 'error' | 'info'
 */

import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'success', duration = 2500) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return { toasts, toast, dismiss };
}