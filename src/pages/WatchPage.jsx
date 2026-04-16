import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, ChevronLeft, ChevronRight, Server } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';

/* ─────────────────────────────────────────────────────────
 * TV keyboard navigation only active on laptop / TV (≥ 1024px).
 * Mobile layout & behaviour are completely unchanged.
 * ───────────────────────────────────────────────────────── */
const isTVSize = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

const WatchPage = () => {
    const { type, id, season: sParam, episode: eParam } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    // UI State
    const [selectedServer, setSelectedServer] = useState(4);
    const [selectedSeason, setSelectedSeason] = useState(parseInt(sParam) || 1);
    const [selectedEpisode, setSelectedEpisode] = useState(parseInt(eParam) || (type === 'tv' ? 1 : null));

    // TV Navigation State
    const [activeSection, setActiveSection] = useState(null); // null = navbar
    const [serverIdx, setServerIdx] = useState(0);
    const [episodeIdx, setEpisodeIdx] = useState(0);
    const [similarIdx, setSimilarIdx] = useState(0);
    const [isInteracting, setIsInteracting] = useState(false);

    const playerRef = useRef(null);
    const bridgeRef = useRef(null);
    const iframeRef = useRef(null);
    const serverRefs = useRef([]);
    const seasonRef = useRef(null);
    const nextEpRef = useRef(null);
    const episodeRefs = useRef([]);
    const similarRefs = useRef([]);

    // ── Data Fetching ──────────────────────────────────────
    const { data: detail, isLoading: isDetailLoading } = useQuery({
        queryKey: ['detail', type, id],
        queryFn: async () => {
            const params = { append_to_response: 'credits,external_ids' };
            const res = type === 'movie' 
                ? await movieApi.getMovie(id, params) 
                : await movieApi.getTvDetail(id, params);
            return res.data;
        }
    });

    const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
        queryKey: ['tv-season', id, selectedSeason],
        queryFn: async () => {
            if (type !== 'tv' || !selectedSeason) return null;
            const res = await movieApi.getTvSeason(id, selectedSeason);
            return res.data;
        },
        enabled: type === 'tv' && !!selectedSeason
    });

    const { data: recommendations, isLoading: isRecLoading } = useQuery({
        queryKey: ['recommendations', type, id],
        queryFn: async () => {
            const res = type === 'movie' 
                ? await movieApi.getRecommendations(id)
                : await movieApi.getTvRecommendations(id);
            return res.data.results?.slice(0, 10) || [];
        }
    });

    // ── Logic ──────────────────────────────────────────────
    const slug = useMemo(() => {
        if (!detail) return '';
        const rawTitle = detail.title || detail.name || '';
        return rawTitle.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }, [detail]);

    const imdbId = type === 'movie' ? detail?.imdb_id : detail?.external_ids?.imdb_id;

    const getIframeSrc = () => {
        if (type === 'tv' && !selectedEpisode) return '';
        if (type === 'movie') {
            switch (selectedServer) {
                case 5: return imdbId ? `https://vidrock.net/movie/${imdbId}` : '';
                case 1: return `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=1&muted=1`;
                case 2: return `https://moviesapi.club/movie/${id}?autoplay=1`;
                case 3: return `https://vidsrc.me/embed/movie?tmdb=${id}&autoplay=1`;
                case 4: return `https://player.videasy.net/movie/${id}?autoplay=1`;
                case 6: return `https://vidlink.pro/movie/${id}?title=true&poster=true&autoplay=true&muted=true`;
                case 7: return `https://www.vidsrc.wtf/api/2/movie/?id=${id}-${slug}&autoplay=1`;
                case 8: return `https://www.vidking.net/embed/movie/${id}?autoplay=1`;
                case 9: return `https://player.smashy.stream/movie/${id}?autoplay=1`;
                case 10: return `https://vidsrc.wtf/api/3/movie/?id=${id}&autoplay=1`;
                default: return '';
            }
        } else {
            switch (selectedServer) {
                case 5: return imdbId ? `https://vidrock.net/tv/${imdbId}/${selectedSeason}/${selectedEpisode}` : '';
                case 1: return `https://vidsrc.cc/v3/embed/tv/${id}/${selectedSeason}/${selectedEpisode}?autoPlay=1&muted=1`;
                case 2: return `https://moviesapi.club/tv/${id}-${selectedSeason}-${selectedEpisode}?autoplay=1`;
                case 3: return `https://vidsrc.me/embed/tv?tmdb=${id}&season=${selectedSeason}&episode=${selectedEpisode}&autoplay=1`;
                case 4: return `https://player.videasy.net/tv/${id}/${selectedSeason}/${selectedEpisode}?nextEpisode=true&episodeSelector=true&autoplay=1`;
                case 6: return `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?title=true&poster=true&autoplay=true&muted=true&nextbutton=true`;
                case 7: return `https://www.vidsrc.wtf/api/2/tv/?id=${id}&s=${selectedSeason}&e=${selectedEpisode}&autoplay=1`;
                case 8: return `https://www.vidking.net/embed/tv/${id}-${slug}/${selectedSeason}/${selectedEpisode}?autoplay=1`;
                case 9: return `https://player.smashy.stream/tv/${id}?s=${selectedSeason}&e=${selectedEpisode}&autoplay=1`;
                case 10: return `https://vidsrc.wtf/api/3/tv/?id=${id}&s=${selectedSeason}&e=${selectedEpisode}&autoplay=1`;
                default: return '';
            }
        }
    };

    const servers = [
        { id: 4, label: 'S4 - Recommended' }, // Moved default recommended to first in array for TV logic
        { id: 1, label: 'S1' },
        { id: 2, label: 'S2' },
        { id: 3, label: 'S3' },
        { id: 5, label: 'S5-indian' },
        { id: 6, label: 'S6' },
        { id: 7, label: 'S7-hindi dubbed' },
        { id: 8, label: 'S8' },
        { id: 9, label: 'S9' },
        { id: 10, label: 'S10' }
    ];

    const handleNextEpisode = useCallback(() => {
        if (type !== 'tv') return;
        const currentSeasonEps = seasonData?.episodes?.length || 0;
        if (selectedEpisode < currentSeasonEps) {
            setSelectedEpisode(prev => prev + 1);
        } else {
            const nextSeason = detail?.seasons?.find(s => s.season_number === selectedSeason + 1);
            if (nextSeason) {
                setSelectedSeason(selectedSeason + 1);
                setSelectedEpisode(1);
            }
        }
    }, [type, selectedEpisode, seasonData, detail, selectedSeason]);

    const hasNextEpisode = useMemo(() => {
        if (type !== 'tv') return false;
        const currentSeasonEps = seasonData?.episodes?.length || 0;
        if (selectedEpisode && selectedEpisode < currentSeasonEps) return true;
        return detail?.seasons?.some(s => s.season_number === selectedSeason + 1);
    }, [type, selectedEpisode, seasonData, detail, selectedSeason]);

    // ── TV Navigation Helpers ─────────────────────────────
    const focusSection = useCallback((section, idx = 0) => {
        setActiveSection(section);
        setTimeout(() => {
            let el = null;
            if (section === 'player') el = bridgeRef.current || playerRef.current;
            else if (section === 'servers') { setServerIdx(idx); el = serverRefs.current[idx]; }
            else if (section === 'seasons') el = seasonRef.current;
            else if (section === 'episodes') { setEpisodeIdx(idx); el = episodeRefs.current[idx]; }
            else if (section === 'similar') { setSimilarIdx(idx); el = similarRefs.current[idx]; }
            else if (section === 'next-ep') el = nextEpRef.current;

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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 0);
    }, []);

    const handleEntryAnchorFocus = useCallback(() => {
        if (isTVSize()) focusSection('player');
    }, [focusSection]);

    // Ensure focus moves to iframe AFTER the bridge button is removed from DOM
    useEffect(() => {
        if (isInteracting && iframeRef.current) {
            const timer = setTimeout(() => {
                iframeRef.current.focus();
                try { iframeRef.current.click(); } catch(e) {}
            }, 50); // Small buffer for DOM stability
            return () => clearTimeout(timer);
        }
    }, [isInteracting]);

    // Handle Fullscreen Exit
    useEffect(() => {
        const handleFS = () => {
            if (!document.fullscreenElement && isInteracting) {
                setIsInteracting(false);
                setTimeout(() => bridgeRef.current?.focus(), 150);
            }
        };
        document.addEventListener('fullscreenchange', handleFS);
        document.addEventListener('webkitfullscreenchange', handleFS);
        return () => {
            document.removeEventListener('fullscreenchange', handleFS);
            document.removeEventListener('webkitfullscreenchange', handleFS);
        };
    }, [isInteracting]);

    const handlePageKeyDown = useCallback((e) => {
        if (!isTVSize()) return;

        // If we are currently interacting with the player iframe, 
        // we MUST let the browser's native key handling take over
        // so that arrows can reach the internal play buttons (like Tab does).
        // We only catch the Back/Escape key to pull focus out.
        if (isInteracting && e.key !== 'Escape' && e.key !== 'Backspace' && e.key !== 'Back') {
            return;
        }

        const navbar = document.getElementById('tv-navbar');
        // If focus is in navbar, only allow ArrowDown to pass through if NOT in a dropdown
        if (navbar && navbar.contains(e.target)) {
            const isDropdown = e.target.closest('.nav-dropdown');
            if (e.key === 'ArrowDown' && !isDropdown) {
                // fall through to activeSection === null handler
            } else {
                return;
            }
        }

        const key = e.key;

        if (key === 'Escape' || key === 'Backspace' || key === 'Back') {
            e.preventDefault();
            if (activeSection === 'player' || isInteracting) {
                focusSection('servers', 0);
            } else {
                focusNavbar();
            }
            return;
        }

        // ── Navbar focused ──
        if (activeSection === null) {
            if (key === 'ArrowDown') { e.preventDefault(); focusSection('player'); }
            return;
        }

        // ── Player focused ──
        if (activeSection === 'player') {
            if (key === 'ArrowDown') { e.preventDefault(); focusSection('servers', 0); }
            else if (key === 'ArrowUp') { e.preventDefault(); focusNavbar(); }
            else if (key === 'ArrowRight' && type === 'tv') { e.preventDefault(); focusSection('seasons'); }
            else if (key === 'ArrowRight' && type === 'movie' && recommendations?.length > 0) { e.preventDefault(); focusSection('similar', 0); }
            // Note: Enter is NOT handled here anymore. 
            // We let the browser natively trigger the onClick of the bridge button.
            return;
        }

        // ── Servers focused ──
        if (activeSection === 'servers') {
            if (key === 'ArrowLeft') {
                e.preventDefault();
                const n = serverIdx > 0 ? serverIdx - 1 : servers.length - 1;
                focusSection('servers', n);
            } else if (key === 'ArrowRight') {
                e.preventDefault();
                const n = (serverIdx + 1) % servers.length;
                focusSection('servers', n);
                // Also jump to seasons if user intentionally moved past the last server? 
                // No, wraparound is better per request.
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                focusSection('player');
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (hasNextEpisode) focusSection('next-ep');
                else if (recommendations?.length > 0) focusSection('similar', 0);
            } else if (key === 'Enter') {
                e.preventDefault();
                setSelectedServer(servers[serverIdx].id);
            }
            return;
        }

        // ── Next Episode focused ──
        if (activeSection === 'next-ep') {
            if (key === 'ArrowUp') { e.preventDefault(); focusSection('servers', 0); }
            else if (key === 'ArrowDown') { e.preventDefault(); if (recommendations?.length > 0) focusSection('similar', 0); }
            else if (key === 'ArrowRight' && type === 'tv') { e.preventDefault(); focusSection('episodes', 0); }
            else if (key === 'Enter') { e.preventDefault(); handleNextEpisode(); }
            return;
        }

        // ── Seasons dropdown focused ──
        if (activeSection === 'seasons') {
            if (key === 'ArrowLeft') { e.preventDefault(); focusSection('player'); }
            else if (key === 'ArrowDown') { e.preventDefault(); if (seasonData?.episodes?.length > 0) focusSection('episodes', 0); }
            else if (key === 'ArrowUp') { e.preventDefault(); focusNavbar(); }
            return;
        }

        // ── Episodes list focused ──
        if (activeSection === 'episodes') {
            if (key === 'ArrowLeft') { e.preventDefault(); focusSection('servers', 0); }
            else if (key === 'ArrowUp') {
                e.preventDefault();
                if (episodeIdx > 0) focusSection('episodes', episodeIdx - 1);
                else focusSection('seasons');
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (episodeIdx < (seasonData?.episodes?.length || 0) - 1) focusSection('episodes', episodeIdx + 1);
                else if (recommendations?.length > 0) focusSection('similar', 0);
            } else if (key === 'Enter') {
                e.preventDefault();
                setSelectedEpisode(seasonData.episodes[episodeIdx].episode_number);
            }
            return;
        }

        // ── Similar Movies focused ──
        if (activeSection === 'similar') {
            const COLS = 2; // Recommendations are in a sidebar/list, usually narrower
            if (key === 'ArrowUp') {
                e.preventDefault();
                if (type === 'tv') focusSection('episodes', (seasonData?.episodes?.length || 0) - 1);
                else focusSection('servers', 0);
            } else if (key === 'ArrowLeft') {
                e.preventDefault();
                if (type === 'tv') focusSection('servers', 0);
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (similarIdx < recommendations.length - 1) focusSection('similar', similarIdx + 1);
            } else if (key === 'Enter') {
                e.preventDefault();
                navigate(`/${type}/${recommendations[similarIdx].id}`);
            }
            return;
        }

    }, [activeSection, serverIdx, episodeIdx, similarIdx, servers, recommendations, type, hasNextEpisode, handleNextEpisode, focusSection, focusNavbar, seasonData, navigate]);

    // Cleanup refs on unmount
    useEffect(() => {
        return () => {
            serverRefs.current = [];
            episodeRefs.current = [];
            similarRefs.current = [];
        };
    }, []);

    if (isDetailLoading) return <div className="loader-main"><Loader2 className="animate-spin" size={48} color="#fdd835" /></div>;
    if (!detail) return <div className="loader-main">Error loading player.</div>;

    const title = detail.title || detail.name;
    const cast = detail.credits?.cast?.slice(0, 8).map(c => c.name).join(', ');

    return (
        <div className="page-wrapper" onKeyDown={handlePageKeyDown}>
            <Navbar />

            {/* Hidden anchor for Top Nav to jump into page content */}
            <div
                id="tv-grid-focus-anchor"
                tabIndex={isTVSize() ? 0 : -1}
                onFocus={handleEntryAnchorFocus}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                aria-hidden="true"
            />
            
            <div className="watch-layout">
                {/* Left Side: Player & Servers */}
                <div className="watch-left">
                    <div 
                        ref={playerRef}
                        className="player-container-main"
                    >
                        {type === 'tv' && !selectedEpisode ? (
                            <div className="player-placeholder">
                                <Play size={48} className="text-yellow-500 mb-4" />
                                <h3>Select an episode to start watching</h3>
                                <p>Season {selectedSeason} is ready</p>
                            </div>
                        ) : (
                            <iframe
                                ref={iframeRef}
                                key={`${selectedServer}-${id}-${selectedSeason}-${selectedEpisode}`}
                                src={getIframeSrc()}
                                title="Video Player"
                                className="watch-iframe"
                                allow="autoplay; fullscreen"
                                allowFullScreen
                                role="button"
                                aria-label="Play Movie"
                            ></iframe>
                        )}
                        {/* Transparent Bridge: catches the real click */}
                        {isTVSize() && !isInteracting && (
                            <button
                                ref={bridgeRef}
                                className="tv-interaction-bridge"
                                onFocus={() => setActiveSection('player')}
                                onBlur={(e) => {
                                    // If focus is leaving the bridge area and NOT going to the iframe
                                    if (!playerRef.current?.contains(e.relatedTarget) && e.relatedTarget !== null) {
                                        setIsInteracting(false);
                                    }
                                }}
                                onClick={() => {
                                    setIsInteracting(true);
                                    // Auto-fullscreen for main player
                                    const container = iframeRef.current?.parentElement;
                                    if (container?.requestFullscreen) {
                                        container.requestFullscreen().catch(() => {});
                                    }
                                }}
                                aria-label="Play video"
                            />
                        )}

                        {/* Overlay to catch focus interaction on TV */}
                        {isTVSize() && activeSection === 'player' && !isInteracting && (
                            <div className="tv-player-overlay">
                                <p>Press <span>OK / Enter</span> to Play</p>
                                <p>Use <span>Arrows</span> to control UI</p>
                            </div>
                        )}
                    </div>

                    <div className="watch-controls-bar">
                        <div className="server-selection">
                            <div className="server-header">
                                <Server size={18} color="#fdd835" />
                                <span>Select Server</span>
                            </div>
                            <div className="server-buttons-list">
                                {servers.map((server, idx) => (
                                    <button
                                        key={server.id}
                                        ref={el => serverRefs.current[idx] = el}
                                        tabIndex={isTVSize() ? -1 : 0}
                                        onFocus={() => { if(isTVSize()) { setActiveSection('servers'); setServerIdx(idx); } }}
                                        className={`server-btn ${selectedServer === server.id ? 'active' : ''} ${activeSection === 'servers' && serverIdx === idx && isTVSize() ? 'server-btn--tv-focused' : ''}`}
                                        onClick={() => setSelectedServer(server.id)}
                                    >
                                        {server.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {type === 'tv' && hasNextEpisode && (
                            <button 
                                ref={nextEpRef}
                                tabIndex={isTVSize() ? -1 : 0}
                                onFocus={() => isTVSize() && setActiveSection('next-ep')}
                                className={`btn-next-ep ${activeSection === 'next-ep' && isTVSize() ? 'btn-next-ep--tv-focused' : ''}`} 
                                onClick={handleNextEpisode}
                            >
                                <span>Next Episode</span>
                                <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Side: Options & Details */}
                <div className="watch-right">
                    <div className="watch-meta">
                        <div className="breadcrumbs">
                            <Link to="/">Home</Link> / 
                            <Link to={`/${type}/${id}`}>{title}</Link> / 
                            <span>Watch</span>
                        </div>
                        <h1 className="watch-title">{title}</h1>
                        {type === 'tv' && selectedEpisode && (
                            <p className="watch-subtitle">S{selectedSeason} E{selectedEpisode}</p>
                        )}
                    </div>

                    {type === 'tv' && (
                        <div className="episode-selector-container">
                            <div className="selector-header">
                                <h3>Seasons</h3>
                                <select 
                                    ref={seasonRef}
                                    tabIndex={isTVSize() ? -1 : 0}
                                    onFocus={() => isTVSize() && setActiveSection('seasons')}
                                    className={`season-dropdown ${activeSection === 'seasons' && isTVSize() ? 'season-dropdown--tv-focused' : ''}`}
                                    value={selectedSeason}
                                    onChange={(e) => {
                                        setSelectedSeason(parseInt(e.target.value));
                                        setSelectedEpisode(null);
                                    }}
                                >
                                    {detail.seasons?.filter(s => s.season_number !== 0).map(s => (
                                        <option key={s.id} value={s.season_number}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="episodes-scroll-list">
                                {isSeasonLoading ? (
                                    <div className="mini-loader"><Loader2 className="animate-spin" size={24} /></div>
                                ) : (
                                    seasonData?.episodes?.map((ep, idx) => (
                                        <div 
                                            key={ep.id}
                                            ref={el => episodeRefs.current[idx] = el}
                                            tabIndex={isTVSize() ? -1 : 0}
                                            onFocus={() => { if(isTVSize()) { setActiveSection('episodes'); setEpisodeIdx(idx); } }}
                                            className={`episode-item ${selectedEpisode === ep.episode_number ? 'active' : ''} ${activeSection === 'episodes' && episodeIdx === idx && isTVSize() ? 'episode-item--tv-focused' : ''}`}
                                            onClick={() => setSelectedEpisode(ep.episode_number)}
                                        >
                                            <div className="ep-num">E{ep.episode_number}</div>
                                            <div className="ep-info">
                                                <div className="ep-name">{ep.name}</div>
                                                <div className="ep-date">{ep.air_date}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="watch-cast">
                        <h3>Cast</h3>
                        <p>{cast || 'N/A'}</p>
                    </div>

                    <div className="watch-similar">
                        <h3>Recommended for You</h3>
                        <div className="similar-list" style={{ minHeight: '300px' }}>
                            {isRecLoading ? (
                                <div className="loader-container-small">
                                    <Loader2 className="animate-spin" size={24} color="#fdd835" />
                                </div>
                            ) : (
                                recommendations?.map((movie, idx) => (
                                    <Link 
                                        key={movie.id} 
                                        ref={el => similarRefs.current[idx] = el}
                                        to={`/${type}/${movie.id}`}
                                        tabIndex={isTVSize() ? -1 : 0}
                                        onFocus={() => { if(isTVSize()) { setActiveSection('similar'); setSimilarIdx(idx); } }}
                                        className={`similar-card ${activeSection === 'similar' && similarIdx === idx && isTVSize() ? 'similar-card--tv-focused' : ''}`}
                                    >
                                        <img 
                                            src={movieApi.getImageUrl(movie.poster_path, 'w200')} 
                                            alt={movie.title || movie.name} 
                                            loading="lazy"
                                        />
                                        <div className="similar-info">
                                            <p>{movie.title || movie.name}</p>
                                            <span>{movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0]}</span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WatchPage;
