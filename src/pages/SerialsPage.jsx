import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Tv, RefreshCw, Layers, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { serialsApi, movieApi, DEFAULT_CONFIG } from '../api';
import '../styles/serials.css';

const LANGUAGES = ['All', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Malayalam'];

// Sub-component for an individual horizontally scrollable shelf
function HorizontallyScrollableShelf({ shelf, onPlayEpisode }) {
    const scrollRef = useRef(null);
    const [episodes, setEpisodes] = useState(shelf.episodes || []);
    const [hasMoreToLoad, setHasMoreToLoad] = useState((shelf.episodes || []).length < 40);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const isLoadingMoreRef = useRef(false);

    // Keep episodes in sync if shelf data updates from parent
    useEffect(() => {
        if (shelf.episodes && shelf.episodes.length > episodes.length) {
            setEpisodes(shelf.episodes);
            setHasMoreToLoad(shelf.episodes.length < 40);
        }
    }, [shelf.episodes]);

    // Loads all 40 latest episodes for this language
    const loadMoreEpisodes = async () => {
        if (!hasMoreToLoad || isLoadingMoreRef.current || !shelf.language) return;
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
            const fullList = await serialsApi.getShelfEpisodes(shelf.language.toLowerCase());
            if (fullList && fullList.length > episodes.length) {
                setEpisodes(fullList);
                setHasMoreToLoad(false);
            } else {
                setHasMoreToLoad(false);
            }
        } catch (err) {
            console.error('Failed to load full shelf:', err);
        } finally {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    };

    const scroll = (direction) => {
        if (direction === 'right') {
            if (hasMoreToLoad && !isLoadingMoreRef.current) {
                loadMoreEpisodes();
            }
        }
        if (scrollRef.current) {
            const amount = direction === 'left' ? -480 : 480;
            scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    const handleContainerScroll = (e) => {
        const { scrollLeft, clientWidth, scrollWidth } = e.currentTarget;
        if (scrollLeft + clientWidth >= scrollWidth - 180) {
            if (hasMoreToLoad && !isLoadingMoreRef.current) {
                loadMoreEpisodes();
            }
        }
    };

    return (
        <section className="serials-shelf">
            <div className="serials-section-header">
                <h2 className="serials-section-title">
                    <span className="serials-title-accent"></span>
                    {shelf.title}
                </h2>
                {episodes && episodes.length > 0 && (
                    <span className="serials-count-badge">
                        {episodes.length} Episodes
                    </span>
                )}
            </div>

            <div className="serials-shelf-container-relative">
                <div
                    ref={scrollRef}
                    className="serials-shelf-scroll"
                    onScroll={handleContainerScroll}
                >
                    {episodes.map((ep, idx) => (
                        <div
                            key={`${ep.url}-${idx}`}
                            onClick={() => onPlayEpisode(ep)}
                            className="serials-card serials-shelf-card"
                            title={`Play ${ep.title}`}
                        >
                            {/* Thumbnail with 16:9 Aspect Ratio */}
                            <div className="serials-card-thumb-wrap">
                                {ep.imageUrl ? (
                                    <img
                                        src={ep.imageUrl}
                                        alt={ep.title}
                                        referrerPolicy="no-referrer"
                                        loading="lazy"
                                        className="serials-card-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1c22' }}>
                                        <Tv size={32} color="#555" />
                                    </div>
                                )}

                                {/* Date Badge */}
                                {ep.date && (
                                    <span className="serials-badge-date">
                                        {ep.date}
                                    </span>
                                )}

                                {/* Episode Number */}
                                {ep.episodeNumber && (
                                    <span className="serials-badge-ep">
                                        {ep.episodeNumber}
                                    </span>
                                )}

                                {/* Hover Play Button */}
                                <div className="serials-card-overlay">
                                    <div className="serials-play-bubble">
                                        <Play size={20} fill="#050505" style={{ marginLeft: '2px' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Meta Info */}
                            <div className="serials-card-info">
                                <h3 className="serials-card-title">
                                    {ep.title}
                                </h3>
                                <div className="serials-card-meta">
                                    <span>{ep.channelName || ep.serialTitle || 'TV Serial'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoadingMore && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '120px', color: 'var(--accent-yellow, #fdd835)' }}>
                            <Loader2 className="animate-spin" size={24} />
                        </div>
                    )}
                </div>

                <button
                    onClick={() => scroll('right')}
                    className="serials-scroll-btn right"
                    title={hasMoreToLoad ? 'Scroll right & load more episodes' : 'Scroll right'}
                    aria-label="Scroll right"
                    disabled={isLoadingMore}
                >
                    {isLoadingMore ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={20} />}
                </button>
            </div>
        </section>
    );
}

export default function SerialsPage() {
    const navigate = useNavigate();
    const [selectedLang, setSelectedLang] = useState('All');

    const { data: serverConfig } = useQuery({
        queryKey: ['server-config'],
        queryFn: movieApi.getServerConfig,
        staleTime: 1000 * 60 * 60,
    });
    const isSerialsEnabled = serverConfig?.Enable_serials ?? serverConfig?.enable_serials ?? serverConfig?.enable_serial ?? DEFAULT_CONFIG.Enable_serials ?? true;

    // Fetch home data (channels + shelves)
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['serialsHome'],
        queryFn: serialsApi.getHome,
        staleTime: 1000 * 60 * 30, // 30 mins
        enabled: isSerialsEnabled !== false,
    });

    const channels = data?.channels || [];
    const shelves = data?.shelves || [];

    // Filter shelves and channels by selected language
    const filteredShelves = useMemo(() => {
        if (selectedLang === 'All') return shelves;
        return shelves.filter((s) => s.language?.toLowerCase() === selectedLang.toLowerCase());
    }, [shelves, selectedLang]);

    const filteredChannels = useMemo(() => {
        if (selectedLang === 'All') return channels;
        return channels.filter((c) => c.language?.toLowerCase() === selectedLang.toLowerCase());
    }, [channels, selectedLang]);

    // Navigate to unified WatchPage for movie/tv/serial with single S1 server
    const handlePlayEpisode = (episode) => {
        const match = episode.url?.match(/\/show\/([^\/]+)\/season-(\d+)\/(\d+)\//);
        if (match) {
            const showSlug = match[1];
            const season = match[2];
            const epNum = match[3];
            navigate(`/watch/serial/${showSlug}/${season}/${epNum}`, {
                state: {
                    title: episode.title,
                    channelName: episode.channelName,
                    imageUrl: episode.imageUrl,
                    watchUrl: episode.url,
                }
            });
        } else {
            const slug = episode.url?.replace(/.*\/show\//, '').split('/')[0] || 'serial';
            navigate(`/watch/serial/${slug}`, {
                state: {
                    title: episode.title,
                    channelName: episode.channelName,
                    imageUrl: episode.imageUrl,
                    watchUrl: episode.url,
                }
            });
        }
    };

    // Navigate to dedicated channel shows page
    const handleChannelClick = (channel) => {
        navigate(`/serials/channel/${channel.slug}`);
    };

    if (isSerialsEnabled === false) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="serials-page">
            <Navbar />

            {/* Main Content Area */}
            <main className="serials-container" style={{ paddingTop: '16px' }}>
                {/* Language Filter Pills */}
                <div className="serials-lang-pills-bar">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLang(lang)}
                            className={`serials-lang-pill ${selectedLang === lang ? 'active' : ''}`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="serials-loading-area">
                        <div className="serials-spinner"></div>
                        <p style={{ fontSize: '0.9rem', color: '#aaa' }}>Loading latest TV shows & episodes...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="serials-error-area">
                        <AlertCircle size={40} />
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>Failed to load TV serials</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
                                Could not connect to the serials service. Please check your backend connection.
                            </p>
                        </div>
                        <button onClick={() => refetch()} className="serials-btn-refresh">
                            Try Again
                        </button>
                    </div>
                )}

                {!isLoading && !error && (
                    <>
                        {/* Channels Row */}
                        {filteredChannels.length > 0 && (
                            <section style={{ marginBottom: '28px' }}>
                                <div className="serials-section-header" style={{ marginTop: '8px' }}>
                                    <h2 className="serials-section-title">
                                        <Layers size={18} style={{ color: 'var(--accent-yellow, #fdd835)' }} />
                                        TV Channels
                                    </h2>
                                    <span className="serials-count-badge">
                                        {filteredChannels.length} Channels
                                    </span>
                                </div>

                                <div className="serials-channels-scroll">
                                    {filteredChannels.map((channel) => (
                                        <button
                                            key={channel.id}
                                            onClick={() => handleChannelClick(channel)}
                                            className="serials-channel-btn"
                                            title={`Browse all ${channel.name} shows`}
                                        >
                                            <div
                                                className="serials-channel-avatar"
                                                style={{ borderColor: channel.color || '#E50914' }}
                                            >
                                                {channel.logoUrl ? (
                                                    <img
                                                        src={channel.logoUrl}
                                                        alt={channel.name}
                                                        referrerPolicy="no-referrer"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            if (e.target.parentElement) {
                                                                e.target.parentElement.innerHTML = '<span style="font-size: 1.2rem; font-weight: bold; color: #fff;">' + (channel.name[0] || 'T') + '</span>';
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <Tv size={26} color="#888" />
                                                )}
                                            </div>
                                            <span className="serials-channel-name">
                                                {channel.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Language Shelves (Horizontally Scrollable Rows) */}
                        <div className="serials-shelves-container">
                            {filteredShelves.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                                    <Tv size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                    <p>No episodes found for {selectedLang}.</p>
                                </div>
                            )}

                            {filteredShelves.map((shelf) => (
                                <HorizontallyScrollableShelf
                                    key={shelf.title}
                                    shelf={shelf}
                                    onPlayEpisode={handlePlayEpisode}
                                />
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
