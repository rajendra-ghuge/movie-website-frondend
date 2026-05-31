import axios from 'axios';

const USE_DYNAMIC_API_URL = import.meta.env.VITE_USE_DYNAMIC_API_URL !== 'false';

// 1. Get initial URL from localStorage or environment variable (ZERO DELAY)
const INITIAL_API_URL = USE_DYNAMIC_API_URL
    ? localStorage.getItem('dynamic_api_url') || import.meta.env.VITE_API_URL
    : import.meta.env.VITE_API_URL;

const api = axios.create({
    baseURL: INITIAL_API_URL,
    timeout: 15000,
});

const getApiRootUrl = () => {
    const baseUrl = USE_DYNAMIC_API_URL
        ? api.defaults.baseURL
        : import.meta.env.VITE_API_URL;
    return baseUrl.replace(/\/proxy\/?$/, '');
};

const isValidServerConfig = (config) => {
    return Boolean(
        config &&
        Array.isArray(config.servers) &&
        config.movie &&
        config.tv
    );
};

// 2. Background Sync: Check Gist invisibly and update if needed
export const syncDynamicConfig = async () => {
    try {
        if (!USE_DYNAMIC_API_URL) return;

        const configUrl = import.meta.env.VITE_SERVER_CONFIG_URL;
        if (!configUrl) return;

        const res = await axios.get(configUrl);
        if (res.data && res.data.api_base_url) {
            const newUrl = res.data.api_base_url;
            if (newUrl !== api.defaults.baseURL) {
                api.defaults.baseURL = newUrl;
                localStorage.setItem('dynamic_api_url', newUrl);
            }
        }
    } catch {
        // Silently ignore sync failures
    }
};

// We intentionally DO NOT call syncDynamicConfig() on app load.
// We want to use the local/VITE_API_URL until it actually fails!

// 4. Auto-failover Interceptor
// If the Render backend goes down, this catches the failure, reads the Gist, and retries the request seamlessly!
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // If it's a network error (no response) or server error, and we haven't retried yet
        if (!originalRequest._retry && (!error.response || error.response.status >= 500)) {
            originalRequest._retry = true;
            
            await syncDynamicConfig();
            
            // Update the failed request's base URL to the newly found URL
            originalRequest.baseURL = api.defaults.baseURL;
            
            // Retry the request automatically
            return api(originalRequest);
        }
        return Promise.reject(error);
    }
);

export const movieApi = {
    getMovie: (id, params = {}) => api.get(`/movie/${id}`, { params }),
    getNowPlaying: (params = {}) => api.get('/movie/now_playing', { params }),
    getVideos: (id) => api.get(`/movie/${id}/videos`),
    getCredits: (id) => api.get(`/movie/${id}/credits`),
    getSimilar: (id, params = {}) => api.get(`/movie/${id}/similar`, { params }),
    getKeywords: (id, type = 'movie') => api.get(`/${type}/${id}/keywords`),
    getGenres: (type = 'movie', params = {}) => api.get(`/genre/${type}/list`, { params }),
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
    searchAoneroom: (keyword, params = {}) => axios.get(`${getApiRootUrl()}/aoneroom/search`, { params: { keyword, ...params } }),
    getAoneroomDetail: (detailPath) => axios.get(`${getApiRootUrl()}/aoneroom/detail`, { params: { detailPath } }),
    getAoneroomDownload: ({ subjectId, detailPath, se = 0, ep = 0 }) => axios.get(`${getApiRootUrl()}/aoneroom/download`, { params: { subjectId, detailPath, se, ep } }),
    getDownloadLinks: (payload) => api.post('/downloads/links', payload),
    getDownloadFileUrl: (url, title = 'video', proxyBaseUrl) => {
        const workerBaseUrl = proxyBaseUrl || import.meta.env.VITE_DOWNLOAD_WORKER_BASE_URL || 'https://dl.gemlelispe.workers.dev';
        const encodedUrl = encodeURIComponent(url).replace(/%2F/g, '/');
        return `${workerBaseUrl.replace(/\/$/, '')}/${encodedUrl}?n=${encodeURIComponent(title)}`;
    },
    getDownloadFileUrls: (url, title = 'video') => {
        const primaryProxy = import.meta.env.VITE_DOWNLOAD_WORKER_BASE_URL || 'https://dl.gemlelispe.workers.dev';
        const backupProxy = import.meta.env.VITE_DOWNLOAD_BACKUP_PROXY_URL || 'https://hellstorm.lol';
        return {
            primary: movieApi.getDownloadFileUrl(url, title, primaryProxy),
            backup: movieApi.getDownloadFileUrl(url, title, backupProxy),
        };
    },
    getImageUrl: (path, size = 'original') => {
        if (!path) return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750' fill='%23111'%3E%3Crect width='500' height='750'/%3E%3Ctext x='50%25' y='50%25' fill='%23555' font-family='sans-serif' font-size='24' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${api.defaults.baseURL}/image/${size}/${cleanPath}`;
    },
    getServerConfig: async () => {
        const DEFAULT_CONFIG = {
            api_base_url: "https://movie-website-backend-tw3j.onrender.com/proxy",
            servers: [
                { id: 4, label: 'S4 - Recommended' },
                { id: 1, label: 'S1' },
                { id: 2, label: 'S2' },
                { id: 3, label: 'S3' },
                { id: 5, label: 'S5-indian' },
                { id: 6, label: 'S6' },
                { id: 7, label: 'S7-hindi dubbed' },
                { id: 8, label: 'S8' },
                { id: 9, label: 'S9' },
                { id: 10, label: 'S10' },
                { id: 11, label: 'S11' },
                { id: 12, label: 'S12' },
                { id: 13, label: 'S13' }
            ],
            movie: {
                5: "https://vidlux.site/embed/movie/{id}",
                1: "https://vidsrc.cc/v3/embed/movie/{id}?autoPlay=1&muted=1",
                2: "https://vidrock.net/movie/{id}",
                3: "https://vidsrc.me/embed/movie?tmdb={id}&autoplay=1",
                4: "https://player.videasy.net/movie/{id}?autoplay=1",
                6: "https://vidlink.pro/movie/{id}?title=true&poster=true&autoplay=true&muted=true",
                7: "https://www.vidsrc.wtf/api/2/movie/?id={id}-{slug}&autoplay=1",
                8: "https://www.vidking.net/embed/movie/{id}?autoplay=1",
                9: "https://vidup.to/movie/{id}?autoPlay=true",
                10: "https://vidsrc.wtf/api/3/movie/?id={id}&autoplay=1",
                11: "https://peachify.top/embed/movie/{id}?dub=Hindi&sub=English",
                12: "https://111movies.com/movie/{id}",
                13: "https://player.vidzee.wtf/embed/movie/{id}?sr=hindi&server=7&autoplay=true"
            },
            tv: {
                5: "https://vidlux.site/embed/tv/{id}/{s}/{e}",
                1: "https://vidsrc.cc/v3/embed/tv/{id}/{s}/{e}?autoPlay=1&muted=1",
                2: "https://s.vdrk.site/csubtv.html?id={id}&s={s}&e={e}",
                3: "https://vidsrc.me/embed/tv?tmdb={id}&season={s}&episode={e}&autoplay=1",
                4: "https://player.videasy.net/tv/{id}/{s}/{e}?nextEpisode=true&episodeSelector=true&autoplay=1",
                6: "https://vidlink.pro/tv/{id}/{s}/{e}?title=true&poster=true&autoplay=true&muted=true&nextbutton=true",
                7: "https://www.vidsrc.wtf/api/2/tv/?id={id}&s={s}&e={e}&autoplay=1",
                8: "https://www.vidking.net/embed/tv/{id}-{slug}/{s}/{e}?autoplay=1",
                9: "https://vidup.to/tv/{id}/{s}/{e}?autoPlay=true",
                10: "https://vidsrc.wtf/api/3/tv/?id={id}&s={s}&e={e}&autoplay=1",
                11: "https://peachify.top/embed/tv/{id}/{s}/{e}?dub=Hindi&sub=English",
                12: "https://111movies.com/tv/{id}/{s}/{e}",
                13:"https://player.vidzee.wtf/embed/tv/{id}/{s}/{e}?sr=hindi&server=7&autoplay=true"
            }
        };

        try {
            const configUrl = import.meta.env.VITE_SERVER_CONFIG_URL;
            if (!configUrl) return DEFAULT_CONFIG;

            // Bypass axios instance to avoid API_BASE_URL prefixing
            const res = await axios.get(configUrl);
            if (isValidServerConfig(res.data)) {
                return res.data;
            }
            return DEFAULT_CONFIG;
        } catch {
            return DEFAULT_CONFIG;
        }
    },
};

export default api;
