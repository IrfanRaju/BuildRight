import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Activity, RefreshCw } from 'lucide-react';
import { api, money } from '../lib/api';

const REFRESH_MS = 5 * 60 * 1000;

function formatUpdated(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function TickerItem({ item }) {
  return (
    <span className="rates-ticker__item inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-4 text-[11px] sm:text-xs">
      <span className="font-semibold tracking-wide text-orange-300/95">{item.city}</span>
      <span className="text-slate-500" aria-hidden="true">·</span>
      <span className="font-medium text-slate-200">{item.material}</span>
      <span className="font-bold tabular-nums text-white">
        {money(item.rate)}
        {item.unit ? <span className="ml-1 font-medium text-slate-400">/{item.unit}</span> : null}
      </span>
      {item.lastUpdated ? (
        <span className="hidden text-[10px] text-slate-500 sm:inline" title={item.lastUpdated}>
          upd {formatUpdated(item.lastUpdated)}
        </span>
      ) : null}
    </span>
  );
}

export default function RatesTicker({ onOpenCatalog }) {
  const prefersReducedMotion = useReducedMotion();
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = () => {
    setStatus((prev) => (prev === 'ready' ? 'refreshing' : 'loading'));
    api('/api/materials/ticker')
      .then((result) => {
        const next = Array.isArray(result.items) ? result.items : [];
        setItems(next);
        setNotice(result.notice || '');
        setError('');
        setStatus(next.length ? 'ready' : 'empty');
      })
      .catch((requestError) => {
        setError(requestError.message || 'Rates unavailable');
        setStatus('error');
      });
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (status === 'loading') {
    return (
      <div className="rates-ticker border-b border-slate-800/80 bg-[#0B1220] text-slate-300" role="status" aria-live="polite">
        <div className="mx-auto flex h-8 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400">
            <Activity className="h-3 w-3 animate-pulse" aria-hidden="true" />
            Rates
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800/80">
            <div className="rates-ticker__shimmer h-full w-1/3 rounded-full bg-slate-600/50" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rates-ticker border-b border-slate-800/80 bg-[#0B1220] text-slate-300">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <p className="truncate text-[11px] text-slate-400">Material rates unavailable — {error}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold text-orange-300 transition hover:border-orange-400/50 hover:text-orange-200"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'empty' || !items.length) {
    return (
      <div className="rates-ticker border-b border-slate-800/80 bg-[#0B1220]">
        <div className="mx-auto flex h-8 max-w-7xl items-center px-4 text-[11px] text-slate-500 sm:px-6 lg:px-8">
          No city material rates in the catalog yet.
        </div>
      </div>
    );
  }

  const loop = prefersReducedMotion ? items : [...items, ...items];
  const durationSec = Math.max(28, items.length * 2.4);

  return (
    <div
      className="rates-ticker group border-b border-slate-800/80 bg-[#0B1220] text-slate-200"
      title={notice || undefined}
      role="region"
      aria-label="Construction material rates by city"
    >
      <div className="mx-auto flex h-8 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenCatalog}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-300 transition hover:bg-orange-500/25 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <Activity className={`h-3 w-3 ${status === 'refreshing' ? 'animate-pulse' : ''}`} aria-hidden="true" />
          Live rates
        </button>

        <div className="rates-ticker__viewport relative min-w-0 flex-1 overflow-hidden">
          <div
            className={`rates-ticker__track flex w-max items-center ${prefersReducedMotion ? 'rates-ticker__track--static' : 'rates-ticker__track--scroll'}`}
            style={prefersReducedMotion ? undefined : { animationDuration: `${durationSec}s` }}
          >
            {loop.map((item, index) => (
              <TickerItem key={`${item.id}-${index}`} item={item} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0B1220] to-transparent sm:w-10" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0B1220] to-transparent sm:w-10" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
