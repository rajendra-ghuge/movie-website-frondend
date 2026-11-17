import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Tv, Film, Play, AlertCircle, RefreshCw } from 'lucide-react';
import Navbar from '../components/Navbar';
import { serialsApi, movieApi, DEFAULT_CONFIG } from '../api';
import '../styles/serials.css';

export default function ChannelPage() {
    const { channelSlug } = useParams();
    const navigate = useNavigate();

    const { data: serverConfig } = useQuery({
        queryKey: ['server-config'],
        queryFn: movieApi.getServerConfig,
        staleTime: 1000 * 60 * 60,
    });
    const isSerialsEnabled = serverConfig?.Enable_serials ?? serverConfig?.enable_serials ?? serverConfig?.enable_serial ?? DEFAULT_CONFIG.Enable_serials ?? true;

    // Fetch home data to look up channel metadata (logo, name, color, language)
    const { data: homeData } = useQuery({
        queryKey: ['serialsHome'],
        queryFn: serialsApi.getHome,
        staleTime: 1000 * 60 * 30,
        enabled: isSerialsEnabled !== false,
    });

    const channelMeta = homeData?.channels?.find(
        (c) => c.slug === channelSlug || c.id === channelSlug
    );

    const channelName = channelMeta?.name || channelSlug?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const channelColor = channelMeta?.color || '#E50914';

    // Fetch shows for this channel
    const {
        data: shows = [],
        isLoading,
        error,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ['channelShows', channelSlug],
        queryFn: () => serialsApi.getChannelShows(channelSlug),
        staleTime: 1000 * 60 * 30,
        enabled: isSerialsEnabled !== false,
    });

    const handleShowClick = (show) => {
        // Navigates to the unified WatchPage for this serial
        navigate(`/watch/serial/${show.slug}`);
    };

    if (isSerialsEnabled === false) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="serials-page">
            <Navbar />

            {/* Shows Content */}
            <main className="serials-container" style={{ paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Link to="/serials" className="serials-modal-btn-icon" title="Back to Serials">
                            <ArrowLeft size={18} />
                        </Link>

                        <div
                            className="serials-channel-avatar"
                            style={{
                                width: '42px',
                                height: '42px',
                                minWidth: '42px',
                                minHeight: '42px',
                                borderColor: channelColor,
                            }}
                        >
                            {channelMeta?.logoUrl ? (
                                <img
                                    src={channelMeta.logoUrl}
                                    alt={channelName}
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <Tv size={20} color="#888" />
                            )}
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#fff' }}>{channelName}</h1>
                                {channelMeta?.language && (
                                    <span className="serials-badge">{channelMeta.language}</span>
                                )}
                            </div>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#888' }}>
                                {shows.length > 0 ? `${shows.length} Serials & Shows` : `All shows on ${channelName}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="serials-btn-refresh"
                        title="Refresh shows"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                        {isFetching ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {isLoading && (
                    <div className="serials-loading-area">
                        <div className="serials-spinner"></div>
                        <p style={{ fontSize: '0.88rem', color: '#aaa' }}>
                            Loading all shows for {channelName}...
                        </p>
                    </div>
                )}

                {error && !isLoading && (
                    <div className="serials-error-area">
                        <AlertCircle size={40} />
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>
                                Failed to load {channelName} shows
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
                                Could not connect to the serials service. Please check your backend connection.
                            </p>
                        </div>
                        <button onClick={() => refetch()} className="serials-btn-refresh">
                            Try Again
                        </button>
                    </div>
                )}

                {!isLoading && !error && shows.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                        <Film size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p>No shows found for {channelName}.</p>
                    </div>
                )}

                {!isLoading && !error && shows.length > 0 && (
                    <div className="serials-channel-shows-grid">
                        {shows.map((show, idx) => (
                            <div
                                key={`${show.slug}-${idx}`}
                                onClick={() => handleShowClick(show)}
                                className="serials-channel-show-card"
                                title={`Watch ${show.title}`}
                            >
                                <div className="serials-channel-show-poster">
                                    {show.imageUrl ? (
                                        <img
                                            src={show.imageUrl}
                                            alt={show.title}
                                            referrerPolicy="no-referrer"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1c22' }}>
                                            <Tv size={36} color="#555" />
                                        </div>
                                    )}
                                    <div className="serials-card-overlay">
                                        <div className="serials-play-bubble">
                                            <Play size={22} fill="#050505" style={{ marginLeft: '2px' }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="serials-card-info">
                                    <h3 className="serials-card-title">{show.title}</h3>
                                    <div className="serials-card-meta">
                                        <span>{channelName}</span>
                                        <span style={{ color: 'var(--accent-yellow, #fdd835)', fontWeight: 600 }}>Watch Now</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
