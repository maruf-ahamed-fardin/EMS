'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Check, Copy, Info } from 'lucide-react';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'copy';
}

interface ToastContextType {
  toast: (title: string, description?: string, type?: 'success' | 'info' | 'copy') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((title: string, description?: string, type: 'success' | 'info' | 'copy' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container floating at bottom center */}
      <div 
        aria-live="polite" 
        className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white/95 px-4 py-2.5 text-xs font-medium text-zinc-900 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 dark:border-zinc-800/90 dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-2xl dark:ring-white/10"
          >
            {t.type === 'copy' ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                <Copy className="h-3 w-3" />
              </span>
            ) : t.type === 'info' ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400">
                <Info className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
                <Check className="h-3 w-3 stroke-[2.5]" />
              </span>
            )}
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight">{t.title}</span>
              {t.description && (
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
