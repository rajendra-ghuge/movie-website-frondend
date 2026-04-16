import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import MovieDetailPage from './pages/MovieDetailPage';
import WatchPage from './pages/WatchPage';
import useTVNavigation from './hooks/useTVNavigation';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

function App() {
  // Initialise spatial navigation engine (laptop & TV only; mobile is unaffected)
  useTVNavigation();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/:type/:id" element={<MovieDetailPage />} />
          <Route path="/watch/:type/:id" element={<WatchPage />} />
          <Route path="/watch/:type/:id/:season/:episode" element={<WatchPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
