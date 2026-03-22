import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, MoreVertical, Plus } from 'lucide-react';
import { movieApi } from '../api';

const MovieGrid = ({ fetchUrl, searchQuery, type }) => {
    const navigate = useNavigate();

    const { 
        data, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage, 
        isLoading, 
        error 
    } = useInfiniteQuery({
        queryKey: ['movies-grid', window.location.search || searchQuery || 'default'],
        queryFn: async ({ pageParam = 1 }) => {
            const res = searchQuery 
                ? await movieApi.searchMulti(searchQuery, pageParam)
                : await fetchUrl({ page: pageParam });
            return res.data;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.total_pages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        staleTime: 1000 * 60 * 5,
    });

    const movies = data?.pages.flatMap(page => page.results) || [];

    const handleMovieClick = (movie) => {
        const mediaType = type || movie.media_type || (movie.title ? 'movie' : 'tv');
        navigate(`/${mediaType}/${movie.id}`);
    };

    if (isLoading) return (
        <div className="loader-container">
            <Loader2 className="animate-spin" size={40} color="#fdd835" />
        </div>
    );

    if (error) return (
        <div className="loader-container"><p>Failed to load movies.</p></div>
    );

    return (
        <div className="movie-grid-container">
            <div className="movie-grid">
                {movies.map((movie) => {
                    const releaseDate = movie.release_date || movie.first_air_date || '';
                    const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', {
                        display: 'long',
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit'
                    }) : 'Coming Soon';

                    return (
                        <div 
                            key={movie.id}
                            onClick={() => handleMovieClick(movie)}
                            className="movie-card"
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
                        onClick={() => fetchNextPage()} 
                        disabled={isFetchingNextPage}
                        className="btn-load-more"
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
