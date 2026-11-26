import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, ChevronLeft, ChevronRight, Server, ChevronDown, Download, X, RefreshCw } from 'lucide-react';
import { movieApi, serialsApi, DEFAULT_CONFIG } from '../api';
import Navbar from '../components/Navbar';
import Disclaimer from '../components/Disclaimer';
import DownloadModal from '../components/DownloadModal';

const FALLBACK_DEFAULT_SERVER = 1;

/* ─────────────────────────────────────────────────────────
 * TV keyboard navigation only active on laptop / TV (≥ 1024px).
 * Mobile layout & behaviour are completely unchanged.
 * ───────────────────────────────────────────────────────── */
const isTVSize = () => {
    if (typeof window === 'undefined') return false;
    return /TV|LargeScreen|AndroidTV|SmartTV/i.test(navigator.userAgent);
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
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: serverConfig } = useQuery({
        queryKey: ['server-config'],
        queryFn: movieApi.getServerConfig,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
    const isSerialsEnabled = serverConfig?.Enable_serials ?? serverConfig?.enable_serials ?? serverConfig?.enable_serial ?? DEFAULT_CONFIG.Enable_serials ?? true;

    const isSerial = type === 'serial';
    const targetSeason = parseInt(sParam) || null;
    const targetEpisode = parseInt(eParam) || (type === 'tv' ? (sParam ? 1 : null) : null);

    // Instant S0 initialization: check if DetailPage already prefetched S0 stream
    const cachedStream = queryClient.getQueryData(['direct-stream', type, id, targetSeason, targetEpisode]);
    const hasCachedStream = Boolean(cachedStream?.success && (cachedStream?.embed_url || cachedStream?.stream_url));

    // UI State: For serials, always start on server 1 (S1)
    const [selectedServer, setSelectedServer] = useState(() => (isSerial ? 1 : (hasCachedStream ? 0 : null)));
    const [selectedSeason, setSelectedSeason] = useState(targetSeason);
    const [selectedEpisode, setSelectedEpisode] = useState(targetEpisode);

    // TV Navigation State
    const [activeSection, setActiveSection] = useState(null); // null = navbar
    const [serverIdx, setServerIdx] = useState(0);
    const [episodeIdx, setEpisodeIdx] = useState(0);
    const [similarIdx, setSimilarIdx] = useState(0);
    const [isInteracting, setIsInteracting] = useState(false);
    const [isServersOpen, setIsServersOpen] = useState(true);
    const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false);
    const [focusedSeasonIdx, setFocusedSeasonIdx] = useState(0);
    const [isMobilePlayerDocked, setIsMobilePlayerDocked] = useState(false);
    const [playerSpacerHeight, setPlayerSpacerHeight] = useState(0);
    const [navHeight, setNavHeight] = useState(50);
    const [isIframeLoading, setIsIframeLoading] = useState(true);
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);

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
    const downloadCloseBtnRef = useRef(null);
    const retryButtonRef = useRef(null);
    const lastInitializedTvIdRef = useRef(null);

    // ── Data Fetching ──────────────────────────────────────
    const { data: detail, isLoading: isDetailLoading, isFetching: isDetailFetching, refetch: refetchDetail } = useQuery({
        queryKey: ['detail', type, id],
        queryFn: async () => {
            if (isSerial) {
                const titleStr = location.state?.title || id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return {
                    title: titleStr,
                    name: titleStr,
                    overview: `Watch latest episodes of ${titleStr} online in HD on 4KHDHUB.`,
                    backdrop_path: null,
                    poster_path: null,
                    genres: [{ id: 1, name: 'TV Serial' }],
                    seasons: [{ id: 1, season_number: 1, name: 'Season 1' }],
                };
            }
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

    useEffect(() => {
        if (!detail && !isDetailLoading) {
            setTimeout(() => retryButtonRef.current?.focus(), 0);
        }
    }, [detail, isDetailLoading]);

    // TV Season query for standard TV shows
    const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
        queryKey: ['tv-season', id, selectedSeason],
        queryFn: async () => {
            if (type !== 'tv' || !selectedSeason) return null;
            const res = await movieApi.getTvSeason(id, selectedSeason);
            return res.data;
        },
        enabled: type === 'tv' && !!selectedSeason
    });

    // Serial episodes state for Regional TV Serials infinite scroll
    const [serialEps, setSerialEps] = useState([]);
    const [hasMoreSerialEps, setHasMoreSerialEps] = useState(false);
    const [nextSerialOffset, setNextSerialOffset] = useState(null);
    const [isLoadingMoreSerials, setIsLoadingMoreSerials] = useState(false);
    const isLoadingMoreSerialsRef = useRef(false);

    // Initial serial episodes query
    const { data: initialSerialData, isLoading: isSerialLoading } = useQuery({
        queryKey: ['serial-episodes', id],
        queryFn: async () => {
            const res = await serialsApi.getShowEpisodes(id, 0);
            return res || { episodes: [], has_more: false, next_offset: null };
        },
        enabled: isSerial && !!id && isSerialsEnabled !== false,
        staleTime: 10 * 60 * 1000,
    });

    // Populate initial serial episodes when query resolves
    useEffect(() => {
        if (initialSerialData) {
            const epList = Array.isArray(initialSerialData)
                ? initialSerialData
                : (initialSerialData.episodes || []);
            setSerialEps(epList);
            setHasMoreSerialEps(Boolean(initialSerialData.has_more));
            setNextSerialOffset(initialSerialData.next_offset || null);
        }
    }, [initialSerialData]);

    // Handler to load more serial episodes on scroll
    const handleLoadMoreSerialEpisodes = useCallback(async () => {
        if (!isSerial || !id || isLoadingMoreSerialsRef.current || !hasMoreSerialEps || nextSerialOffset == null) {
            return;
        }
        isLoadingMoreSerialsRef.current = true;
        setIsLoadingMoreSerials(true);
        try {
            const res = await serialsApi.getShowEpisodes(id, nextSerialOffset, selectedSeason || 1);
            if (res && res.episodes && res.episodes.length > 0) {
                setSerialEps(prev => {
                    const seenUrls = new Set(prev.map(e => e.url));
                    const newEps = res.episodes.filter(e => !seenUrls.has(e.url));
                    return [...prev, ...newEps];
                });
                setHasMoreSerialEps(Boolean(res.has_more));
                setNextSerialOffset(res.next_offset || null);
            } else {
                setHasMoreSerialEps(false);
            }
        } catch (err) {
            console.error('Failed to load more serial episodes:', err);
        } finally {
            isLoadingMoreSerialsRef.current = false;
            setIsLoadingMoreSerials(false);
        }
    }, [isSerial, id, hasMoreSerialEps, nextSerialOffset]);

    // Unified episodes list across TV Series and Serials
    const episodesList = useMemo(() => {
        if (isSerial) {
            return serialEps.map((ep, idx) => {
                const m = ep.url?.match(/season-(\d+)\/(\d+)\/watch/);
                const epNum = m ? parseInt(m[2]) : (serialEps.length - idx);
                const seasonNum = m ? parseInt(m[1]) : 1;
                return {
                    id: ep.url || `ep-${epNum}`,
                    episode_number: epNum,
                    season_number: seasonNum,
                    name: ep.title || `Episode ${epNum}`,
                    air_date: ep.date || 'Recent Episode',
                    url: ep.url,
                };
            });
        }
        return seasonData?.episodes || [];
    }, [isSerial, serialEps, seasonData]);

    // Initialize serial's selected season and episode
    useEffect(() => {
        if (isSerial && episodesList.length > 0 && !selectedEpisode) {
            if (eParam) {
                setSelectedEpisode(parseInt(eParam));
                setSelectedSeason(parseInt(sParam) || 1);
            } else {
                setSelectedEpisode(episodesList[0].episode_number);
                setSelectedSeason(episodesList[0].season_number || 1);
            }
        }
    }, [isSerial, episodesList, selectedEpisode, eParam, sParam]);

    // Reset scroll position and server selection ONLY when navigating to a new movie/show
    const prevMediaIdRef = useRef(id);
    useEffect(() => {
        if (prevMediaIdRef.current !== id) {
            prevMediaIdRef.current = id;
            window.scrollTo(0, 0);
            setIsMobilePlayerDocked(false);
            hasUserSelectedServerRef.current = false;
            if (isSerial) {
                setSelectedServer(1);
                setSerialEps([]);
                setHasMoreSerialEps(false);
                setNextSerialOffset(null);
            } else {
                const currentCached = queryClient.getQueryData(['direct-stream', type, id, selectedSeason, selectedEpisode]);
                const isCurrentCached = Boolean(currentCached?.success && (currentCached?.embed_url || currentCached?.stream_url));
                setSelectedServer(isCurrentCached ? 0 : null);
            }
        }
    }, [id, type, selectedSeason, selectedEpisode, queryClient, isSerial]);

    // Keep URL in sync with active season/episode without triggering router reloads
    useEffect(() => {
        if (isSerial && id && selectedEpisode) {
            const newPath = `/watch/serial/${id}/${selectedSeason || 1}/${selectedEpisode}`;
            if (window.location.pathname !== newPath) {
                window.history.replaceState(null, '', newPath);
            }
        } else if (type === 'tv' && id && selectedSeason && selectedEpisode) {
            const newPath = `/watch/${type}/${id}/${selectedSeason}/${selectedEpisode}`;
            if (window.location.pathname !== newPath) {
                window.history.replaceState(null, '', newPath);
            }
        }
    }, [type, id, selectedSeason, selectedEpisode]);

    useEffect(() => {
        setIsIframeLoading(true);
    }, [selectedServer, id, selectedSeason, selectedEpisode]);

    useEffect(() => {
        if (!isDownloadOpen) return undefined;

        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        downloadCloseBtnRef.current?.focus();

        const handleDownloadEscape = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setIsDownloadOpen(false);
        };

        document.addEventListener('keydown', handleDownloadEscape, true);
        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.removeEventListener('keydown', handleDownloadEscape, true);
        };
    }, [isDownloadOpen]);

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

    // Query direct HLS stream to check if S0 is available for this title/episode
    const { data: directStreamData, isLoading: isStreamLoading } = useQuery({
        queryKey: ['direct-stream', type, id, selectedSeason, selectedEpisode],
        queryFn: async () => {
            const res = await movieApi.getStreamData(type, id, selectedSeason, selectedEpisode);
            return res.data;
        },
        enabled: !isSerial && (type === 'movie' || Boolean(selectedEpisode)),
        staleTime: 5 * 60 * 1000,
    });

    const hasDirectStream = Boolean(!isSerial && directStreamData?.success && (directStreamData?.embed_url || directStreamData?.stream_url));

    // Resolve direct serial embed for Regional TV Serials
    const currentSerialWatchUrl = useMemo(() => {
        if (!isSerial) return '';
        if (location.state?.watchUrl && (!selectedEpisode || selectedEpisode === parseInt(eParam))) {
            return location.state.watchUrl;
        }
        const activeEp = episodesList.find(e => e.episode_number === selectedEpisode);
        if (activeEp?.url) return activeEp.url;
        return `/show/${id}/season-${selectedSeason || 1}/${selectedEpisode || 1}/watch/`;
    }, [isSerial, location.state, episodesList, selectedEpisode, selectedSeason, id, eParam]);

    const { data: serialStreamData, isLoading: isSerialStreamLoading } = useQuery({
        queryKey: ['serial-stream', currentSerialWatchUrl],
        queryFn: async () => {
            if (!currentSerialWatchUrl) return null;
            return await serialsApi.resolveEmbed(currentSerialWatchUrl);
        },
        enabled: isSerial && !!currentSerialWatchUrl && isSerialsEnabled !== false,
        staleTime: 60 * 60 * 1000,
    });

    // Show S1 for serials, and S0 + base servers for movies and TV shows
    const servers = useMemo(() => {
        if (isSerial) {
            return [{ id: 1, label: 'S1' }];
        }
        const list = serverConfig?.servers || [];
        const baseServers = list.filter(s => s.id !== 0);
        if (hasDirectStream) {
            return [{ id: 0, label: 'S0' }, ...baseServers];
        }
        return baseServers;
    }, [serverConfig, hasDirectStream, isSerial]);

    useEffect(() => {
        if (isSerial) {
            setSelectedServer(1);
            return;
        }
        if (!serverConfig) return;

        // Respect user's explicit manual server selection
        if (hasUserSelectedServerRef.current) return;

        const configDefault = Number(serverConfig.default_server !== undefined ? serverConfig.default_server : FALLBACK_DEFAULT_SERVER);

        // While still checking if S0 is available, wait so S1 iframe does not start prematurely
        if (isStreamLoading) {
            return;
        }

        if (hasDirectStream) {
            setSelectedServer(0);
        } else {
            setSelectedServer(configDefault);
        }
    }, [serverConfig, hasDirectStream, isStreamLoading, isSerial]);

    // Memoized so it only recalculates when player dependencies change,
    // not on every scroll/focus re-render.
    const iframeSrc = useMemo(() => {
        if (isSerial) {
            return serialStreamData?.embed_url || '';
        }
        if (selectedServer === 0) {
            return directStreamData?.embed_url || directStreamData?.stream_url || '';
        }
        if (!serverConfig || !selectedServer) return '';
        if (type === 'tv' && (!selectedEpisode || !selectedSeason)) return '';

        let template = type === 'movie'
            ? serverConfig.movie[selectedServer]
            : serverConfig.tv[selectedServer];

        if (!template) return '';

        return template
            .replace('{id}', id)
            .replace('{slug}', slug)
            .replace('{s}', selectedSeason)
            .replace('{e}', selectedEpisode);
    }, [isSerial, serialStreamData, serverConfig, type, selectedServer, id, slug, selectedSeason, selectedEpisode, directStreamData]);

    const handleNextEpisode = useCallback(() => {
        if (isSerial) {
            const currentIdx = episodesList.findIndex(e => e.episode_number === selectedEpisode);
            if (currentIdx > 0) {
                setSelectedEpisode(episodesList[currentIdx - 1].episode_number);
            }
            return;
        }
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
    }, [isSerial, episodesList, type, selectedEpisode, seasonData, detail, selectedSeason]);

    const hasNextEpisode = useMemo(() => {
        if (isSerial) {
            const currentIdx = episodesList.findIndex(e => e.episode_number === selectedEpisode);
            return currentIdx > 0;
        }
        if (type !== 'tv') return false;
        const currentSeasonEps = seasonData?.episodes?.length || 0;
        if (selectedEpisode && selectedEpisode < currentSeasonEps) return true;
        return detail?.seasons?.some(s => s.season_number === selectedSeason + 1);
    }, [isSerial, episodesList, type, selectedEpisode, seasonData, detail, selectedSeason]);

    const availableSeasons = useMemo(() => {
        return detail?.seasons?.filter(s => s.season_number !== 0) || [];
    }, [detail]);

    useEffect(() => {
        if (type !== 'tv') return;
        if (sParam) {
            setSelectedSeason(parseInt(sParam));
            setSelectedEpisode(parseInt(eParam) || 1);
            lastInitializedTvIdRef.current = id;
        } else if (availableSeasons.length > 0 && lastInitializedTvIdRef.current !== id) {
            lastInitializedTvIdRef.current = id;
            const latest = availableSeasons[availableSeasons.length - 1].season_number;
            setSelectedSeason(latest);
            setSelectedEpisode(parseInt(eParam) || 1);
        }
    }, [type, id, sParam, eParam, availableSeasons]);

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

    const selectSeason = useCallback((seasonNumber, episodeNumber = 1) => {
        setSelectedSeason(seasonNumber);
        setSelectedEpisode(episodeNumber);
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

    if (isSerial && isSerialsEnabled === false) {
        return <Navigate to="/" replace />;
    }

    // Only show a hard loading screen when there is truly NO data at all.
    // When cached data exists (background refetch), render immediately with it.
    if (isDetailLoading && !detail) return <div className="loader-main"><Loader2 className="animate-spin" size={48} color="#fdd835" /></div>;
    if (!detail) return (
        <div className="page-wrapper">
            <Navbar />
            <div className="loader-main error-state">
                <div className="error-card">
                    <h2>Unable to load player</h2>
                    <p>The movie data needed for the player could not be loaded. Try again in a moment.</p>
                    <button
                        ref={retryButtonRef}
                        type="button"
                        className="btn-retry"
                        onClick={() => refetchDetail()}
                        disabled={isDetailFetching}
                    >
                        <RefreshCw size={18} className={isDetailFetching ? 'animate-spin' : ''} />
                        {isDetailFetching ? 'Retrying...' : 'Retry'}
                    </button>
                    <span className="error-hint">D-pad: press OK / Enter to retry</span>
                </div>
            </div>
        </div>
    );

    const title = detail.title || detail.name;
    const cast = detail.credits?.cast?.slice(0, 8).map(c => c.name).join(', ');

    // Compute once per render — avoids calling window.innerWidth + UA check ~25 times in JSX loops.
    const tvMode = isTVSize();
    const isApk = typeof window !== 'undefined' && !!window.AndroidApp;

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
                        {(type === 'tv' || isSerial) && !selectedEpisode ? (
                            <div className="player-placeholder">
                                <Play size={48} className="text-yellow-500 mb-4" />
                                <h3>Select an episode to start watching</h3>
                                <p>Season {selectedSeason || 1} is ready</p>
                            </div>
                        ) : selectedServer === null || (selectedServer === 0 && isStreamLoading) || (isSerial && isSerialStreamLoading) ? (
                            <div className="player-shimmer shimmer-wrapper" style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
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
                                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
                                    referrerPolicy={isSerial ? "no-referrer" : "origin-when-cross-origin"}
                                    sandbox={isSerial ? "allow-scripts allow-same-origin allow-presentation allow-forms" : undefined}
                                    loading="lazy"
                                    allowFullScreen
                                    onLoad={() => setIsIframeLoading(false)}
                                ></iframe>
                            </>
                        )}
                        {/* Transparent Bridge: catches the real click for external iframes */}
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

                        {(type === 'tv' || isSerial) && hasNextEpisode && (
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
                            {isSerial ? (
                                <Link to="/serials">TV Serials</Link>
                            ) : (
                                <Link to={`/${type}/${id}`}>{title}</Link>
                            )} /
                            <span>Watch</span>
                        </div>
                        <h1 className="watch-title">{title}</h1>
                        {(type === 'tv' || isSerial) && selectedEpisode && (
                            <p className="watch-subtitle">S{selectedSeason || 1} E{selectedEpisode}</p>
                        )}
                        {!isApk && !isSerial && (type === 'movie' || selectedEpisode) && (
                            <button type="button" className="watch-download-btn" onClick={() => setIsDownloadOpen(true)}>
                                <Download size={18} /> Download
                            </button>
                        )}
                    </div>

                    {(type === 'tv' || isSerial) && (
                        <div className="episode-selector-container">
                            <div className="selector-header">
                                <h3>{isSerial ? `Episodes (${episodesList.length})` : 'Seasons'}</h3>
                                {type === 'tv' && (
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
                                        aria-label={selectedSeason ? `Season ${selectedSeason}` : 'Season'}
                                        aria-expanded={isSeasonMenuOpen}
                                        role="button"
                                    >
                                        <ChevronLeft size={16} className="season-tv-arrow" />
                                        <span className="season-tv-label">
                                            {detail.seasons?.find(s => s.season_number === selectedSeason)?.name || (selectedSeason ? `Season ${selectedSeason}` : 'Season')}
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
                                )}
                            </div>

                            <div
                                className="episodes-scroll-list"
                                onScroll={(e) => {
                                    if (!isSerial) return;
                                    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
                                    if (scrollTop + clientHeight >= scrollHeight - 60) {
                                        handleLoadMoreSerialEpisodes();
                                    }
                                }}
                            >
                                {(type === 'tv' ? isSeasonLoading : isSerialLoading) ? (
                                    <div className="mini-loader"><Loader2 className="animate-spin" size={24} /></div>
                                ) : (
                                    <>
                                        {episodesList.map((ep, idx) => (
                                            <div
                                                key={ep.id || idx}
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
                                        ))}

                                        {isSerial && isLoadingMoreSerials && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', gap: '8px', color: 'var(--accent-yellow, #fdd835)' }}>
                                                <Loader2 className="animate-spin" size={16} />
                                                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Loading older episodes...</span>
                                            </div>
                                        )}

                                        {isSerial && !isLoadingMoreSerials && episodesList.length > 0 && !hasMoreSerialEps && (
                                            <div style={{ textAlign: 'center', padding: '14px 8px 8px', color: '#666', fontSize: '0.78rem', letterSpacing: '0.02em' }}>
                                                All available episodes loaded ({episodesList.length})
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {!isSerial && (
                        <>
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
                        </>
                    )}
                </div>
            </div>
            <footer className="footer" style={{ marginTop: '4rem', marginBottom: '2rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved &bull; <Disclaimer /></p>
            </footer>
            <DownloadModal
                isOpen={isDownloadOpen}
                onClose={() => setIsDownloadOpen(false)}
                type={type}
                id={id}
                title={title}
                season={selectedSeason || 1}
                episode={selectedEpisode || 1}
                seasons={detail?.seasons}
                totalEpisodes={seasonData?.episodes?.length || detail?.seasons?.find(s => s.season_number === (selectedSeason || 1))?.episode_count || null}
            />
        </div>
    );
};

export default WatchPage;
