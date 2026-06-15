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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; icon?: IconComponent } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((msg, icon) => {
    setToast({ msg, icon });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <Toast msg={toast.msg} icon={toast.icon} />}
    </ToastContext.Provider>
  );
}
