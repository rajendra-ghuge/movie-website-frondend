import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, MoreVertical, Plus } from 'lucide-react';
import { movieApi } from '../api';

/* ─────────────────────────────────────────────────────────
 * TV keyboard navigation only active on laptop / TV (≥ 1024px).
 * Mobile layout & behaviour are completely unchanged.
 * ───────────────────────────────────────────────────────── */
const isTVSize = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

// Get the rendered top-offset of a card element (used for row detection)
// We round to avoid sub-pixel differences between cards in the same row.
const getCardTop = (el) => {
    if (!el) return -1;
    return Math.round(el.getBoundingClientRect().top);
};

const MovieGrid = ({ fetchUrl, searchQuery, type, locationSearch }) => {
    const navigate = useNavigate();
    const [focusedCardIdx, setFocusedCardIdx] = useState(-1); // -1 = no card focused
    const [loadMoreFocused, setLoadMoreFocused] = useState(false);
    const cardRefs = useRef([]);
    const loadMoreRef = useRef(null);

    // Track previous movie count so we know where new cards start after Load More
    const prevMoviesLenRef = useRef(0);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error
    } = useInfiniteQuery({
        queryKey: ['movies-grid', locationSearch || searchQuery || 'default'],
        queryFn: async ({ pageParam = 1 }) => {
            const res = searchQuery
                ? await movieApi.searchMulti(searchQuery, pageParam)
                : await fetchUrl({ page: pageParam });

            if (res.data.results) {
                res.data.results = res.data.results.filter(item => item.media_type !== 'person');
            }
            return res.data;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.total_pages) return lastPage.page + 1;
            return undefined;
        },
        initialPageParam: 1,
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const movies = data?.pages.flatMap(page => page.results) || [];

    // ── Reset grid focus on route change ──────────────────
    useEffect(() => {
        setFocusedCardIdx(-1);
        setLoadMoreFocused(false);
        prevMoviesLenRef.current = 0;
    }, [locationSearch]);

    // ── After Load More: focus first new card ─────────────
    // When new cards arrive while Load More was focused,
    // jump focus to the first newly-added card.
    useEffect(() => {
        const prevLen = prevMoviesLenRef.current;
        const newLen = movies.length;

        if (loadMoreFocused && newLen > prevLen && prevLen > 0) {
            // New batch arrived — focus first new card after a tick so DOM is ready
            setTimeout(() => focusCard(prevLen), 50);
        }

        prevMoviesLenRef.current = newLen;
    // focusCard is defined below; we use the ref trick to keep deps stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [movies.length]);

    const handleMovieClick = (movie) => {
        const mediaType = type || movie.media_type || (movie.title ? 'movie' : 'tv');
        navigate(`/${mediaType}/${movie.id}`);
    };

    // ── Focus helpers ──────────────────────────────────────
    const focusCard = useCallback((idx) => {
        if (idx < 0 || idx >= movies.length) return;
        setFocusedCardIdx(idx);
        setLoadMoreFocused(false);
        // Defer to next tick so React finishes rendering the focused class first
        setTimeout(() => {
            const el = cardRefs.current[idx];
            if (el) {
                el.focus();
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 0);
    }, [movies.length]);

    const focusLoadMore = useCallback(() => {
        setLoadMoreFocused(true);
        setFocusedCardIdx(-1);
        setTimeout(() => {
            const el = loadMoreRef.current;
            if (el) {
                el.focus();
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 0);
    }, []);

    // Entry point: Down arrow from navbar focuses first card
    const handleGridAnchorFocus = useCallback(() => {
        if (isTVSize()) focusCard(0);
    }, [focusCard]);

    // ── Row detection using DOM (fixes COLS mismatch bug) ─
    // Instead of relying on a hardcoded COLS constant, we compare the
    // actual rendered top-position of adjacent cards.
    const isSameRow = useCallback((idxA, idxB) => {
        const elA = cardRefs.current[idxA];
        const elB = cardRefs.current[idxB];
        if (!elA || !elB) return false;
        return Math.abs(getCardTop(elA) - getCardTop(elB)) < 5; // 5px tolerance
    }, []);

    // Find how many columns are in the rendered grid for ↑/↓ navigation
    const getColsInRow = useCallback((startIdx) => {
        const baseTop = getCardTop(cardRefs.current[startIdx]);
        let count = 0;
        for (let i = startIdx; i < movies.length; i++) {
            if (Math.abs(getCardTop(cardRefs.current[i]) - baseTop) < 5) {
                count++;
            } else {
                break;
            }
        }
        return Math.max(count, 1);
    }, [movies.length]);

    // Find the index of the first card in the same row as `idx`
    const getRowStart = useCallback((idx) => {
        const targetTop = getCardTop(cardRefs.current[idx]);
        let start = idx;
        while (start > 0) {
            const prevTop = getCardTop(cardRefs.current[start - 1]);
            if (Math.abs(prevTop - targetTop) < 5) {
                start--;
            } else {
                break;
            }
        }
        return start;
    }, []);

    // ── Keyboard handler ───────────────────────────────────
    const handleGridKeyDown = useCallback((e) => {
        if (!isTVSize()) return;
        if (focusedCardIdx === -1 && !loadMoreFocused) return;

        const key = e.key;

        // ── Load More is focused ──
        if (loadMoreFocused) {
            if (key === 'ArrowUp') {
                e.preventDefault();
                focusCard(movies.length - 1);
            } else if (key === 'Enter') {
                e.preventDefault();
                if (!isFetchingNextPage) fetchNextPage();
            }
            return;
        }

        // ── A movie card is focused ──

        if (key === 'ArrowLeft') {
            e.preventDefault();
            if (focusedCardIdx > 0) {
                focusCard(focusedCardIdx - 1);
            }
            // At index 0 → stay put (or we could jump to navbar, but Up is better)

        } else if (key === 'ArrowRight') {
            e.preventDefault();
            if (focusedCardIdx < movies.length - 1) {
                focusCard(focusedCardIdx + 1);
            } else if (hasNextPage) {
                focusLoadMore();
            }

        } else if (key === 'ArrowDown') {
            e.preventDefault();
            // Jump by the number of columns in the current row
            const rowStart = getRowStart(focusedCardIdx);
            const cols = getColsInRow(rowStart);
            const nextIdx = focusedCardIdx + cols;

            if (nextIdx < movies.length) {
                focusCard(nextIdx);
            } else if (hasNextPage) {
                focusLoadMore();
            }
            // No next row and no load more → stay

        } else if (key === 'ArrowUp') {
            e.preventDefault();
            // Check if we're on the first row
            const rowStart = getRowStart(focusedCardIdx);
            if (rowStart === 0) {
                // Return to navbar — focus the currently-highlighted nav link
                setFocusedCardIdx(-1);
                setTimeout(() => {
                    const navbar = document.getElementById('tv-navbar');
                    const activeNavLink =
                        navbar?.querySelector('.nav-link[tabindex="0"]') ||
                        navbar?.querySelector('.nav-link');
                    activeNavLink?.focus();
                    navbar?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }, 0);
            } else {
                // Jump up by the number of columns in the row above
                const prevRowStart = getRowStart(rowStart - 1);
                const cols = getColsInRow(prevRowStart);
                // Keep the same column position
                const col = focusedCardIdx - rowStart;
                const targetIdx = Math.min(rowStart - 1, prevRowStart + col);
                focusCard(targetIdx);
            }

        } else if (key === 'Enter') {
            e.preventDefault();
            if (focusedCardIdx >= 0) handleMovieClick(movies[focusedCardIdx]);
        }
    }, [
        focusedCardIdx, loadMoreFocused, movies,
        hasNextPage, fetchNextPage, isFetchingNextPage,
        focusCard, focusLoadMore, isSameRow, getRowStart, getColsInRow
    ]);

    // ── Shared focus anchor ────────────────────────────────
    const focusAnchor = (
        <div
            id="tv-grid-focus-anchor"
            tabIndex={isTVSize() ? 0 : -1}
            onFocus={handleGridAnchorFocus}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
            aria-hidden="true"
        />
    );

    if (isLoading) return (
        <div className="movie-grid-container">
            {focusAnchor}
            <div className="loader-container">
                <Loader2 className="animate-spin" size={40} color="#fdd835" />
            </div>
        </div>
    );

    if (error) return (
        <div className="loader-container"><p>Failed to load movies.</p></div>
    );

    return (
        <div className="movie-grid-container" onKeyDown={handleGridKeyDown}>
            {focusAnchor}

            <div className="movie-grid">
                {movies.map((movie, idx) => {
                    const releaseDate = movie.release_date || movie.first_air_date || '';
                    const formattedDate = releaseDate
                        ? new Date(releaseDate).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: '2-digit'
                        })
                        : 'Coming Soon';

                    const mediaType = type || movie.media_type || (movie.title ? 'movie' : 'tv');
                    const isFocused = focusedCardIdx === idx;

                    return (
                        <div
                            key={`${mediaType}-${movie.id}`}
                            ref={el => { cardRefs.current[idx] = el; }}
                            tabIndex={isTVSize() ? -1 : undefined}
                            onClick={() => handleMovieClick(movie)}
                            onFocus={() => isTVSize() && setFocusedCardIdx(idx)}
                            className={`movie-card ${isFocused && isTVSize() ? 'movie-card--tv-focused' : ''}`}
                        >
                            <div className="poster-container">
                                <img
                                    src={movieApi.getImageUrl(movie.poster_path, 'w500')}
                                    alt={movie.title || movie.name}
                                    className="movie-poster"
                                    loading="lazy"
                                />
                                <div className="more-icon-btn">
                                    <MoreVertical size={18} />
                                </div>
                            </div>
                            <div className="card-info">
                                <h3 className="card-name">{movie.title || movie.name}</h3>
                                <p className="card-meta">{formattedDate}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hasNextPage && (
                <div className="load-more-container">
                    <button
                        ref={loadMoreRef}
                        tabIndex={isTVSize() ? -1 : 0}
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        onFocus={() => isTVSize() && setLoadMoreFocused(true)}
                        onBlur={() => setLoadMoreFocused(false)}
                        className={`btn-load-more ${loadMoreFocused && isTVSize() ? 'btn-load-more--tv-focused' : ''}`}
                    >
                        {isFetchingNextPage ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <Plus size={20} />
                                <span>Load More</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MovieGrid;
