import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, ChevronLeft, ChevronRight, Server } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';

const WatchPage = () => {
    const { type, id, season: sParam, episode: eParam } = useParams();
    const navigate = useNavigate();
    const [selectedServer, setSelectedServer] = useState(4);
    const [selectedSeason, setSelectedSeason] = useState(parseInt(sParam) || 1);
    const [selectedEpisode, setSelectedEpisode] = useState(parseInt(eParam) || (type === 'tv' ? 1 : null));

    // Scroll to top on mount or when id/type changes
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id, type]);

    // Fetch movie/tv details for title and cast
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

    // Fetch TV season data for episode list
    const { data: seasonData, isLoading: isSeasonLoading } = useQuery({
        queryKey: ['tv-season', id, selectedSeason],
        queryFn: async () => {
            if (type !== 'tv' || !selectedSeason) return null;
            const res = await movieApi.getTvSeason(id, selectedSeason);
            return res.data;
        },
        enabled: type === 'tv' && !!selectedSeason
    });

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
                case 1: return `https://vidsrc.cc/v3/embed/movie/${id}?autoPlay=false`;
                case 2: return `https://moviesapi.club/movie/${id}`;
                case 3: return `https://vidsrc.me/embed/movie?tmdb=${id}`;
                case 4: return `https://player.videasy.net/movie/${id}`;
                case 6: return `https://vidlink.pro/movie/${id}?title=true&poster=true&autoplay=false`;
                case 7: return `https://www.vidsrc.wtf/api/2/movie/?id=${id}-${slug}`;
                case 8: return `https://www.vidking.net/embed/movie/${id}`;
                case 9: return `https://player.smashy.stream/movie/${id}`;
                case 10: return `https://vidsrc.wtf/api/3/movie/?id=${id}`;
                default: return '';
            }
        } else {
            switch (selectedServer) {
                case 5: return imdbId ? `https://vidrock.net/tv/${imdbId}/${selectedSeason}/${selectedEpisode}` : '';
                case 1: return `https://vidsrc.cc/v3/embed/tv/${id}/${selectedSeason}/${selectedEpisode}?autoPlay=false`;
                case 2: return `https://moviesapi.club/tv/${id}-${selectedSeason}-${selectedEpisode}`;
                case 3: return `https://vidsrc.me/embed/tv?tmdb=${id}&season=${selectedSeason}&episode=${selectedEpisode}`;
                case 4: return `https://player.videasy.net/tv/${id}/${selectedSeason}/${selectedEpisode}?nextEpisode=true&episodeSelector=true`;
                case 6: return `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}?title=true&poster=true&autoplay=false&nextbutton=true`;
                case 7: return `https://www.vidsrc.wtf/api/2/tv/?id=${id}&s=${selectedSeason}&e=${selectedEpisode}`;
                case 8: return `https://www.vidking.net/embed/tv/${id}-${slug}/${selectedSeason}/${selectedEpisode}`;
                case 9: return `https://player.smashy.stream/tv/${id}?s=${selectedSeason}&e=${selectedEpisode}`;
                case 10: return `https://vidsrc.wtf/api/3/tv/?id=${id}&s=${selectedSeason}&e=${selectedEpisode}`;
                default: return '';
            }
        }
    };

    const servers = [
        { id: 1, label: 'S1' },
        { id: 2, label: 'S2' },
        { id: 3, label: 'S3' },
        { id: 4, label: 'S4' },
        { id: 5, label: 'S5-indian' },
        { id: 6, label: 'S6' },
        { id: 7, label: 'S7-hindi dubbed' },
        { id: 8, label: 'S8' },
        { id: 9, label: 'S9' },
        { id: 10, label: 'S10' }
    ];

    // Fetch Recommendations
    const { data: recommendations, isLoading: isRecLoading } = useQuery({
        queryKey: ['recommendations', type, id],
        queryFn: async () => {
            const res = type === 'movie' 
                ? await movieApi.getRecommendations(id)
                : await movieApi.getTvRecommendations(id);
            return res.data.results?.slice(0, 10) || [];
        }
    });

    const handleNextEpisode = () => {
        if (type !== 'tv') return;
        
        const currentSeasonEps = seasonData?.episodes?.length || 0;
        if (selectedEpisode < currentSeasonEps) {
            setSelectedEpisode(prev => prev + 1);
        } else {
            // Check if there's a next season
            const nextSeason = detail.seasons?.find(s => s.season_number === selectedSeason + 1);
            if (nextSeason) {
                setSelectedSeason(selectedSeason + 1);
                setSelectedEpisode(1); // Auto-play next season's first episode on explicit button click
            }
        }
    };

    const hasNextEpisode = useMemo(() => {
        if (type !== 'tv') return false;
        const currentSeasonEps = seasonData?.episodes?.length || 0;
        if (selectedEpisode && selectedEpisode < currentSeasonEps) return true;
        return detail?.seasons?.some(s => s.season_number === selectedSeason + 1);
    }, [type, selectedEpisode, seasonData, detail, selectedSeason]);

    if (isDetailLoading) return <div className="loader-main"><Loader2 className="animate-spin" size={48} color="#fdd835" /></div>;
    if (!detail) return <div className="loader-main">Error loading player.</div>;

    const title = detail.title || detail.name;
    const cast = detail.credits?.cast?.slice(0, 8).map(c => c.name).join(', ');

    return (
        <div className="page-wrapper">
            <Navbar />
            
            <div className="watch-layout">
                {/* Left Side: Player & Servers */}
                <div className="watch-left">
                    <div className="player-container-main">
                        {type === 'tv' && !selectedEpisode ? (
                            <div className="player-placeholder">
                                <Play size={48} className="text-yellow-500 mb-4" />
                                <h3>Select an episode to start watching</h3>
                                <p>Season {selectedSeason} is ready</p>
                            </div>
                        ) : (
                            <iframe
                                key={`${selectedServer}-${id}-${selectedSeason}-${selectedEpisode}`}
                                src={getIframeSrc()}
                                title="Video Player"
                                className="watch-iframe"
                                allowFullScreen
                            ></iframe>
                        )}
                    </div>

                    <div className="watch-controls-bar">
                        <div className="server-selection">
                            <div className="server-header">
                                <Server size={18} color="#fdd835" />
                                <span>Select Server</span>
                            </div>
                            <div className="server-buttons-list">
                                {servers.map((server) => (
                                    <button
                                        key={server.id}
                                        className={`server-btn ${selectedServer === server.id ? 'active' : ''}`}
                                        onClick={() => setSelectedServer(server.id)}
                                    >
                                        {server.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {type === 'tv' && hasNextEpisode && (
                            <button className="btn-next-ep" onClick={handleNextEpisode}>
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
                                    className="season-dropdown"
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
                                    seasonData?.episodes?.map((ep) => (
                                        <div 
                                            key={ep.id}
                                            className={`episode-item ${selectedEpisode === ep.episode_number ? 'active' : ''}`}
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
                                recommendations?.map((movie) => (
                                    <Link 
                                        key={movie.id} 
                                        to={`/${type}/${movie.id}`}
                                        className="similar-card"
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
