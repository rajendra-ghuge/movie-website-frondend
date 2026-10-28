import { useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MovieGrid from '../components/MovieGrid';
import Navbar from '../components/Navbar';
import Disclaimer from '../components/Disclaimer';
import SortDropdown from '../components/SortDropdown';
import { movieApi } from '../api';

const HomePage = () => {
    const location = useLocation();
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const type = query.get('type') || 'movie';
    const lang = query.get('lang');
    const genre = query.get('genre');
    const provider = query.get('provider');
    const sort = query.get('sort') || 'popularity.desc';
    const cat = query.get('cat');
    const s = query.get('s');
    const k = query.get('k');
    const kn = query.get('kn');
    const cast = query.get('cast');
    const cn = query.get('cn');
    const latest = query.get('latest');
    const year = query.get('y') || query.get('year');
    const minRating = query.get('min_rating');

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [location.search]);

    const PROVIDER_NAMES = {
        '8': 'Netflix',
        '119': 'Prime Video',
        '2336': 'JioHotstar',
        '232': 'Zee5',
        '237': 'SonyLIV'
    };

    const LANGUAGE_NAMES = {
        hi: 'Hindi',
        ta: 'Tamil',
        te: 'Telugu',
        ml: 'Malayalam',
        kn: 'Kannada',
        bn: 'Bengali',
        mr: 'Marathi',
        pa: 'Punjabi',
        gu: 'Gujarati',
        en: 'English',
        ja: 'Japanese',
        ko: 'Korean'
    };

    const GENRE_NAMES = {
        '28': 'Action',
        '12': 'Adventure',
        '16': 'Animation',
        '35': 'Comedy',
        '80': 'Crime',
        '18': 'Drama',
        '27': 'Horror',
        '10749': 'Romance',
        '878': 'Sci-Fi',
        '53': 'Thriller'
    };

    const pageTitle = useMemo(() => {
        if (s) return `Search results for "${s}"`;
        if (k && kn) return `Keyword: ${kn}`;
        if (cast && cn) return `Movies starring ${cn}`;

        const isTop = cat === 'top' || sort === 'vote_average.desc';
        const isLatest = sort === 'primary_release_date.desc' || sort === 'first_air_date.desc' || latest || cat === 'latest';
        const sortPrefix = isTop ? 'Top Rated ' : (isLatest ? 'Latest ' : '');

        const providerName = provider ? (PROVIDER_NAMES[provider] || 'OTT') : '';
        const genreName = genre ? (GENRE_NAMES[genre] || '') : '';
        const langName = lang ? (LANGUAGE_NAMES[lang] || '') : '';

        const isTvRequest = type === 'tv' || cat?.startsWith('tv');

        // TV / Web Series
        if (isTvRequest) {
            // Bollywood / Indian Web Series
            if (cat === 'tv_hi' || cat === 'hi' || lang === 'hi') {
                if (providerName) return `${sortPrefix}Bollywood Web Series on ${providerName}`;
                if (genreName) return `${sortPrefix}Bollywood ${genreName} Web Series`;
                return `${sortPrefix}Bollywood Web Series`;
            }

            // Hollywood Web Series
            if (cat === 'tv_en' || cat === 'en' || lang === 'en') {
                if (providerName) return `${sortPrefix}Hollywood Web Series on ${providerName}`;
                if (genreName) return `${sortPrefix}Hollywood ${genreName} Web Series`;
                return `${sortPrefix}Hollywood Web Series`;
            }

            // Anime Series
            if (cat === '16' || cat === 'anime' || genre === '16') {
                return `${sortPrefix}Anime Series`;
            }

            if (lang && langName) {
                return `${sortPrefix}${langName} Web Series`;
            }

            if (providerName) {
                return `${sortPrefix}Web Series on ${providerName}`;
            }

            return `${sortPrefix}Web Series`;
        }

        // Anime Movies / All Anime
        if (cat === '16' || cat === 'anime' || genre === '16') {
            if (type === 'movie') return `${sortPrefix}Anime Movies`;
            return `${sortPrefix}All Anime`;
        }

        // Bollywood Movies
        if (cat === 'hi' || lang === 'hi') {
            if (providerName) return `${sortPrefix}Bollywood on ${providerName}`;
            if (genreName) return `${sortPrefix}Bollywood ${genreName} Movies`;
            return `${sortPrefix}Bollywood Movies`;
        }

        // Hollywood Movies
        if (cat === 'en' || lang === 'en') {
            if (providerName) return `${sortPrefix}Hollywood on ${providerName}`;
            if (genreName) return `${sortPrefix}Hollywood ${genreName} Movies`;
            return `${sortPrefix}Hollywood Movies`;
        }

        // Provider specific
        if (providerName) {
            return `${sortPrefix}${providerName} Movies & Shows`;
        }

        if (cat === 'ott') {
            return `${sortPrefix}OTT Specials`;
        }

        // Language specific
        if (cat === 'lang' || (lang && langName)) {
            return `${sortPrefix}${langName} Movies & Shows`;
        }

        if (cat === 'latest' || isLatest) {
            if (latest === 'ott') return 'Latest OTT Releases';
            if (latest === 'theatrical') return 'Latest Theatrical Releases';
            return 'Latest Releases';
        }

        if (cat === 'top' || isTop) {
            const region = lang === 'hi' ? 'Indian ' : (lang === 'en' ? 'Hollywood ' : '');
            if (type === 'tv' && lang === 'ko') return 'Top Rated K-Dramas';
            if (type === 'tv') return `Top Rated ${region}TV Shows`;
            if (type === 'movie') return `Top Rated ${region}Movies`;
            return `Top Rated ${region}IMDb`;
        }

        if (cat === 'movie' && type === 'movie') return 'Trending Movies & Web Shows';
        if (cat === 'dice') return `Random (${lang === 'en' ? 'Hollywood' : 'Indian'})`;
        if (type === 'movie' && !lang && !genre) return 'Popular Hindi Movies & Web Shows';
        return 'Filtered Content';
    }, [s, k, kn, cast, cn, cat, latest, lang, type, sort, genre, provider]);

    const fetchUrlData = useCallback((pageParams = { page: 1 }) => {
        if (s) return movieApi.searchMulti(s, pageParams.page);
        if (k) return movieApi.getMoviesByKeyword(k, pageParams);
        if (cast) return movieApi.getMoviesByCast(cast, pageParams);

        // Trending home feed (only when no extra sort or when default popularity is selected)
        if (cat === 'movie' && type === 'movie' && !provider && !latest && (!sort || sort === 'popularity.desc')) {
            return movieApi.getTrending('all', 'day', pageParams);
        }

        const today = new Date().toISOString().split('T')[0];

        // Handle Random Discovery
        if (cat === 'dice') {
            const diceParams = {
                ...pageParams,
                with_original_language: lang,
                with_genres: genre,
                sort_by: sort,
                'vote_average.gte': minRating || 5,
                'vote_count.gte': 5,
                'primary_release_date.lte': today,
                'first_air_date.lte': today,
                include_adult: 'true'
            };
            return movieApi.discoverBoth(diceParams);
        }

        const isTvRequest = type === 'tv' || cat?.startsWith('tv');
        const effectiveSort = isTvRequest && sort === 'primary_release_date.desc'
            ? 'first_air_date.desc'
            : (sort || (isTvRequest ? 'first_air_date.desc' : 'popularity.desc'));

        if (latest) {
            const params = {
                'primary_release_date.lte': today,
                'first_air_date.lte': today,
                'include_adult': 'true',
                sort_by: effectiveSort,
                ...pageParams
            };

            if (lang) params.with_original_language = lang;
            if (genre) params.with_genres = genre;
            if (cat === 'hi') params.with_original_language = 'hi';
            if (cat === 'en') params.with_original_language = 'en';
            if (cat === '16') params.with_genres = '16';

            if (provider) {
                params.with_watch_providers = provider;
                params.watch_region = 'IN';
            }

            if (!lang && !genre && !provider && cat !== 'en') {
                params.with_origin_country = 'IN';
            }

            if (params.sort_by === 'vote_average.desc') {
                params['vote_count.gte'] = 50;
            }

            if (latest === 'theatrical' && (!sort || sort === 'primary_release_date.desc')) {
                return movieApi.getNowPlaying({
                    region: 'IN',
                    ...pageParams
                });
            }

            if (latest === 'ott') {
                params.region = 'IN';
                params.watch_region = 'IN';
                params.with_watch_monetization_types = 'flatrate';
                return movieApi.discoverBoth(params);
            }

            return movieApi.discoverBoth(params);
        }

        const params = {
            sort_by: effectiveSort,
            ...pageParams
        };

        if (type === 'movie') {
            params['primary_release_date.lte'] = today;
        } else {
            params['first_air_date.lte'] = today;
        }

        if (params.sort_by === 'vote_average.desc') {
            params['vote_count.gte'] = (cat === 'hi' || cat === 'top' || !cat) ? 50 : 20;
        }

        if (!lang && !genre && !provider && !s && !k && !cat) {
            params.with_origin_country = 'IN';
            params.without_genres = '10766,10764,10767,10763';
            params.sort_by = effectiveSort;
            params['first_air_date.lte'] = today;
            return movieApi.discoverBoth(params);
        }

        if (lang) params.with_original_language = lang;
        if (genre) params.with_genres = genre;

        if (cat === 'hi') params.with_original_language = 'hi';
        if (cat === 'en') params.with_original_language = 'en';
        if (cat === '16') params.with_genres = '16';
        if (cat === 'top') {
            params.sort_by = effectiveSort || 'vote_average.desc';
            if (params.sort_by === 'vote_average.desc') {
                params['vote_count.gte'] = 50;
            }
        }

        if (year) {
            if (type === 'movie') params.primary_release_year = year;
            else params.first_air_date_year = year;
        }
        if (provider) {
            params.with_watch_providers = provider;
            params.watch_region = 'IN';
        }

        if (provider && (cat === 'ott' || (!cat && !lang))) {
            params.with_origin_country = 'IN|US|GB';
            params.region = 'IN';
            params.sort_by = effectiveSort;
            return movieApi.discoverBoth(params);
        }

        if (cat === 'tv_hi') {
            params.with_original_language = 'hi';
            return movieApi.discoverTv(params);
        }
        if (cat === 'tv_en') {
            params.with_original_language = 'en';
            return movieApi.discoverTv(params);
        }

        if (isTvRequest) return movieApi.discoverTv(params);

        if (cat === 'hi' || cat === 'en' || (cat === 'movie' && (provider || sort)) || cat === 'top' || cat === '16') {
            if (cat === 'movie' && (sort || provider)) {
                return movieApi.discoverBoth(params);
            }
            return movieApi.discoverMovies(params);
        }

        params['primary_release_date.lte'] = today;
        params['first_air_date.lte'] = today;
        return movieApi.discoverBoth(params);
    }, [cast, cat, genre, k, lang, latest, minRating, provider, s, sort, type, year]);

    const isTVSize = () => window.innerWidth >= 1024;

    const handlePageKeyDown = useCallback((e) => {
        if (!isTVSize()) return;

        // Jump from Navbar to Grid content
        const navbar = document.getElementById('tv-navbar');
        if (navbar && navbar.contains(e.target)) {
            // ONLY jump if we are on a top-level nav link, NOT inside a dropdown
            const isDropdown = e.target.closest('.nav-dropdown');
            if (e.key === 'ArrowDown' && !isDropdown) {
                e.preventDefault();
                const anchor = document.getElementById('tv-grid-focus-anchor');
                anchor?.focus();
            }
            return;
        }
    }, []);

    return (
        <div className="page-wrapper" onKeyDown={handlePageKeyDown}>
            <Navbar />

            <div className="container">
                <div className="section-header section-header-row">
                    <div className="section-title-wrapper">
                        <span className="section-title-heading">{pageTitle}</span>
                    </div>
                    <SortDropdown />
                </div>

                <MovieGrid
                    key={location.search}
                    fetchUrl={fetchUrlData}
                    searchQuery={s}
                    locationSearch={location.search}
                />

                <footer className="footer" style={{ marginTop: '4rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                    <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved &bull; <Disclaimer /></p>
                </footer>
            </div>
        </div>
    );
};

export default HomePage;
