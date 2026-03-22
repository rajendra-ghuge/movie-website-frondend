import { useState, useMemo } from 'react';
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
    const year = query.get('y') || query.get('year');

    const getTitle = () => {
        if (s) return `Search results for "${s}"`;
        if (k && kn) return `Keyword: ${kn}`;
        if (cat === 'hi') return 'Bollywood Movies';
        if (cat === 'en') return 'Hollywood Movies';
        if (cat === '16') return 'Anime Series';
        if (cat === 'ott') return 'OTT Specials';
        if (cat === 'top') return 'Top Rated IMDb';
        if (cat === 'tv_hi') return 'Indian Web Series';
        if (cat === 'tv_en') return 'Hollywood Web Series';
        if (cat === 'lang') return 'Language Specific Content';
        if (type === 'tv') return 'Latest Web Series';
        if (type === 'movie' && !lang && !genre) return 'Bollywood Highlights';
        return 'Filtered Content';
    };

    const fetchUrlData = (pageParams = { page: 1 }) => {
        if (s) return movieApi.searchMulti(s, pageParams.page);
        if (k) return movieApi.getMoviesByKeyword(k, pageParams);

        const today = new Date().toISOString().split('T')[0];
        const params = {
            sort_by: type === 'tv' && sort === 'popularity.desc' ? 'first_air_date.desc' : sort,
            ...pageParams
        };

        // Don't show upcoming/future releases
        if (type === 'movie') {
            params['primary_release_date.lte'] = today;
        } else {
            params['first_air_date.lte'] = today;
        }

        // Increase vote count requirement for Rating sort
        if (params.sort_by === 'vote_average.desc') {
            params['vote_count.gte'] = 50;
        }

        // Default to Indian Content (Hindi) if no specific filters are applied
        if (!lang && !genre && !provider && !s && !k && !cat) {
            params.with_original_language = 'hi';
            if (sort === 'popularity.desc') {
                params['vote_average.gte'] = 7;
                params['vote_count.gte'] = 50;
            }
        }

        if (lang) params.with_original_language = lang;
        if (genre) params.with_genres = genre;
        if (year) {
            if (type === 'movie') params.primary_release_year = year;
            else params.first_air_date_year = year;
        }
        if (provider) {
            params.with_watch_providers = provider;
            params.watch_region = 'IN';
        }

        // Handle specific type requests (Movies or Web Series menus)
        if (cat === 'movie' || type === 'movie' || cat === 'tv' || type === 'tv' || cat === 'tv_hi' || cat === 'tv_en') {
            return type === 'movie' ? movieApi.discoverMovies(params) : movieApi.discoverTv(params);
        }

        // For Home, Bollywood, Hollywood, OTT - Show BOTH
        // Pass both date limits for combined discovery
        params['primary_release_date.lte'] = today;
        params['first_air_date.lte'] = today;
        return movieApi.discoverBoth(params);
    };

    return (
        <div className="page-wrapper">
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
                />

                <footer className="footer" style={{ marginTop: '4rem', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
                    <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved</p>
                </footer>
            </div>
        </div>
    );
};

export default HomePage;
