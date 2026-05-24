'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type FetchFn = typeof window.fetch;

export default function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeRequests, setActiveRequests] = useState(0);
  const [showNetworkLoader, setShowNetworkLoader] = useState(false);
  const [showRouteLoader, setShowRouteLoader] = useState(false);
  const firstPathRender = useRef(true);

  useEffect(() => {
    const originalFetch: FetchFn = window.fetch.bind(window);

    window.fetch = async (...args) => {
      setActiveRequests(v => v + 1);
      try {
        return await originalFetch(...args);
      } finally {
        setActiveRequests(v => Math.max(0, v - 1));
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (activeRequests <= 0) {
      setShowNetworkLoader(false);
      return;
    }

    // Prevent flicker for very fast responses.
    const timer = window.setTimeout(() => setShowNetworkLoader(true), 120);
    return () => window.clearTimeout(timer);
  }, [activeRequests]);

  useEffect(() => {
    if (firstPathRender.current) {
      firstPathRender.current = false;
      return;
    }

    setShowRouteLoader(true);
    const timer = window.setTimeout(() => setShowRouteLoader(false), 280);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const visible = showNetworkLoader || showRouteLoader;

  return (
    <>
      {children}
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
          <div className="rounded-2xl border border-white/50 bg-white/95 px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Loading</p>
                <p className="text-xs text-slate-500">Fetching latest data...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
