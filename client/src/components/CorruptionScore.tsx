const ZONES = [
  { from: 180, to: 135, color: '#10b981' }, // LOW
  { from: 135, to: 90,  color: '#f59e0b' }, // MODERATE
  { from: 90,  to: 45,  color: '#f97316' }, // HIGH
  { from: 45,  to: 0,   color: '#ef4444' }, // CRITICAL
];

const LEVEL: Record<string, { color: string; text: string; label: string }> = {
  LOW:      { color: '#10b981', text: 'text-green-400',  label: 'Low Risk'      },
  MODERATE: { color: '#f59e0b', text: 'text-yellow-400', label: 'Moderate Risk' },
  HIGH:     { color: '#f97316', text: 'text-orange-400', label: 'High Risk'     },
  CRITICAL: { color: '#ef4444', text: 'text-red-400',    label: 'Critical Risk' },
};

interface Props {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  size?: 'sm' | 'md';
}

export default function CorruptionScore({ score, level, size = 'md' }: Props) {
  const cx = 80, cy = 80, r = 58, trackW = 14;

  function pt(deg: number): [number, number] {
    const rad = deg * (Math.PI / 180);
    return [+(cx + r * Math.cos(rad)).toFixed(3), +(cy - r * Math.sin(rad)).toFixed(3)];
  }

  function arcD(from: number, to: number, large = 0): string {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  // Needle angle: 180° at score=0 (left), 0° at score=100 (right)
  const needleDeg = 180 - (Math.max(0, Math.min(100, score)) / 100) * 180;
  const [nx, ny] = pt(needleDeg);
  const s = 0.72;
  const needleX = cx + (nx - cx) * s;
  const needleY = cy + (ny - cy) * s;

  // Active filled arc from left edge up to needle position
  // Avoid degenerate arc when score is 0 or 100
  const activeFrom = 180;
  const activeTo   = score >= 99.5 ? 0.5 : Math.max(needleDeg, 0.5);
  const showActive = score > 0.5;

  const { color, text, label } = LEVEL[level] ?? LEVEL.LOW;
  const svgClass = size === 'sm' ? 'w-28' : 'w-44';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 160 90" className={`${svgClass} overflow-visible`}>
        {/* Grey background track */}
        <path d={arcD(180, 0)} fill="none" stroke="#1e293b" strokeWidth={trackW} strokeLinecap="butt" />

        {/* Dimmed colour zones */}
        {ZONES.map((z, i) => (
          <path key={i} d={arcD(z.from, z.to)} fill="none" stroke={z.color}
            strokeWidth={trackW} strokeLinecap="butt" opacity={0.22} />
        ))}

        {/* Active glowing fill */}
        {showActive && (
          <path
            d={arcD(activeFrom, activeTo)}
            fill="none" stroke={color}
            strokeWidth={trackW - 2}
            strokeLinecap="butt"
            style={{ filter: `drop-shadow(0 0 5px ${color}90)` }}
          />
        )}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY}
          stroke="#f8fafc" strokeWidth={2} strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(248,250,252,0.6))' }} />
        <circle cx={cx} cy={cy} r={5} fill="#0f172a" stroke="#475569" strokeWidth={1.5} />

        {/* Zone tick labels */}
        <text x="12" y="88" fill="#475569" fontSize="7.5" textAnchor="middle" fontFamily="monospace">LOW</text>
        <text x="80" y="15"  fill="#475569" fontSize="7.5" textAnchor="middle" fontFamily="monospace">MED</text>
        <text x="148" y="88" fill="#475569" fontSize="7.5" textAnchor="middle" fontFamily="monospace">CRIT</text>
      </svg>

      {size !== 'sm' && (
        <p className={`text-sm font-bold uppercase tracking-widest ${text}`}>{label}</p>
      )}
    </div>
  );
}
