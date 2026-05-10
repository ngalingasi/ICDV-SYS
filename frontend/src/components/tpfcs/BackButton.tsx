import { useNavigate } from 'react-router';

interface Props {
  to?: string;
  label?: string;
}

export default function BackButton({ to, label = 'Back' }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => to ? navigate(to) : navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      {label}
    </button>
  );
}
