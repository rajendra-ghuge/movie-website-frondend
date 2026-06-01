import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, ChevronLeft, ChevronRight, Server, ChevronDown } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';
import Disclaimer from '../components/Disclaimer';

const FALLBACK_DEFAULT_SERVER = 11;

/* ─────────────────────────────────────────────────────────
 * TV keyboard navigation only active on laptop / TV (≥ 1024px).
 * Mobile layout & behaviour are completely unchanged.
 * ───────────────────────────────────────────────────────── */
const isTVSize = () => {
    if (typeof window === 'undefined') return false;
    const isTVUA = /TV|LargeScreen|AndroidTV|SmartTV/i.test(navigator.userAgent);
    return window.innerWidth >= 1024 || isTVUA;
};

const isConfirmKey = (e) => (
    e.key === 'Enter' ||
    e.key === 'Select' ||
    e.key === 'Ok' ||
    e.key === 'OK' ||
    e.key === 'Accept' ||
    e.key === 'Center' ||
    e.key === 'DPadCenter' ||
    e.keyCode === 13 ||
    e.keyCode === 23 ||
    e.keyCode === 66 ||
    e.which === 13 ||
    e.which === 23 ||
    e.which === 66
);

const WatchPage = () => {
    const { type, id, season: sParam, episode: eParam } = useParams();
    const navigate = useNavigate();

    // UI State
    const [selectedServer, setSelectedServer] = useState(FALLBACK_DEFAULT_SERVER);
    const [selectedSeason, setSelectedSeason] = useState(parseInt(sParam) || 1);
    const [selectedEpisode, setSelectedEpisode] = useState(parseInt(eParam) || (type === 'tv' ? 1 : null));

    // TV Navigation State
    const [activeSection, setActiveSection] = useState(null); // null = navbar
    const [serverIdx, setServerIdx] = useState(0);
    const [episodeIdx, setEpisodeIdx] = useState(0);
    const [similarIdx, setSimilarIdx] = useState(0);
    const [isInteracting, setIsInteracting] = useState(false);
    const [isServersOpen, setIsServersOpen] = useState(isTVSize());
    const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false);
    const [focusedSeasonIdx, setFocusedSeasonIdx] = useState(0);
    const [isMobilePlayerDocked, setIsMobilePlayerDocked] = useState(false);
    const [playerSpacerHeight, setPlayerSpacerHeight] = useState(0);
    const [navHeight, setNavHeight] = useState(50);
    const [isIframeLoading, setIsIframeLoading] = useState(true);

    const playerAnchorRef = useRef(null);
    const playerRef = useRef(null);
    const bridgeRef = useRef(null);
    const iframeRef = useRef(null);
    const serverHeaderRef = useRef(null);
    const serverRefs = useRef([]);
    const seasonRef = useRef(null);
    const seasonOptionRefs = useRef([]);
    const nextEpRef = useRef(null);
    const episodeRefs = useRef([]);
    const similarRefs = useRef([]);
    const hasUserSelectedServerRef = useRef(false);

    // ── Data Fetching ──────────────────────────────────────
    const { data: detail, isLoading: isDetailLoading } = useQuery({
        queryKey: ['detail', type, id],
        queryFn: async () => {
            // Matches the append_to_response used in MovieDetailPage so both pages
            // share the same React Query cache entry without stale-field mismatches.
            const params = { append_to_response: 'videos,credits,external_ids' };
            const res = type === 'movie'
                ? await movieApi.getMovie(id, params)
                : await movieApi.getTvDetail(id, params);
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
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

    // Reset scroll position on navigation
    useEffect(() => {
        window.scrollTo(0, 0);
        setIsMobilePlayerDocked(false);
    }, [type, id, selectedEpisode]);

    useEffect(() => {
        setIsIframeLoading(true);
    }, [selectedServer, id, selectedSeason, selectedEpisode]);

    useEffect(() => {
        const updateMobileDock = () => {
            if (!playerRef.current || !playerAnchorRef.current || window.innerWidth >= 1024) {
                setIsMobilePlayerDocked(false);
                return;
            }

            const navbar = document.getElementById('tv-navbar');
            const measuredNavHeight = navbar?.getBoundingClientRect().height || 50;
            const playerHeight = playerRef.current.getBoundingClientRect().height;
            const anchorTop = playerAnchorRef.current.getBoundingClientRect().top;

            const shouldDock = anchorTop <= measuredNavHeight;

            setNavHeight(measuredNavHeight);
            setPlayerSpacerHeight(playerHeight);
            setIsMobilePlayerDocked(shouldDock);
        };

        updateMobileDock();
        window.addEventListener('scroll', updateMobileDock, { passive: true });
        window.addEventListener('resize', updateMobileDock);

        return () => {
            window.removeEventListener('scroll', updateMobileDock);
            window.removeEventListener('resize', updateMobileDock);
        };
    }, []);

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

    const { data: serverConfig } = useQuery({
        queryKey: ['server-config'],
        queryFn: movieApi.getServerConfig,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const servers = useMemo(() => serverConfig?.servers || [], [serverConfig]);

    useEffect(() => {
        if (!serverConfig || hasUserSelectedServerRef.current) return;

        const defaultServer = Number(serverConfig.default_server || FALLBACK_DEFAULT_SERVER);
        const hasDefaultServer = servers.some(server => server.id === defaultServer);
        setSelectedServer(hasDefaultServer ? defaultServer : FALLBACK_DEFAULT_SERVER);
    }, [serverConfig, servers]);

    // Memoized so it only recalculates when player dependencies change,
    // not on every scroll/focus re-render.
    const iframeSrc = useMemo(() => {
        if (!serverConfig) return '';
        if (type === 'tv' && !selectedEpisode) return '';

        let template = type === 'movie'
            ? serverConfig.movie[selectedServer]
            : serverConfig.tv[selectedServer];

        if (!template) return '';

        return template
            .replace('{id}', id)
            .replace('{slug}', slug)
            .replace('{s}', selectedSeason)
            .replace('{e}', selectedEpisode);
    }, [serverConfig, type, selectedServer, id, slug, selectedSeason, selectedEpisode]);

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

    const availableSeasons = useMemo(() => {
        return detail?.seasons?.filter(s => s.season_number !== 0) || [];
    }, [detail]);

    const currentSeasonIdx = useMemo(() => {
        return Math.max(0, availableSeasons.findIndex(s => s.season_number === selectedSeason));
    }, [availableSeasons, selectedSeason]);

    const openSeasonMenu = useCallback(() => {
        const nextIdx = currentSeasonIdx >= 0 ? currentSeasonIdx : 0;
        setIsSeasonMenuOpen(true);
        setFocusedSeasonIdx(nextIdx);
        setTimeout(() => {
            seasonOptionRefs.current[nextIdx]?.focus();
        }, 0);
    }, [currentSeasonIdx]);

    const closeSeasonMenu = useCallback(() => {
        setIsSeasonMenuOpen(false);
        setTimeout(() => seasonRef.current?.focus(), 0);
    }, []);

    const selectSeason = useCallback((seasonNumber) => {
        setSelectedSeason(seasonNumber);
        setSelectedEpisode(null);
        setIsSeasonMenuOpen(false);
        setTimeout(() => seasonRef.current?.focus(), 0);
    }, []);

    // ── TV Navigation Helpers ─────────────────────────────
    const focusSection = useCallback((section, idx = 0) => {
        setActiveSection(section);
        setTimeout(() => {
            let el = null;
            if (section === 'player') el = bridgeRef.current || playerRef.current;
            else if (section === 'server-header') el = serverHeaderRef.current;
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
        // Broadcast to the global scope so Navbar can ignore key events while player is active
        window.__tvPlayerActive = isInteracting;
        if (isInteracting && iframeRef.current) {
            const timer = setTimeout(() => {
                iframeRef.current.focus();
                try { iframeRef.current.click(); } catch { /* Some TV browsers block programmatic iframe clicks. */ }
            }, 50); // Small buffer for DOM stability
            return () => {
                clearTimeout(timer);
                window.__tvPlayerActive = false;
            };
        }
        return () => { window.__tvPlayerActive = false; };
    }, [isInteracting]);


    // Sticky player logic removed; relying on native CSS position: sticky instead for better performance and reliability.

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

        let key = e.key;

        const navbar = document.getElementById('tv-navbar');
        // If focus is in navbar, only allow ArrowDown to pass through if NOT in a dropdown
        if (navbar && navbar.contains(e.target)) {
            const isDropdown = e.target.closest('.nav-dropdown');
            if (key === 'ArrowDown' && !isDropdown) {
                // fall through to activeSection === null handler
            } else {
                return;
            }
        }

        if (key === 'Escape' || key === 'Backspace' || key === 'Back') {
            e.preventDefault();
            if (isSeasonMenuOpen) {
                closeSeasonMenu();
            } else if (activeSection === 'player' || isInteracting) {
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
            if (key === 'ArrowDown') { e.preventDefault(); focusSection('server-header'); }
            else if (key === 'ArrowUp') { e.preventDefault(); focusNavbar(); }
            else if (key === 'ArrowRight' && type === 'tv') { e.preventDefault(); focusSection('seasons'); }
            else if (key === 'ArrowRight' && type === 'movie' && recommendations?.length > 0) { e.preventDefault(); focusSection('similar', 0); }
            // Note: Enter is NOT handled here anymore.
            // We let the browser natively trigger the onClick of the bridge button.
            return;
        }

        // ── Server Header focused ──
        if (activeSection === 'server-header') {
            if (key === 'ArrowDown') {
                e.preventDefault();
                focusSection('servers', 0);
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                focusSection('player');
            } else if (isConfirmKey(e)) {
                if (!isTVSize()) {
                    e.preventDefault();
                    setIsServersOpen(!isServersOpen);
                }
            }
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
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                focusSection('server-header');
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (hasNextEpisode) focusSection('next-ep');
                else if (recommendations?.length > 0) focusSection('similar', 0);
            } else if (isConfirmKey(e)) {
                e.preventDefault();
                hasUserSelectedServerRef.current = true;
                setSelectedServer(servers[serverIdx].id);
            }
            return;
        }

        // ── Next Episode focused ──
        if (activeSection === 'next-ep') {
            if (key === 'ArrowUp') { e.preventDefault(); focusSection('servers', 0); }
            else if (key === 'ArrowDown') { e.preventDefault(); if (recommendations?.length > 0) focusSection('similar', 0); }
            else if (key === 'ArrowRight' && type === 'tv') { e.preventDefault(); focusSection('episodes', 0); }
            // Let the global main.jsx handler trigger the click for Enter keys to avoid double trigger
            return;
        }


        // ── Seasons dropdown focused ──
        if (activeSection === 'seasons') {
            if (isSeasonMenuOpen) {
                if (key === 'ArrowUp') {
                    e.preventDefault();
                    const nextIdx = focusedSeasonIdx > 0 ? focusedSeasonIdx - 1 : availableSeasons.length - 1;
                    setFocusedSeasonIdx(nextIdx);
                    seasonOptionRefs.current[nextIdx]?.focus();
                } else if (key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIdx = (focusedSeasonIdx + 1) % availableSeasons.length;
                    setFocusedSeasonIdx(nextIdx);
                    seasonOptionRefs.current[nextIdx]?.focus();
                } else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Escape' || key === 'Backspace' || key === 'Back') {
                    e.preventDefault();
                    closeSeasonMenu();
                } else if (isConfirmKey(e)) {
                    e.preventDefault();
                    const season = availableSeasons[focusedSeasonIdx];
                    if (season) selectSeason(season.season_number);
                }
                return;
            }

            if (key === 'ArrowLeft') {
                // Go back to player
                e.preventDefault();
                focusSection('player');
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                focusNavbar();
            } else if (key === 'ArrowDown') {
                e.preventDefault();
                if (seasonData?.episodes?.length > 0) focusSection('episodes', 0);
            } else if (isConfirmKey(e) || key === 'Enter') {
                e.preventDefault();
                openSeasonMenu();
            } else if (key === 'ArrowRight') {
                // Jump straight to episodes
                e.preventDefault();
                if (seasonData?.episodes?.length > 0) focusSection('episodes', 0);
            }
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
            } else if (isConfirmKey(e)) {
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
            } else if (isConfirmKey(e)) {
                e.preventDefault();
                navigate(`/${type}/${recommendations[similarIdx].id}`);
            }
            return;
        }

    }, [activeSection, serverIdx, episodeIdx, similarIdx, servers, recommendations, type, hasNextEpisode, handleNextEpisode, focusSection, focusNavbar, seasonData, navigate, availableSeasons, isSeasonMenuOpen, focusedSeasonIdx, openSeasonMenu, closeSeasonMenu, selectSeason, isInteracting, isServersOpen]);


    // Cleanup refs on unmount
    useEffect(() => {
        return () => {
            serverRefs.current = [];
            seasonOptionRefs.current = [];
            episodeRefs.current = [];
            similarRefs.current = [];
        };
    }, []);

    // Only show a hard loading screen when there is truly NO data at all.
    // When cached data exists (background refetch), render immediately with it.
    if (isDetailLoading && !detail) return <div className="loader-main"><Loader2 className="animate-spin" size={48} color="#fdd835" /></div>;
    if (!detail) return <div className="loader-main">Error loading player.</div>;

    const title = detail.title || detail.name;
    const cast = detail.credits?.cast?.slice(0, 8).map(c => c.name).join(', ');

    // Compute once per render — avoids calling window.innerWidth + UA check ~25 times in JSX loops.
    const tvMode = isTVSize();

    return (
        <div className="page-wrapper" onKeyDown={handlePageKeyDown}>
            <Navbar />

            {/* Hidden anchor for Top Nav to jump into page content */}
            <div
                id="tv-grid-focus-anchor"
                tabIndex={tvMode ? 0 : -1}
                onFocus={handleEntryAnchorFocus}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                aria-hidden="true"
            />

            <div className="watch-layout">
                {/* Left Side: Player & Servers */}
                <div className="watch-left">
                    <div ref={playerAnchorRef} className="player-mobile-anchor" aria-hidden="true" />
                    {isMobilePlayerDocked && (
                        <div
                            className="player-mobile-spacer"
                            style={{ height: `${playerSpacerHeight}px` }}
                            aria-hidden="true"
                        />
                    )}
                    <div
                        ref={playerRef}
                        className={`player-container-main ${activeSection === 'player' ? 'player-container-main--tv-focused' : ''} ${isMobilePlayerDocked ? 'is-mobile-docked' : ''}`}
                        style={isMobilePlayerDocked ? { top: `${navHeight - 1}px` } : {}}
                    >
                        {type === 'tv' && !selectedEpisode ? (
                            <div className="player-placeholder">
                                <Play size={48} className="text-yellow-500 mb-4" />
                                <h3>Select an episode to start watching</h3>
                                <p>Season {selectedSeason} is ready</p>
                            </div>
                        ) : (
                            <>
                                {isIframeLoading && (
                                    <div className="player-shimmer shimmer-wrapper" aria-hidden="true" />
                                )}
                                <iframe
                                    ref={iframeRef}
                                    key={`${selectedServer}-${id}-${selectedSeason}-${selectedEpisode}`}
                                    src={iframeSrc}
                                    title="Video Player"
                                    className="watch-iframe"
                                    style={{ opacity: isIframeLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
                                    allow="autoplay; fullscreen"
                                    allowFullScreen
                                    role="button"
                                    aria-label="Play Movie"
                                    onLoad={() => setIsIframeLoading(false)}
                                ></iframe>
                            </>
                        )}
                        {/* Transparent Bridge: catches the real click */}
                        {tvMode && !isInteracting && (
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
                                        container.requestFullscreen().catch(() => { });
                                    }
                                }}
                                aria-label="Play video"
                            />
                        )}

                    </div>

                    <div className="watch-controls-bar">
                        <div className={`server-selection ${isServersOpen ? 'is-open' : ''}`}>
                            <div
                                ref={serverHeaderRef}
                                tabIndex={isTVSize() ? 0 : -1}
                                className={`server-header ${activeSection === 'server-header' ? 'server-header--tv-focused' : ''}`}
                                onFocus={() => { if (isTVSize()) setActiveSection('server-header'); }}
                                onClick={() => !isTVSize() && setIsServersOpen(!isServersOpen)}
                                style={{ cursor: isTVSize() ? 'default' : 'pointer' }}
                            >
                                <div className="header-left">
                                    <Server size={18} color="#fdd835" />
                                    <span>Select Server</span>
                                </div>
                                {!tvMode && (
                                    <ChevronDown
                                        size={20}
                                        className={`toggle-icon ${isServersOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </div>

                            {/* Always show on TV/Desktop, toggle on Mobile */}
                            {(tvMode || isServersOpen) && (
                                <div className="server-buttons-list">
                                    {servers.map((server, idx) => (
                                        <button
                                            key={server.id}
                                            ref={el => serverRefs.current[idx] = el}
                                            tabIndex={tvMode ? -1 : 0}
                                            onFocus={() => { if (tvMode) { setActiveSection('servers'); setServerIdx(idx); } }}
                                            className={`server-btn ${selectedServer === server.id ? 'active' : ''} ${activeSection === 'servers' && serverIdx === idx && tvMode ? 'server-btn--tv-focused' : ''}`}
                                            onClick={() => {
                                                hasUserSelectedServerRef.current = true;
                                                setSelectedServer(server.id);
                                                if (!tvMode) setIsServersOpen(false);
                                            }}
                                        >
                                            {server.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {type === 'tv' && hasNextEpisode && (
                            <button
                                ref={nextEpRef}
                                tabIndex={tvMode ? -1 : 0}
                                onFocus={() => tvMode && setActiveSection('next-ep')}
                                className={`btn-next-ep ${activeSection === 'next-ep' && tvMode ? 'btn-next-ep--tv-focused' : ''}`}
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
                                {/* Custom selector driven by D-Pad and Mouse Clicks */}
                                <div
                                    ref={seasonRef}
                                    tabIndex={isTVSize() ? -1 : 0}
                                    onFocus={() => setActiveSection('seasons')}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (isSeasonMenuOpen) {
                                            closeSeasonMenu();
                                        } else {
                                            openSeasonMenu();
                                        }
                                    }}
                                    className={`season-tv-selector ${activeSection === 'seasons' ? 'season-dropdown--tv-focused' : ''} ${isSeasonMenuOpen ? 'is-open' : ''}`}
                                    aria-label={`Season ${selectedSeason}`}
                                    aria-expanded={isSeasonMenuOpen}
                                    role="button"
                                >
                                    <ChevronLeft size={16} className="season-tv-arrow" />
                                    <span className="season-tv-label">
                                        {detail.seasons?.find(s => s.season_number === selectedSeason)?.name || `Season ${selectedSeason}`}
                                    </span>
                                    <ChevronDown size={16} className="season-tv-arrow" />
                                    {isSeasonMenuOpen && (
                                        <div className="season-tv-menu" role="listbox">
                                            {availableSeasons.map((season, idx) => (
                                                <button
                                                    key={season.id}
                                                    ref={el => { seasonOptionRefs.current[idx] = el; }}
                                                    type="button"
                                                    tabIndex={-1}
                                                    className={`season-tv-option ${selectedSeason === season.season_number ? 'active' : ''} ${focusedSeasonIdx === idx ? 'focused' : ''}`}
                                                    onFocus={() => setFocusedSeasonIdx(idx)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectSeason(season.season_number);
                                                    }}
                                                    role="option"
                                                    aria-selected={selectedSeason === season.season_number}
                                                >
                                                    {season.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="episodes-scroll-list">
                                {isSeasonLoading ? (
                                    <div className="mini-loader"><Loader2 className="animate-spin" size={24} /></div>
                                ) : (
                                    seasonData?.episodes?.map((ep, idx) => (
                                        <div
                                            key={ep.id}
                                            ref={el => episodeRefs.current[idx] = el}
                                            tabIndex={tvMode ? -1 : 0}
                                            onFocus={() => { if (tvMode) { setActiveSection('episodes'); setEpisodeIdx(idx); } }}
                                            className={`episode-item ${selectedEpisode === ep.episode_number ? 'active' : ''} ${activeSection === 'episodes' && episodeIdx === idx && tvMode ? 'episode-item--tv-focused' : ''}`}
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
                        <div className="similar-list">
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
                                        tabIndex={tvMode ? -1 : 0}
                                        onFocus={() => { if (tvMode) { setActiveSection('similar'); setSimilarIdx(idx); } }}
                                        className={`similar-card ${activeSection === 'similar' && similarIdx === idx && tvMode ? 'similar-card--tv-focused' : ''}`}
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
            <footer className="footer" style={{ marginTop: '4rem', marginBottom: '2rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved &bull; <Disclaimer /></p>
            </footer>
        </div>
    );
};

export default WatchPage;
