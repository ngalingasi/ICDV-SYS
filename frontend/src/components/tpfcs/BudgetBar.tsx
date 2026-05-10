interface Props {
  value: number;   // 0–100 progress/spend percentage
  label?: string;
  status?: string; // activity status — drives color logic
  color?: 'auto' | 'green' | 'yellow' | 'red' | 'blue';
}

export default function BudgetBar({ value, label, status, color = 'auto' }: Props) {
  const pct = Math.min(Math.max(value, 0), 100);

  // Color logic:
  // completed → always green
  // cancelled → gray
  // auto (progress bar): low = green, mid = yellow, high = red
  let barColor = 'bg-green-500';
  if (status === 'completed') {
    barColor = 'bg-green-500';
  } else if (status === 'cancelled') {
    barColor = 'bg-gray-400';
  } else if (color === 'auto' || !status) {
    barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  } else if (color === 'red')    { barColor = 'bg-red-500'; }
  else if (color === 'yellow') { barColor = 'bg-yellow-500'; }
  else if (color === 'blue')   { barColor = 'bg-blue-500'; }

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
