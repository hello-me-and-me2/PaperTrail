import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { getVapidPublicKey, savePushSubscription } from '../services/api';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const DISMISSED_KEY = 'pt_notif_dismissed';

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    // Small delay so the page settles before showing the prompt
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function enable() {
    setStatus('requesting');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const publicKey = await getVapidPublicKey();
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await savePushSubscription(sub.toJSON());
      setStatus('granted');
      setTimeout(() => setVisible(false), 2000);
    } catch {
      setStatus('denied');
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-dark-700 border border-dark-400 rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center mt-0.5">
          {status === 'granted'
            ? <Bell className="w-5 h-5 text-green-400" />
            : status === 'denied'
            ? <BellOff className="w-5 h-5 text-red-400" />
            : <Bell className="w-5 h-5 text-accent" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {status === 'granted' ? (
            <>
              <p className="text-sm font-semibold text-white">Notifications enabled</p>
              <p className="text-xs text-slate-400 mt-0.5">You'll be alerted the moment suspicious activity is detected.</p>
            </>
          ) : status === 'denied' ? (
            <>
              <p className="text-sm font-semibold text-white">Permission denied</p>
              <p className="text-xs text-slate-400 mt-0.5">Enable notifications in your browser settings to receive corruption alerts.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Enable corruption alerts</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Get instant push notifications when PaperTrail detects suspicious activity in your connected data.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={enable}
                  disabled={status === 'requesting'}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                >
                  {status === 'requesting' ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Bell className="w-3 h-3" />
                  )}
                  {status === 'requesting' ? 'Enabling…' : 'Allow notifications'}
                </button>
                <button
                  onClick={dismiss}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>

        {status !== 'requesting' && (
          <button onClick={dismiss} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
