import type { ReactNode } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  required?: boolean;
}

const base = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-colors';

export function FormInput({ label, error, required, ...props }: InputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input className={`${base} ${error ? 'border-red-400' : ''} ${props.className ?? ''}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function FormSelect({ label, error, required, children, ...props }: SelectProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select className={`${base} ${error ? 'border-red-400' : ''}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function FormTextArea({ label, error, required, ...props }: TextAreaProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        className={`${base} resize-none ${error ? 'border-red-400' : ''}`}
        rows={3}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Date input using flatpickr (template's date picker) ───────────────────────
import DatePickerBase from '../form/date-picker';

interface DateInputProps {
  label: string;
  id: string;
  required?: boolean;
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
}

export function FormDateInput({ label, id, required, value, onChange, placeholder }: DateInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <DatePickerBase
        id={id}
        mode="single"
        placeholder={placeholder ?? 'Select date'}
        defaultDate={value || undefined}
        onChange={(dates) => {
          if (onChange && dates[0]) {
            const d = dates[0];
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            onChange(`${y}-${m}-${day}`);
          }
        }}
      />
    </div>
  );
}
