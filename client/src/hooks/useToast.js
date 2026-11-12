import { useEffect, useState } from 'react';
import { TOAST_DURATION } from '../constants/layout';

export function useToast() {
  const [toast, setToast] = useState(null); // { title, message }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    toast,
    showToast: (title, message) => setToast({ title, message }),
    hideToast: () => setToast(null),
  };
}
