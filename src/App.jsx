import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, lazy, Suspense } from 'react';
import useTVNavigation from './hooks/useTVNavigation';
import api from './api';

const HomePage = lazy(() => import('./pages/HomePage'));
const MovieDetailPage = lazy(() => import('./pages/MovieDetailPage'));
const WatchPage = lazy(() => import('./pages/WatchPage'));

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

  // Route persistence is only useful on mobile (< 1024px).
  // Desktop and TV users always start fresh on Home.
  const isMobile = () => window.innerWidth < 1024;

  // On cold boot, restore last route if on mobile and within 24 hours
  useEffect(() => {
    if (!isMobile()) return;

    const savedRoute = localStorage.getItem('last_route');
    const savedTime = parseInt(localStorage.getItem('last_route_time') || '0', 10);
    const TWENTY_FOUR_HOURS = 15 * 60 * 1000;

    if (savedRoute && savedRoute !== '/' && location.pathname === '/' && (Date.now() - savedTime) < TWENTY_FOUR_HOURS) {
      navigate(savedRoute, { replace: true });
    } else if (Date.now() - savedTime >= TWENTY_FOUR_HOURS) {
      localStorage.removeItem('last_route');
      localStorage.removeItem('last_route_time');
    }
  }, []);

  // Save the current page as they browse (mobile only)
  useEffect(() => {
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
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
      }

      const now = Date.now();
      const lastPingTime = parseInt(localStorage.getItem('last_ping_time') || '0', 10);
      const ONE_HOUR = 60 * 60 * 1000;

      // Ping if it's been more than an hour since the last ping
      if (now - lastPingTime > ONE_HOUR) {
        api.get(`/stats/visit?uid=${deviceId}`)
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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
