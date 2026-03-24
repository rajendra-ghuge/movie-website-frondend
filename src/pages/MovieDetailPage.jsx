import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';

const MovieDetailPage = () => {
    const { type = 'movie', id } = useParams();
    const navigate = useNavigate();

    // Fetch detail with consolidated data
    const { data: movie, isLoading, error } = useQuery({
        queryKey: ['detail', type, id],
        queryFn: async () => {
            const params = { append_to_response: 'videos,credits' };
            const res = type === 'movie' 
                ? await movieApi.getMovie(id, params) 
                : await movieApi.getTvDetail(id, params);
            window.scrollTo(0, 0);
            return res.data;
        },
    });

    // Fetch Keywords separately
    const { data: keywordsData, isLoading: isKeywordsLoading } = useQuery({
        queryKey: ['keywords', type, id],
        queryFn: async () => {
            const res = await movieApi.getKeywords(id, type);
            return res.data;
        }
    });

    if (isLoading) return <div className="loader-main"><Loader2 className="animate-spin" size={48} color="#fdd835" /></div>;
    if (error || !movie) return <div className="loader-main">Error loading content.</div>;

    const trailer = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || movie.videos?.results?.[0];
    const cast = movie.credits?.cast?.slice(0, 8).map(c => c.name).join(', ');
    const genres = movie.genres?.map(g => g.name);
    
    // TMDB keywords are in .keywords for movies and .results for tv
    const keywordsList = (type === 'movie' ? keywordsData?.keywords : keywordsData?.results)?.slice(0, 15) || [];

    return (
        <div className="page-wrapper">
            <Navbar onSearch={() => navigate('/')} />
            
            <div className="detail-page">
                {/* Left Sidebar: Fixed Poster */}
                <div className="detail-left">
                    <img 
                        src={movieApi.getImageUrl(movie.poster_path, 'w500')} 
                        alt={movie.title || movie.name}
                        className="detail-poster-large"
                    />
                </div>

                {/* Right Content: Scrollable */}
                <div className="detail-right">
                    <div className="breadcrumbs">
                        <Link to="/">Home</Link> / 
                        <span>{type === 'movie' ? 'Movies' : 'Web Series'}</span> / 
                        <span>{movie.title || movie.name}</span>
                    </div>

                    <h1 className="detail-title-large">{movie.title || movie.name}</h1>
                    {movie.tagline && <p className="detail-tagline">{movie.tagline}</p>}

                    <div className="genre-tags">
                        {genres?.map(g => (
                            <span key={g} className="genre-tag-detail">{g}</span>
                        ))}
                    </div>

                    <div className="detail-actions">
                        <Link 
                            to={`/watch/${type}/${id}`}
                            className="btn-watch"
                        >
                            <Play size={20} fill="currentColor" />
                            Watch Now
                        </Link>
                    </div>

                    <p className="detail-overview">{movie.overview}</p>

                    <div className="meta-info">
                        <div className="meta-row">
                            <span className="meta-label">Stars:</span>
                            <span className="meta-value">{cast || 'N/A'}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Last Air:</span>
                            <span className="meta-value">{movie.release_date || movie.last_air_date || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="keyword-row">
                        <span className="meta-label">Keywords:</span>
                        <div className="keyword-tags">
                            {isKeywordsLoading ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                keywordsList?.map(kw => (
                                    <Link 
                                        key={kw.id} 
                                        to={`/?k=${kw.id}&kn=${encodeURIComponent(kw.name)}`} 
                                        className="keyword-tag"
                                    >
                                        {kw.name}
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="trailer-section-container">
                        <h3 className="section-title">Official Trailer</h3>
                        {trailer ? (
                            <div className="trailer-section">
                                <iframe
                                    src={`https://www.youtube.com/embed/${trailer.key}`}
                                    title="YouTube trailer"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        ) : (
                            <div className="no-trailer">
                                <p>Trailer not available for this title.</p>
                            </div>
                        )}
                    </div>

                    <footer className="footer">
                        <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default MovieDetailPage;
