'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Toast } from '@/components/ui';
import { IconComponent } from '@/components/icons';

type ShowToast = (msg: string, icon?: IconComponent) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// Every error toast in this app follows one of these two wordings
// ("X failed: ..." / "Couldn't ...: ...") — detected here so every call
// site automatically gets the red/alert treatment without having to pass
// an explicit tone through dozens of toast(...) calls individually.
const ERROR_PATTERN = /(^couldn't\b|\bfailed\b)/i;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; icon?: IconComponent; tone: 'default' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((msg, icon) => {
    setToast({ msg, icon, tone: ERROR_PATTERN.test(msg) ? 'error' : 'default' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <Toast msg={toast.msg} icon={toast.icon} tone={toast.tone} />}
    </ToastContext.Provider>
  );
}
