import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

// Global store
let listeners: ((toasts: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];
let counter = 0;

const notify = (type: ToastType, title: string, message?: string) => {
  const id = ++counter;
  toasts = [...toasts, { id, type, title, message }];
  listeners.forEach(l => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    listeners.forEach(l => l(toasts));
  }, 4000);
};

export const toast = {
  success: (title: string, message?: string) => notify('success', title, message),
  error:   (title: string, message?: string) => notify('error',   title, message),
  warning: (title: string, message?: string) => notify('warning', title, message),
  info:    (title: string, message?: string) => notify('info',    title, message),
};

const STYLES: Record<ToastType, { bg: string; icon: string; iconColor: string; border: string }> = {
  success: { bg: 'bg-white dark:bg-gray-900', border: 'border-green-200 dark:border-green-500/30', icon: '✓', iconColor: 'bg-green-500' },
  error:   { bg: 'bg-white dark:bg-gray-900', border: 'border-red-200 dark:border-red-500/30',   icon: '✕', iconColor: 'bg-red-500' },
  warning: { bg: 'bg-white dark:bg-gray-900', border: 'border-orange-200 dark:border-orange-500/30', icon: '!', iconColor: 'bg-orange-500' },
  info:    { bg: 'bg-white dark:bg-gray-900', border: 'border-blue-200 dark:border-blue-500/30',  icon: 'i', iconColor: 'bg-blue-500' },
};

function ToastItem({ toast: t, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[t.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => { setVisible(false); setTimeout(onRemove, 300); }, 3700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex items-start gap-3 w-80 p-4 rounded-xl border shadow-lg ${s.bg} ${s.border}
        transition-all duration-300 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      <span className={`flex-shrink-0 w-6 h-6 rounded-full ${s.iconColor} text-white text-xs font-bold flex items-center justify-center`}>
        {s.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{t.title}</p>
        {t.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.message}</p>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(onRemove, 300); }}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none flex-shrink-0">×</button>
    </div>
  );
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => { listeners = listeners.filter(l => l !== setItems); };
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3">
      {items.map(t => (
        <ToastItem key={t.id} toast={t}
          onRemove={() => {
            toasts = toasts.filter(x => x.id !== t.id);
            listeners.forEach(l => l(toasts));
          }}
        />
      ))}
    </div>,
    document.body
  );
}
