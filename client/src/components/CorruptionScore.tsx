interface CorruptionScoreProps {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

const levelColors = {
  LOW:      { stroke: '#10b981', glow: 'rgba(16,185,129,0.4)', text: 'text-green-400' },
  MODERATE: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.4)', text: 'text-yellow-400' },
  HIGH:     { stroke: '#f97316', glow: 'rgba(249,115,22,0.4)', text: 'text-orange-400' },
  CRITICAL: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)',  text: 'text-red-400' },
};

export default function CorruptionScore({ score, level }: CorruptionScoreProps) {
  const { stroke, glow, text } = levelColors[level];

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="#1f2d40"
            strokeWidth="10"
          />
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              filter: `drop-shadow(0 0 6px ${glow})`,
              transition: 'stroke-dashoffset 1s ease-out',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold mono ${text}`}>{score}</span>
          <span className="text-xs text-slate-500 font-mono">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-slate-500 uppercase tracking-widest">Risk Score</p>
      </div>
    </div>
  );
}
