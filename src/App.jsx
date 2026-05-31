import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense, useRef } from 'react';
import useTVNavigation from './hooks/useTVNavigation';
import api from './api';

const HomePage = lazy(() => import('./pages/HomePage'));
const MovieDetailPage = lazy(() => import('./pages/MovieDetailPage'));
const WatchPage = lazy(() => import('./pages/WatchPage'));
const DownloadDetailsPage = lazy(() => import('./pages/DownloadDetailsPage'));

const getAnalyticsDeviceId = () => {
  try {
    const nativeInstallId = window.AndroidApp?.getInstallId?.();
    if (nativeInstallId) {
      localStorage.setItem('device_id', nativeInstallId);
      return nativeInstallId;
    }
  } catch {
    // Fall back to browser storage if the native bridge is unavailable.
  }

  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('device_id', deviceId);
  }

  return deviceId;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

const RouteTracker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestoredRoute = useRef(false);

  // On cold boot, restore last route if on mobile and within 24 hours
  useEffect(() => {
    const isMobile = () => window.innerWidth < 1024;

    if (hasRestoredRoute.current) return;
    hasRestoredRoute.current = true;
    if (!isMobile()) return;

    const savedRoute = localStorage.getItem('last_route');
    const savedTime = parseInt(localStorage.getItem('last_route_time') || '0', 10);
    const ROUTE_RESTORE_WINDOW = 15 * 60 * 1000;

    if (savedRoute && savedRoute !== '/' && location.pathname === '/' && (Date.now() - savedTime) < ROUTE_RESTORE_WINDOW) {
      navigate(savedRoute);
    } else if (Date.now() - savedTime >= ROUTE_RESTORE_WINDOW) {
      localStorage.removeItem('last_route');
      localStorage.removeItem('last_route_time');
    }
  }, [location.pathname, navigate]);

  // Save the current page as they browse (mobile only)
  useEffect(() => {
    const isMobile = () => window.innerWidth < 1024;

    if (!isMobile()) return;

    if (location.pathname !== '/') {
      localStorage.setItem('last_route', location.pathname + location.search);
      localStorage.setItem('last_route_time', Date.now().toString());
    } else {
      localStorage.removeItem('last_route');
      localStorage.removeItem('last_route_time');
    }
  }, [location]);

  return null;
};

function App() {
  // Initialise spatial navigation engine (laptop & TV only; mobile is unaffected)
  useTVNavigation();

  useEffect(() => {
    // Analytics ping
    try {
      const deviceId = getAnalyticsDeviceId();

      const now = Date.now();
      const lastPingTime = parseInt(localStorage.getItem('last_ping_time') || '0', 10);
      const ONE_HOUR = 60 * 60 * 1000;

      // Ping if it's been more than an hour since the last ping
      if (now - lastPingTime > ONE_HOUR) {
        api.get(`/stats/visit?uid=${encodeURIComponent(deviceId)}`)
          .then(() => localStorage.setItem('last_ping_time', now.toString()))
          .catch(() => { });
      }
    } catch (e) {
      console.warn("Analytics error", e);
    }

    // Background Route Preloading
    // Waits 2 seconds so the initial boot is instant, then silently downloads
    // the JS and CSS for the other pages so they load instantly when clicked.
    const preloadTimer = setTimeout(() => {
      import('./pages/MovieDetailPage');
      import('./pages/WatchPage');
      import('./pages/DownloadDetailsPage');
    }, 2000);

    return () => clearTimeout(preloadTimer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteTracker />
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a0a', color: '#fdd835' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:type/:id" element={<MovieDetailPage />} />
            <Route path="/watch/:type/:id" element={<WatchPage />} />
            <Route path="/watch/:type/:id/:season/:episode" element={<WatchPage />} />
            <Route path="/downloads" element={<DownloadDetailsPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
