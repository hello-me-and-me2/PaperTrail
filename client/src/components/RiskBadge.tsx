interface RiskBadgeProps {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  size?: 'sm' | 'md' | 'lg';
}

const configs = {
  CRITICAL: { label: 'CRITICAL RISK', cls: 'bg-red-950 text-red-400 border-red-800' },
  HIGH:     { label: 'HIGH RISK',     cls: 'bg-orange-950 text-orange-400 border-orange-800' },
  MODERATE: { label: 'MODERATE RISK', cls: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
  LOW:      { label: 'LOW RISK',      cls: 'bg-green-950 text-green-400 border-green-800' },
};

const sizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5 font-bold',
};

export default function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  const { label, cls } = configs[level];
  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono font-semibold tracking-wider ${cls} ${sizes[size]}`}
    >
      {label}
    </span>
  );
}
