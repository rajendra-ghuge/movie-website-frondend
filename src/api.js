import axios from 'axios';

const API_BASE_URL =import.meta.env.VITE_API_URL;

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
});

export const movieApi = {
    getMovie: (id, params = {}) => api.get(`/movie/${id}`, { params }),
    getVideos: (id) => api.get(`/movie/${id}/videos`),
    getCredits: (id) => api.get(`/movie/${id}/credits`),
    getSimilar: (id, params = {}) => api.get(`/movie/${id}/similar`, { params }),
    getKeywords: (id, type = 'movie') => api.get(`/${type}/${id}/keywords`),
    getMoviesByKeyword: (id, params = {}) => api.get(`/keyword/${id}/movies`, { params }),
    getRecommendations: (id, params = {}) => api.get(`/movie/${id}/recommendations`, { params }),
    getTvRecommendations: (id, params = {}) => api.get(`/tv/${id}/recommendations`, { params }),
    getTrending: (type = 'all', window = 'day', params = {}) => api.get(`/trending/${type}/${window}`, { params }),
    discoverMovies: (params) => api.get('/discover/movie', { params }),
    discoverTv: (params) => api.get('/discover/tv', { params }),
    discoverBoth: (params) => api.get('/discover/both', { params }),
    searchMulti: (query, page = 1) => api.get('/search/multi', { params: { query, page } }),
    getMoviesByCast: (castId, params = {}) => api.get('/discover/both', { params: { ...params, with_cast: castId } }),
    getTvDetail: (id, params = {}) => api.get(`/tv/${id}`, { params }),
    getTvSeason: (id, season, params = {}) => api.get(`/tv/${id}/season/${season}`, { params }),
    getImageUrl: (path, size = 'original') => {
        if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${API_BASE_URL}/image/${size}/${cleanPath}`;
    },
};

export default api;
