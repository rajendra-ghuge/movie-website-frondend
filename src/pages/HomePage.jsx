import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Flame } from 'lucide-react';
import MovieGrid from '../components/MovieGrid';
import Navbar from '../components/Navbar';
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

    const getTitle = () => {
        if (s) return `Search results for "${s}"`;
        if (k && kn) return `Keyword: ${kn}`;
        if (cast && cn) return `Movies starring ${cn}`;
        if (cat === 'hi') return 'Bollywood Movies';
        if (cat === 'en') return 'Hollywood Movies';
        if (cat === '16') return 'Anime Series';
        if (cat === 'ott') return 'OTT Specials';
        if (cat === 'latest') {
            if (latest === 'ott') return 'Latest OTT Releases';
            if (latest === 'theatrical') return 'Latest Theatrical Releases';
            return 'Latest Releases';
        }
        if (cat === 'top') return 'Top Rated IMDb';
        if (cat === 'tv_hi') return 'Indian Web Series';
        if (cat === 'tv_en') return 'Hollywood Web Series';
        if (cat === 'dice') return `Random (${lang === 'en' ? 'Hollywood' : 'Indian'})`;
        if (cat === 'lang') return 'Language Specific Content';
        if (type === 'tv') return 'Latest Web Series';
        if (type === 'movie' && !lang && !genre) return 'Bollywood Highlights';
        return 'Filtered Content';
    };

    const fetchUrlData = (pageParams = { page: 1 }) => {
        if (s) return movieApi.searchMulti(s, pageParams.page);
        if (k) return movieApi.getMoviesByKeyword(k, pageParams);
        if (cast) return movieApi.getMoviesByCast(cast, pageParams);

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

        if (latest) {
            const params = {
                'primary_release_date.lte': today,
                'first_air_date.lte': today,
                'with_origin_country': 'IN',
                'include_adult': 'true',
                ...pageParams
            };

            if (latest === 'ott') params.with_release_type = 4;
            else if (latest === 'theatrical') params.with_release_type = 3;
            else if (latest === 'all') params.with_release_type = '3|4';

            params.sort_by = 'primary_release_date.desc';
            
            return movieApi.discoverBoth(params);
        }

        const params = {
            sort_by: type === 'tv' && sort === 'popularity.desc' ? 'first_air_date.desc' : sort,
            ...pageParams
        };

        if (type === 'movie') {
            params['primary_release_date.lte'] = today;
        } else {
            params['first_air_date.lte'] = today;
        }

        if (params.sort_by === 'vote_average.desc') {
            params['vote_count.gte'] = 50;
        }

        if (!lang && !genre && !provider && !s && !k && !cat) {
            params.with_original_language = 'hi';
            if (sort === 'popularity.desc') {
                params['vote_average.gte'] = 7;
                params['vote_count.gte'] = 50;
            }
        }

        if (lang) params.with_original_language = lang;
        if (genre) params.with_genres = genre;
        
        if (cat === 'hi') params.with_original_language = 'hi';
        if (cat === 'en') params.with_original_language = 'en';
        if (cat === '16') params.with_genres = '16';
        if (cat === 'top') {
            params.sort_by = 'vote_average.desc';
            params['vote_count.gte'] = 100;
        }

        if (year) {
            if (type === 'movie') params.primary_release_year = year;
            else params.first_air_date_year = year;
        }
        if (provider) {
            params.with_watch_providers = provider;
            params.watch_region = 'IN';
        }

        if (cat === 'tv_hi') {
            params.with_original_language = 'hi';
            return movieApi.discoverTv(params);
        }
        if (cat === 'tv_en') {
            params.with_original_language = 'en';
            return movieApi.discoverTv(params);
        }

        const isTvRequest = type === 'tv' || cat?.startsWith('tv');
        if (isTvRequest) return movieApi.discoverTv(params);
        
        if (cat === 'hi' || cat === 'en' || cat === 'movie' || type === 'movie' || cat === 'top' || cat === '16') {
            return movieApi.discoverMovies(params);
        }

        params['primary_release_date.lte'] = today;
        params['first_air_date.lte'] = today;
        return movieApi.discoverBoth(params);
    };

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
                <div className="section-header">
                    <Flame size={24} color="#fdd835" fill="#fdd835" />
                    <span>{getTitle()}</span>
                </div>

                <MovieGrid
                    key={location.search}
                    fetchUrl={fetchUrlData}
                    searchQuery={s}
                    locationSearch={location.search}
                />

                <footer className="footer" style={{ marginTop: '4rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                    <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved</p>
                </footer>
            </div>
        </div>
    );
};

export default HomePage;
