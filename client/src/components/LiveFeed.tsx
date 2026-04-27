import { Zap, CheckCircle, AlertTriangle, Info, Search, Compass } from 'lucide-react';
import { FeedItem } from '../hooks/useInvestigation';

const severityConfig = {
  info:      { icon: Info,          cls: 'text-slate-400',  dot: 'bg-slate-500' },
  success:   { icon: CheckCircle,   cls: 'text-green-400',  dot: 'bg-green-500' },
  warning:   { icon: AlertTriangle, cls: 'text-yellow-400', dot: 'bg-yellow-500' },
  danger:    { icon: Zap,           cls: 'text-red-400',    dot: 'bg-red-500' },
  discovery: { icon: Compass,       cls: 'text-purple-400', dot: 'bg-purple-500' },
};

interface Props {
  items: FeedItem[];
  isRunning: boolean;
}

export default function LiveFeed({ items, isRunning }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-500">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-white">Live Feed</span>
        </div>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600 text-xs">
            Events will appear here as the investigation runs.
          </div>
        ) : (
          <div className="divide-y divide-dark-500/50">
            {items.map((item) => {
              const cfg = severityConfig[item.severity ?? 'info'];
              const Icon = cfg.icon;
              return (
                <div key={item.id} className="px-4 py-3 flex gap-3 items-start fade-in hover:bg-dark-600/30 transition-colors">
                  <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${cfg.cls} flex items-center gap-1`}>
                        <Icon className="w-3 h-3 shrink-0" />
                        {item.event}
                      </span>
                      <span className="text-xs text-slate-600 shrink-0 font-mono">{item.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">{item.name}</p>
                    {item.detail && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
