import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Download, Play, RefreshCw } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';
import Disclaimer from '../components/Disclaimer';
import { DetailShimmer } from '../components/Shimmer';

const isTV = () => {
    if (typeof window === 'undefined') return false;
    const isTVUA = /TV|LargeScreen|AndroidTV|SmartTV/i.test(navigator.userAgent);
    return window.innerWidth >= 1024 || isTVUA;
};

const MovieDetailPage = () => {
    const { type = 'movie', id } = useParams();
    const navigate = useNavigate();

    // TV navigation state
    const [activeSection, setActiveSection] = useState(null);
    const [castFocusIdx, setCastFocusIdx] = useState(0);
    const [genreFocusIdx, setGenreFocusIdx] = useState(0);
    const [kwFocusIdx, setKwFocusIdx] = useState(0);
    const [isInteractingWithTrailer, setIsInteractingWithTrailer] = useState(false);
    const watchBtnRef = useRef(null);
    const castRefs = useRef([]);
    const genreRefs = useRef([]);
    const kwRefs = useRef([]);
    const trailerBridgeRef = useRef(null);
    const trailerIframeRef = useRef(null);
    const retryButtonRef = useRef(null);

    const { data: movie, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['detail', type, id],
        queryFn: async () => {
            // Include all fields needed by both DetailPage and WatchPage so they
            // safely share the same React Query cache entry without stale-field mismatches.
            const params = { append_to_response: 'videos,credits,external_ids' };
            const res = type === 'movie'
                ? await movieApi.getMovie(id, params)
                : await movieApi.getTvDetail(id, params);
            return res.data;
        },
    });

    useEffect(() => {
        if ((error || !movie) && !isLoading) {
            setTimeout(() => retryButtonRef.current?.focus(), 0);
        }
    }, [error, movie, isLoading]);

    const { data: keywordsData } = useQuery({
        queryKey: ['keywords', type, id],
        queryFn: async () => {
            const res = await movieApi.getKeywords(id, type);
            return res.data;
        }
    });

    const { data: genresData } = useQuery({
        queryKey: ['genres', type],
        queryFn: async () => {
            const res = await movieApi.getGenres(type);
            return res.data;
        }
    });

    useEffect(() => {
        // Scroll to top on navigation — moved out of queryFn to avoid running on background refetches.
        window.scrollTo(0, 0);
        setActiveSection(null);
        setCastFocusIdx(0);
        setGenreFocusIdx(0);
        setKwFocusIdx(0);
        setIsInteractingWithTrailer(false);
    }, [type, id]);

    const focusSection = useCallback((section, idx = 0) => {
        setActiveSection(section);
        setTimeout(() => {
            let el = null;
            if (section === 'watch') el = watchBtnRef.current;
            else if (section === 'cast') { setCastFocusIdx(idx); el = castRefs.current[idx]; }
            else if (section === 'genres') { setGenreFocusIdx(idx); el = genreRefs.current[idx]; }
            else if (section === 'keywords') { setKwFocusIdx(idx); el = kwRefs.current[idx]; }
            else if (section === 'trailer') el = trailerBridgeRef.current;

            if (el) {
                el.focus();
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }, 0);
    }, []);

    const focusNavbar = useCallback(() => {
        setActiveSection(null);
        setTimeout(() => {
            const navbar = document.getElementById('tv-navbar');
            const activeNavLink = navbar?.querySelector('.nav-link[tabindex="0"]') || navbar?.querySelector('.nav-link');
            activeNavLink?.focus();
            navbar?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 0);
    }, []);

    const navigateUpFromTrailer = useCallback(() => {
        if (kwRefs.current.some(Boolean)) focusSection('keywords', 0);
        else if (genreRefs.current.some(Boolean)) focusSection('genres', 0);
        else if (castRefs.current.some(Boolean)) focusSection('cast', 0);
        else focusSection('watch');
    }, [focusSection]);

    const handleBackAction = useCallback(() => {
        if (isInteractingWithTrailer) {
            setIsInteractingWithTrailer(false);
            focusSection('keywords', 0);
        } else {
            focusNavbar();
        }
    }, [isInteractingWithTrailer, focusSection, focusNavbar]);

    useEffect(() => {
        if (isInteractingWithTrailer && trailerIframeRef.current) {
            setTimeout(() => trailerIframeRef.current?.focus(), 100);
        }
    }, [isInteractingWithTrailer]);

    useEffect(() => {
        // Detect when focus leaves the trailer iframe. The 'blur' event on window
        // fires when the page loses focus (e.g. user switches app). The 'focusout'
        // on the document fires when focus moves to any other element within the page.
        // Together these replace the old 1-second polling interval.
        const checkFocus = () => {
            if (isInteractingWithTrailer && document.activeElement !== trailerIframeRef.current) {
                setIsInteractingWithTrailer(false);
            }
        };
        window.addEventListener('blur', checkFocus);
        document.addEventListener('focusout', checkFocus);
        return () => {
            window.removeEventListener('blur', checkFocus);
            document.removeEventListener('focusout', checkFocus);
        };
    }, [isInteractingWithTrailer]);

    // Handle Fullscreen Exit
    useEffect(() => {
        const handleFS = () => {
            if (!document.fullscreenElement && isInteractingWithTrailer) {
                setIsInteractingWithTrailer(false);
                setTimeout(() => trailerBridgeRef.current?.focus(), 150);
            }
        };
        document.addEventListener('fullscreenchange', handleFS);
        document.addEventListener('webkitfullscreenchange', handleFS);
        return () => {
            document.removeEventListener('fullscreenchange', handleFS);
            document.removeEventListener('webkitfullscreenchange', handleFS);
        };
    }, [isInteractingWithTrailer]);

    const handlePageKeyDown = useCallback((e) => {
        if (!isTV()) return;
        const key = e.key;

        // Universal Back Support
        if (key === 'Escape' || key === 'Backspace' || key === 'Back') {
            e.preventDefault();
            handleBackAction();
            return;
        }

        const navbar = document.getElementById('tv-navbar');
        if (navbar && navbar.contains(e.target)) {
            const isDropdown = e.target.closest('.nav-dropdown');
            if (key === 'ArrowDown' && !isDropdown) { /* allow jump */ }
            else return;
        }

        const castCount = castRefs.current.filter(Boolean).length;
        const genreCount = genreRefs.current.filter(Boolean).length;
        const kwCount = kwRefs.current.filter(Boolean).length;

        if (activeSection === null) {
            if (key === 'ArrowDown') { e.preventDefault(); focusSection('watch'); }
            return;
        }

        if (activeSection === 'watch') {
            if (key === 'ArrowDown') {
                e.preventDefault();
                if (castCount > 0) focusSection('cast', 0);
                else if (genreCount > 0) focusSection('genres', 0);
                else if (kwCount > 0) focusSection('keywords', 0);
                else focusSection('trailer');
            } else if (key === 'ArrowUp') { e.preventDefault(); focusNavbar(); }
            else if (key === 'Enter') { e.preventDefault(); navigate(`/watch/${type}/${id}`); }
        } else if (activeSection === 'cast') {
            if (key === 'ArrowLeft') {
                e.preventDefault();
                const n = castFocusIdx > 0 ? castFocusIdx - 1 : castCount - 1;
                setCastFocusIdx(n); castRefs.current[n]?.focus();
            }
            else if (key === 'ArrowRight') {
                e.preventDefault();
                const n = (castFocusIdx + 1) % castCount;
                setCastFocusIdx(n); castRefs.current[n]?.focus();
            }
            else if (key === 'ArrowDown') { e.preventDefault(); if (genreCount > 0) focusSection('genres', 0); else if (kwCount > 0) focusSection('keywords', 0); else focusSection('trailer'); }
            else if (key === 'ArrowUp') { e.preventDefault(); focusSection('watch'); }
            else if (key === 'Enter') { e.preventDefault(); castRefs.current[castFocusIdx]?.click(); }
        } else if (activeSection === 'genres') {
            if (key === 'ArrowLeft') {
                e.preventDefault();
                const n = genreFocusIdx > 0 ? genreFocusIdx - 1 : genreCount - 1;
                setGenreFocusIdx(n); genreRefs.current[n]?.focus();
            }
            else if (key === 'ArrowRight') {
                e.preventDefault();
                const n = (genreFocusIdx + 1) % genreCount;
                setGenreFocusIdx(n); genreRefs.current[n]?.focus();
            }
            else if (key === 'ArrowUp') { e.preventDefault(); if (castCount > 0) focusSection('cast', 0); else focusSection('watch'); }
            else if (key === 'ArrowDown') { e.preventDefault(); if (kwCount > 0) focusSection('keywords', 0); else focusSection('trailer'); }
            else if (key === 'Enter') { e.preventDefault(); genreRefs.current[genreFocusIdx]?.click(); }
        } else if (activeSection === 'keywords') {
            if (key === 'ArrowLeft') {
                e.preventDefault();
                const n = kwFocusIdx > 0 ? kwFocusIdx - 1 : kwCount - 1;
                setKwFocusIdx(n); kwRefs.current[n]?.focus();
            }
            else if (key === 'ArrowRight') {
                e.preventDefault();
                const n = (kwFocusIdx + 1) % kwCount;
                setKwFocusIdx(n); kwRefs.current[n]?.focus();
            }
            else if (key === 'ArrowUp') { e.preventDefault(); if (genreCount > 0) focusSection('genres', 0); else if (castCount > 0) focusSection('cast', 0); else focusSection('watch'); }
            else if (key === 'ArrowDown') { e.preventDefault(); focusSection('trailer'); }
            else if (key === 'Enter') { e.preventDefault(); kwRefs.current[kwFocusIdx]?.click(); }
        } else if (activeSection === 'trailer') {
            if (key === 'ArrowUp') { e.preventDefault(); navigateUpFromTrailer(); }
            else if (key === 'Enter') { e.preventDefault(); setIsInteractingWithTrailer(true); }
        }
    }, [activeSection, castFocusIdx, genreFocusIdx, kwFocusIdx, isInteractingWithTrailer, focusSection, focusNavbar, handleBackAction, navigateUpFromTrailer, navigate, type, id]);

    if (isLoading) return (
        <div className="page-wrapper">
            <Navbar />
            <DetailShimmer />
        </div>
    );
    if (error || !movie) return (
        <div className="page-wrapper">
            <Navbar />
            <div className="loader-main error-state">
                <div className="error-card">
                    <h2>Unable to load content</h2>
                    <p>The movie details could not be loaded. This is often a temporary server hiccup.</p>
                    <button
                        ref={retryButtonRef}
                        type="button"
                        className="btn-retry"
                        onClick={() => refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
                        {isFetching ? 'Retrying...' : 'Retry'}
                    </button>
                    <span className="error-hint">D-pad: press OK / Enter to retry</span>
                </div>
            </div>
        </div>
    );

    const trailer = movie.videos?.results?.find(v => v.type === 'Trailer') || movie.videos?.results?.[0];
    const title = movie.title || movie.name;
    const releaseYear = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const castList = movie.credits?.cast?.slice(0, 8) || [];
    const genreList = (movie.genres?.length ? movie.genres : (genresData?.genres || []).filter(genre => movie.genre_ids?.includes(genre.id))).slice(0, 12);
    const keywordsList = (type === 'movie' ? keywordsData?.keywords : keywordsData?.results)?.slice(0, 15) || [];
    const tvMode = isTV();
    const isApk = typeof window !== 'undefined' && !!window.AndroidApp;
    const showDownloads = isApk && !tvMode;

    return (
        <div className="page-wrapper" onKeyDown={handlePageKeyDown}>
            <Navbar />
            <div id="tv-grid-focus-anchor" tabIndex={tvMode ? 0 : -1} onFocus={() => tvMode && focusSection('watch')} style={{ position: 'absolute', opacity: 0 }} aria-hidden="true" />
            <div className="detail-page">
                <div className="detail-left"><img src={movieApi.getImageUrl(movie.poster_path, 'w500')} alt="" className="detail-poster-large" /></div>
                <div className="detail-right">
                    <h1 className="detail-title-large">{title}</h1>
                    <div className="detail-actions">
                        <Link ref={watchBtnRef} to={`/watch/${type}/${id}`} tabIndex={-1} onFocus={() => tvMode && setActiveSection('watch')} className={`btn-watch${activeSection === 'watch' ? ' btn-watch--tv-focused' : ''}`}><Play size={20} fill="currentColor" /> Watch Now</Link>
                        {showDownloads && (
                            <Link to={`/downloads?s=${encodeURIComponent(title)}&type=${encodeURIComponent(type)}${releaseYear ? `&year=${encodeURIComponent(releaseYear)}` : ''}&id=${id}`} className="btn-download-detail"><Download size={20} /> Download</Link>
                        )}
                    </div>
                    <p className="detail-overview">{movie.overview}</p>
                    <div className="meta-info">
                        <div className="meta-row"><span className="meta-label">Stars:</span>
                            <div className="cast-list">{castList.map((c, idx) => (
                                <Link key={c.id} ref={el => { castRefs.current[idx] = el; }} to={`/?cast=${c.id}&cn=${encodeURIComponent(c.name)}&cat=cast`} tabIndex={-1} onFocus={() => { if (tvMode) { setActiveSection('cast'); setCastFocusIdx(idx); } }} className={`keyword-tag${activeSection === 'cast' && castFocusIdx === idx ? ' keyword-tag--tv-focused' : ''}`}>{c.name}</Link>
                            ))}</div>
                        </div>
                    </div>
                    {genreList.length > 0 && (
                        <div className="keyword-row"><span className="meta-label">Genres:</span>
                            <div className="keyword-tags">{genreList.map((genre, idx) => (
                                <Link key={genre.id} ref={el => { genreRefs.current[idx] = el; }} to={`/?type=${type}&genre=${genre.id}&cat=${type === 'tv' ? 'tv' : 'movie'}`} tabIndex={-1} onFocus={() => { if (tvMode) { setActiveSection('genres'); setGenreFocusIdx(idx); } }} className={`keyword-tag${activeSection === 'genres' && genreFocusIdx === idx ? ' keyword-tag--tv-focused' : ''}`}>{genre.name}</Link>
                            ))}</div>
                        </div>
                    )}
                    <div className="keyword-row"><span className="meta-label">Keywords:</span>
                        <div className="keyword-tags">{keywordsList.map((kw, idx) => (
                            <Link key={kw.id} ref={el => { kwRefs.current[idx] = el; }} to={`/?k=${kw.id}&kn=${encodeURIComponent(kw.name)}`} tabIndex={-1} onFocus={() => { if (tvMode) { setActiveSection('keywords'); setKwFocusIdx(idx); } }} className={`keyword-tag${activeSection === 'keywords' && kwFocusIdx === idx ? ' keyword-tag--tv-focused' : ''}`}>{kw.name}</Link>
                        ))}</div>
                    </div>
                    <div className="trailer-section-container">
                        <h3 className="section-title">Official Trailer</h3>
                        {trailer ? (
                            <div className="trailer-section" style={{ position: 'relative' }}>
                                <iframe ref={trailerIframeRef} src={`https://www.youtube.com/embed/${trailer.key}?enablejsapi=1${isInteractingWithTrailer ? '&autoplay=1&mute=1' : ''}`} title="Trailer" allowFullScreen />
                                {tvMode && !isInteractingWithTrailer && activeSection === 'trailer' && (
                                    <button
                                        ref={trailerBridgeRef}
                                        className="tv-trailer-bridge"
                                        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); navigateUpFromTrailer(); } }}
                                        onClick={() => {
                                            setIsInteractingWithTrailer(true);
                                            // Auto-fullscreen for trailer
                                            const container = trailerIframeRef.current?.parentElement;
                                            if (container?.requestFullscreen) {
                                                container.requestFullscreen().catch(() => { });
                                            }
                                        }}
                                    />
                                )}
                                {tvMode && isInteractingWithTrailer && <div className="tv-trailer-exit-tip">Press <span>Back / Exit</span> to return</div>}
                            </div>
                        ) : <div className="no-trailer">N/A</div>}
                    </div>
                </div>
            </div>
            <footer className="footer" style={{ marginTop: '4rem', marginBottom: '2rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved &bull; <Disclaimer /></p>
            </footer>
        </div>
    );
};
export default MovieDetailPage;
