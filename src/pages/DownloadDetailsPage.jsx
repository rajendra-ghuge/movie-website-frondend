import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronDown, Download, FileText, Languages, Loader2, Play, RefreshCw, Search as SearchIcon } from 'lucide-react';
import { movieApi } from '../api';
import Navbar from '../components/Navbar';
import Disclaimer from '../components/Disclaimer';

const DEFAULT_FILTER_OPTIONS = {
    genres: [
        'All', 'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
        'Documentary', 'Drama', 'Family', 'Fantasy', 'Film-Noir', 'Game-Show',
        'History', 'Horror', 'Music', 'Musical', 'Mystery', 'News', 'Reality-TV',
        'Romance', 'Sci-Fi', 'Short', 'Sport', 'Talk-Show', 'Thriller', 'War',
        'Western', 'Other',
    ],
    countries: [
        'All', 'United States', 'United Kingdom', 'Korea', 'Japan', 'Bangladesh',
        'China', 'Egypt', 'France', 'Germany', 'India', 'Indonesia', 'Iraq',
        'Italy', 'Ivory Coast', 'Kenya', 'Lebanon', 'Mexico', 'Morocco',
        'Nigeria', 'Pakistan', 'Philippines', 'Russia', 'Saudi Arabia',
        'South Africa', 'Spain', 'Syria', 'Thailand', 'Malaysia', 'Turkey',
        'Other',
    ],
    years: [
        'All', '2026', '2025', '2024', '2023', '2022', '2021', '2020',
        '2010s', '2000s', '1990s', '1980s', 'Other',
    ],
    languages: [
        'All', 'English dub', 'French dub', 'Hindi dub', 'Bengali dub',
        'Urdu dub', 'Punjabi dub', 'Tamil dub', 'Telugu dub', 'Malayalam dub',
        'Kannada dub', 'Arabic dub', 'Arabic sub', 'Tagalog dub',
        'Indonesian dub', 'Russian dub', 'Kurdish sub', 'Spanish dub',
        'Spanish sub', 'SpanishLatam dub',
    ],
    sorts: ['ForYou', 'Hottest', 'Latest', 'Rating'],
    channels: [
        { id: 1, label: 'Movies' },
        { id: 2, label: 'TV / Web Shows' },
    ],
};

const DEFAULT_FILTERS = {
    page: 1,
    perPage: 18,
    channelId: 1,
    genre: 'All',
    country: 'India',
    year: 'All',
    language: 'Hindi dub',
    sort: 'Latest',
};

const DOWNLOAD_FILTER_CACHE_KEY = 'download_filter_state';

const readDownloadFilterState = () => {
    try {
        const raw = sessionStorage.getItem(DOWNLOAD_FILTER_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const formatBytes = (size) => {
    if (typeof size === 'string' && /[a-z]/i.test(size)) return size;
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDetailData = (response) => response?.data?.data || {};

const getFilterPaginationMeta = (responseData, page, perPage, itemCount) => {
    const data = responseData?.data || {};
    const pager = data.pager || responseData?.pager || {};
    const currentPage = Number(pager.page || data.page || responseData?.page || page);
    const totalPages = Number(
        pager.totalPages ||
        pager.total_pages ||
        data.totalPages ||
        data.total_pages ||
        data.pageCount ||
        data.pages ||
        responseData?.totalPages ||
        responseData?.total_pages ||
        0
    );
    const totalItems = Number(
        pager.totalCount ||
        pager.total ||
        data.total ||
        data.totalCount ||
        data.total_results ||
        responseData?.total ||
        responseData?.totalCount ||
        0
    );
    const nextPage = Number(pager.nextPage || data.nextPage || responseData?.nextPage || 0);

    if (typeof pager.hasMore === 'boolean') return { currentPage, hasMore: pager.hasMore };
    if (typeof pager.hasNext === 'boolean') return { currentPage, hasMore: pager.hasNext };
    if (typeof data.hasMore === 'boolean') return { currentPage, hasMore: data.hasMore };
    if (typeof data.hasNext === 'boolean') return { currentPage, hasMore: data.hasNext };
    if (nextPage > currentPage) return { currentPage, hasMore: true };
    if (totalPages > 0) return { currentPage, hasMore: currentPage < totalPages };
    if (totalItems > 0) return { currentPage, hasMore: currentPage * perPage < totalItems };
    return { currentPage, hasMore: itemCount >= perPage };
};

const getApiErrorMessage = (error, fallback) => {
    const detail = error.response?.data?.detail;
    const message = typeof detail === 'string'
        ? detail
        : detail?.error || error.message || fallback;

    if (
        /https?:\/\//i.test(message) ||
        /h5-api|aoneroom|wefeed|videodownloader|BuildConfig|ENOTFOUND|ECONN|timeout|Failed to fetch|Network Error/i.test(message)
    ) {
        return 'Service is not reachable. Please try again.';
    }

    if (error.response?.status) return `${fallback} (${error.response.status})`;
    return message;
};

const normalizeTitleForMatch = (value) => {
    return String(value || '')
        .replace(/\[[^\]]*]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\bS\d+(?:\s*-\s*S?\d+)?\b/gi, ' ')
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
};

const callNative = (method, args, eventSuccess, eventError) => {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        const onSuccess = (e) => {
            if (e.detail.requestId === requestId) {
                window.removeEventListener(eventSuccess, onSuccess);
                window.removeEventListener(eventError, onError);
                resolve({ data: e.detail.data });
            }
        };
        const onError = (e) => {
            if (e.detail.requestId === requestId) {
                window.removeEventListener(eventSuccess, onSuccess);
                window.removeEventListener(eventError, onError);
                reject({ response: { data: { detail: e.detail.message } } });
            }
        };
        window.addEventListener(eventSuccess, onSuccess);
        window.addEventListener(eventError, onError);
        window.AndroidApp[method](...args, requestId);
    });
};

const DownloadDetailsPage = () => {
    const location = useLocation();
    const isApk = Boolean(window.AndroidApp);
    const autoSearchRef = useRef('');
    const cachedFilterStateRef = useRef(readDownloadFilterState());
    const didPushDetailHistoryRef = useRef(false);
    const cachedFilterState = cachedFilterStateRef.current || {};
    const [query, setQuery] = useState('');
    const [releaseYear, setReleaseYear] = useState('');
    const [mediaType, setMediaType] = useState('');
    const [tmdbId, setTmdbId] = useState('');
    const [results, setResults] = useState(() => cachedFilterState.results || []);
    const [selectedItem, setSelectedItem] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailPath, setDetailPath] = useState('');
    const [selectedSeason, setSelectedSeason] = useState('');
    const [selectedEpisode, setSelectedEpisode] = useState('');
    const [manualSeason, setManualSeason] = useState('1');
    const [manualEpisode, setManualEpisode] = useState('1');
    const [downloadData, setDownloadData] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isDownloadLoading, setIsDownloadLoading] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [detailError, setDetailError] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [isCaptionsOpen, setIsCaptionsOpen] = useState(false);
    const filterOptions = DEFAULT_FILTER_OPTIONS;
    const [filters, setFilters] = useState(() => cachedFilterState.filters || DEFAULT_FILTERS);
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [isFilterMode, setIsFilterMode] = useState(() => Boolean(cachedFilterState.isFilterMode));
    const [filterPage, setFilterPage] = useState(() => cachedFilterState.filterPage || 1);
    const [hasMoreFilterResults, setHasMoreFilterResults] = useState(() => Boolean(cachedFilterState.hasMoreFilterResults));
    const [isLoadingMoreFilters, setIsLoadingMoreFilters] = useState(false);
    const resultCardRefs = useRef([]);

    const subject = detailData?.subject || null;
    const dubs = useMemo(() => detailData?.dubs || [], [detailData]);
    const dubOptions = useMemo(() => dubs.filter((dub) => dub.type === 0), [dubs]);
    const seasons = useMemo(() => detailData?.seasons || [], [detailData]);
    const isSeries = detailData?.isSeries || subject?.subjectType === 2;
    const isMovie = detailData?.isMovie || (subject && subject.subjectType !== 2);
    const activeSubjectId = subject?.subjectId || selectedItem?.subjectId || '';
    const activeDetailPath = subject?.detailPath || detailPath || selectedItem?.detailPath || '';
    const downloads = downloadData?.downloads || [];
    const captions = downloadData?.captions || [];
    const canWatchFallback = Boolean(tmdbId && mediaType);
    const showNavFilterPanel = location.pathname === '/downloads' && !location.search && !selectedItem;

    const filteredResults = useMemo(() => {
        const normalizedQuery = normalizeTitleForMatch(query);
        if (!normalizedQuery) return results;

        return results.filter((item) => {
            const itemTitleLower = item.title.toLowerCase();
            const queryLower = query.toLowerCase();

            // 1. Filter out obvious junk (Music Videos, Promos)
            const STRICT_JUNK = ['video song', 'music video', 'lyrical video', 'promo video', 'hook step', 'official song'];
            const hasStrictJunk = STRICT_JUNK.some(word => itemTitleLower.includes(word) && !queryLower.includes(word));
            if (hasStrictJunk) return false;

            // Use of | usually indicates a "Song | Movie" format
            if (itemTitleLower.includes('|') && !queryLower.includes('|')) return false;

            // 2. Title Matching - Bidirectional & Lenient
            const itemTitle = normalizeTitleForMatch(item.title);
            const isTitleMatch = itemTitle === normalizedQuery ||
                               itemTitle.includes(normalizedQuery) ||
                               normalizedQuery.includes(itemTitle);

            if (!isTitleMatch) return false;

            // 3. Date Matching - Very Lenient (Allow ±5 years for regional/metadata variance)
            const queryYear = parseInt(releaseYear?.slice(0, 4), 10);
            const itemYear = parseInt(item.releaseDate?.slice(0, 4), 10);

            if (!Number.isNaN(queryYear) && !Number.isNaN(itemYear)) {
                if (Math.abs(itemYear - queryYear) > 5) return false;
            }

            return true;
        });
    }, [query, releaseYear, results]);

    const selectedSeasonMeta = useMemo(() => {
        return seasons.find((season) => String(season.se) === String(selectedSeason));
    }, [seasons, selectedSeason]);

    const episodeOptions = useMemo(() => {
        const maxEp = Number(selectedSeasonMeta?.maxEp || 0);
        if (!maxEp) return [];
        return Array.from({ length: maxEp }, (_, index) => index + 1);
    }, [selectedSeasonMeta]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (location.pathname !== '/downloads' || location.search) return;

        try {
            sessionStorage.setItem(DOWNLOAD_FILTER_CACHE_KEY, JSON.stringify({
                filters,
                results,
                isFilterMode,
                filterPage,
                hasMoreFilterResults,
            }));
        } catch {
            // Ignore storage failures; the downloader still works without cache.
        }
    }, [filterPage, filters, hasMoreFilterResults, isFilterMode, location.pathname, location.search, results]);

    useEffect(() => {
        const handlePopState = () => {
            if (!didPushDetailHistoryRef.current) return;
            didPushDetailHistoryRef.current = false;
            setSelectedItem(null);
            setDetailData(null);
            setDetailPath('');
            setDownloadData(null);
            setDetailError('');
            setDownloadError('');
            setIsCaptionsOpen(false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const loadDetail = useCallback(async (nextDetailPath, baseItem = selectedItem) => {
        if (!nextDetailPath) return;

        if (baseItem && !selectedItem && !didPushDetailHistoryRef.current && location.pathname === '/downloads') {
            window.history.pushState({ downloaderDetail: true }, '', window.location.href);
            didPushDetailHistoryRef.current = true;
        }

        setIsDetailLoading(true);
        setDetailError('');
        setDownloadData(null);
        setDownloadError('');
        setIsCaptionsOpen(false);
        setDetailPath(nextDetailPath);

        try {
            const response = isApk
                ? await callNative('aoneroomDetail', [nextDetailPath], 'apk-aoneroom-detail-result', 'apk-aoneroom-detail-error')
                : await movieApi.getAoneroomDetail(nextDetailPath);
            const nextDetailData = getDetailData(response);
            const nextSeasons = nextDetailData.seasons || [];

            setDetailData(nextDetailData);
            if (baseItem) setSelectedItem(baseItem);

            if (nextDetailData.isSeries || nextDetailData.subject?.subjectType === 2) {
                const firstSeason = nextSeasons[0];
                setSelectedSeason(firstSeason ? String(firstSeason.se) : '');
                setSelectedEpisode(firstSeason?.maxEp ? '1' : '');
            } else {
                setSelectedSeason('');
                setSelectedEpisode('');
            }
        } catch (error) {
            setDetailData(null);
            setDetailError(getApiErrorMessage(error, 'Could not load title details.'));
        } finally {
            setIsDetailLoading(false);
        }
    }, [isApk, location.pathname, selectedItem]);

    const runSearch = useCallback(async (keyword) => {
        if (!keyword) return;

        setIsSearching(true);
        setSearchError('');
        setResults([]);
        setIsFilterMode(false);
        setHasMoreFilterResults(false);
        setSelectedItem(null);
        setDetailData(null);
        setDownloadData(null);

        try {
            const response = isApk
                ? await callNative('aoneroomSearch', [keyword, 1, 30, 0], 'apk-aoneroom-search-result', 'apk-aoneroom-search-error')
                : await movieApi.searchAoneroom(keyword, {
                    page: 1,
                    perPage: 30,
                    subjectType: 0,
                });
            setResults(response.data?.data?.items || []);
        } catch (error) {
            setSearchError(getApiErrorMessage(error, 'Search failed.'));
        } finally {
            setIsSearching(false);
        }
    }, [isApk]);

    const handleFilterChange = (name, value) => {
        setFilters((current) => ({ ...current, [name]: value }));
    };

    const fetchFilterPage = useCallback(async (page, replace = false) => {
        if (replace) {
            setIsSearching(true);
        } else {
            setIsLoadingMoreFilters(true);
        }
        setSearchError('');

        try {
            if (!isApk) {
                throw new Error('Filter search is available in the Android app only.');
            }

            const response = await callNative(
                'aoneroomFilter',
                [
                    page,
                    filters.perPage,
                    filters.channelId,
                    filters.genre,
                    filters.country,
                    filters.year,
                    filters.language,
                    filters.sort,
                ],
                'apk-aoneroom-filter-result',
                'apk-aoneroom-filter-error'
            );
            const nextItems = response.data?.data?.items || [];
            const pagination = getFilterPaginationMeta(response.data, page, filters.perPage, nextItems.length);

            setResults((current) => {
                if (replace) return nextItems;

                const seen = new Set(current.map((item) => `${item.subjectId}-${item.detailPath}`));
                const uniqueItems = nextItems.filter((item) => !seen.has(`${item.subjectId}-${item.detailPath}`));
                return [...current, ...uniqueItems];
            });
            setFilterPage(pagination.currentPage);
            setHasMoreFilterResults(pagination.hasMore);
        } catch (error) {
            setSearchError(getApiErrorMessage(error, 'Filter search failed.'));
            setHasMoreFilterResults(false);
        } finally {
            if (replace) {
                setIsSearching(false);
            } else {
                setIsLoadingMoreFilters(false);
            }
        }
    }, [filters, isApk]);

    const runFilterSearch = useCallback(async () => {
        setResults([]);
        setQuery('');
        setReleaseYear('');
        setMediaType('');
        setTmdbId('');
        setSelectedItem(null);
        setDetailData(null);
        setDownloadData(null);
        setIsFilterMode(true);
        setFilterPage(1);
        setHasMoreFilterResults(false);
        setIsFilterDropdownOpen(false);
        resultCardRefs.current = [];
        await fetchFilterPage(1, true);
    }, [fetchFilterPage]);

    const loadNextFilterPage = useCallback(() => {
        if (!isFilterMode || selectedItem || !hasMoreFilterResults || isSearching || isLoadingMoreFilters) return;
        fetchFilterPage(filterPage + 1);
    }, [
        fetchFilterPage,
        filterPage,
        hasMoreFilterResults,
        isFilterMode,
        isLoadingMoreFilters,
        isSearching,
        selectedItem,
    ]);

    useEffect(() => {
        if (!isFilterMode || selectedItem || !hasMoreFilterResults || isSearching || isLoadingMoreFilters) return;

        const triggerIdx = Math.max(filteredResults.length - 2, 0);
        const triggerCard = resultCardRefs.current[triggerIdx];
        if (!triggerCard) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) loadNextFilterPage();
        }, { root: null, rootMargin: '0px', threshold: 0.35 });

        observer.observe(triggerCard);
        return () => observer.disconnect();
    }, [
        filteredResults.length,
        hasMoreFilterResults,
        isFilterMode,
        isLoadingMoreFilters,
        isSearching,
        loadNextFilterPage,
        selectedItem,
    ]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const searchTitle = (params.get('s') || '').trim();
        const year = (params.get('year') || '').trim();
        const type = (params.get('type') || '').trim();
        const id = (params.get('id') || '').trim();

        setTmdbId(id);

        if (!searchTitle || autoSearchRef.current === searchTitle) return;

        autoSearchRef.current = searchTitle;
        setQuery(searchTitle);
        setReleaseYear(year);
        setMediaType(type);
        runSearch(searchTitle);
    }, [location.search, runSearch]);

    const loadDownloadDetails = useCallback(async (override = {}) => {
        const subjectId = override.subjectId || activeSubjectId;
        const path = override.detailPath || activeDetailPath;
        const se = override.se ?? 0;
        const ep = override.ep ?? 0;

        if (!subjectId || !path) return;

        setIsDownloadLoading(true);
        setDownloadError('');

        try {
            const response = isApk
                ? await callNative('aoneroomDownload', [subjectId, path, se, ep], 'apk-aoneroom-download-result', 'apk-aoneroom-download-error')
                : await movieApi.getAoneroomDownload({
                    subjectId,
                    detailPath: path,
                    se,
                    ep,
                });
            setDownloadData(response.data?.data || { downloads: [], captions: [] });
            setIsCaptionsOpen(false);
        } catch (error) {
            setDownloadData(null);
            setDownloadError(getApiErrorMessage(error, 'Download details unavailable.'));
        } finally {
            setIsDownloadLoading(false);
        }
    }, [activeDetailPath, activeSubjectId, isApk]);

    useEffect(() => {
        if (!subject || !activeSubjectId || !activeDetailPath) return;

        if (isMovie) {
            loadDownloadDetails({ se: 0, ep: 0 });
            return;
        }

        if (isSeries && selectedSeason && selectedEpisode) {
            loadDownloadDetails({
                se: Number(selectedSeason),
                ep: Number(selectedEpisode),
            });
        }
    }, [activeDetailPath, activeSubjectId, isMovie, isSeries, loadDownloadDetails, selectedEpisode, selectedSeason, subject]);

    const handleManualDownload = () => {
        loadDownloadDetails({
            se: Number(manualSeason) || 1,
            ep: Number(manualEpisode) || 1,
        });
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <main className={`download-page${selectedItem ? ' download-page--selected' : ' download-page--results'}`}>
                {!selectedItem && (
                <section className="download-search-panel">
                    {showNavFilterPanel && (
                        <div className="download-filter-panel">
                            <button
                                type="button"
                                className="download-filter-toggle"
                                onClick={() => setIsFilterDropdownOpen((open) => !open)}
                                aria-expanded={isFilterDropdownOpen}
                            >
                                <span>Apply Filter</span>
                                <ChevronDown size={18} className={isFilterDropdownOpen ? 'rotate-180' : ''} />
                            </button>
                            {isFilterDropdownOpen && (
                                <div className="download-filter-menu">
                                    <div className="download-filter-grid">
                                        <label>
                                            <span>Channel</span>
                                            <select value={filters.channelId} onChange={(event) => handleFilterChange('channelId', Number(event.target.value))}>
                                                {filterOptions.channels.map((channel) => (
                                                    <option key={channel.id} value={channel.id}>{channel.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Genre</span>
                                            <select value={filters.genre} onChange={(event) => handleFilterChange('genre', event.target.value)}>
                                                {filterOptions.genres.map((genre) => (
                                                    <option key={genre} value={genre}>{genre}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Country</span>
                                            <select value={filters.country} onChange={(event) => handleFilterChange('country', event.target.value)}>
                                                {filterOptions.countries.map((country) => (
                                                    <option key={country} value={country}>{country}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Year</span>
                                            <select value={filters.year} onChange={(event) => handleFilterChange('year', event.target.value)}>
                                                {filterOptions.years.map((year) => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Language</span>
                                            <select value={filters.language} onChange={(event) => handleFilterChange('language', event.target.value)}>
                                                {filterOptions.languages.map((language) => (
                                                    <option key={language} value={language}>{language}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span>Sort by</span>
                                            <select value={filters.sort} onChange={(event) => handleFilterChange('sort', event.target.value)}>
                                                {filterOptions.sorts.map((sort) => (
                                                    <option key={sort} value={sort}>{sort}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <button type="button" className="download-filter-search-btn" onClick={runFilterSearch} disabled={isSearching}>
                                        {isSearching ? <Loader2 className="animate-spin" size={18} /> : <SearchIcon size={18} />}
                                        Search
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {showNavFilterPanel && !isFilterDropdownOpen && filteredResults.length === 0 && !isSearching && !searchError && (
                        <div className="download-filter-empty">
                            <Download size={34} />
                            <p>Search any movies or web shows, or apply filter.</p>
                        </div>
                    )}

                    {isSearching && (
                        <div className="download-loading-row">
                            <Loader2 className="animate-spin" size={18} />
                            <span>Searching...</span>
                        </div>
                    )}

                    {searchError && (
                        <div className="download-error-state">
                            <p className="download-state-text error">{searchError}</p>
                            <button type="button" className="download-retry-btn" onClick={() => window.location.reload()}>
                                <RefreshCw size={16} /> Retry Search
                            </button>
                        </div>
                    )}

                    {!selectedItem && query && !isSearching && !searchError && filteredResults.length === 0 && (
                        <div className="download-empty-panel">
                            <Download size={34} />
                            <p>No download link available.</p>
                            {canWatchFallback && (
                                <>
                                    <p className="download-watch-prompt">You can still watch this title online:</p>
                                    <Link to={`/watch/${mediaType}/${tmdbId}`} className="btn-watch">
                                        <Play size={20} fill="currentColor" /> Watch Now
                                    </Link>
                                </>
                            )}
                        </div>
                    )}

                    {!selectedItem && filteredResults.length > 0 && (
                        <>
                            <div className="download-results movie-grid">
                                {filteredResults.map((item, index) => (
                                    <button
                                        key={`${item.subjectId}-${item.detailPath}`}
                                        ref={el => { resultCardRefs.current[index] = el; }}
                                        type="button"
                                        className="download-result-card movie-card"
                                        onClick={() => loadDetail(item.detailPath, item)}
                                    >
                                        <div className="poster-container">
                                            <img
                                                src={item.cover?.url || movieApi.getImageUrl(null)}
                                                alt={item.title}
                                                className="movie-poster"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="card-info download-result-info">
                                            <h3 className="card-name">{item.title}</h3>
                                            <p className="card-meta">{item.releaseDate?.slice(0, 4) || 'N/A'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {isLoadingMoreFilters && (
                                <div className="infinite-loader" aria-live="polite">
                                    <Loader2 className="animate-spin" size={22} />
                                </div>
                            )}
                        </>
                    )}
                </section>
                )}

                <section className="download-detail-panel">
                    {!selectedItem && (
                        <div className="download-empty-panel">
                            <Download size={34} />
                            <p>Search and select a title to view download details.</p>
                        </div>
                    )}

                    {selectedItem && isDetailLoading && (
                        <div className="download-empty-panel">
                            <Loader2 className="animate-spin" size={32} />
                            <p>Loading title details...</p>
                        </div>
                    )}

                    {detailError && (
                        <div className="download-error-state">
                            <p className="download-state-text error">{detailError}</p>
                            <button type="button" className="download-retry-btn" onClick={() => window.location.reload()}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    )}

                    {subject && !isDetailLoading && (
                        <>
                            

                            {dubOptions.length > 0 && (
                                <div className="download-control-group download-control-with-poster">
                                    <div className="download-poster-left">
                                        <img src={subject.cover?.url || selectedItem.cover?.url || movieApi.getImageUrl(null)} alt="poster" />
                                    </div>
                                    <div className="download-control-body">
                                        <h2><Languages size={18} /> Audio Language</h2>
                                        <div className="download-chip-list">
                                            {dubOptions.map((dub) => (
                                                <button
                                                    key={`${dub.subjectId}-${dub.detailPath}`}
                                                    type="button"
                                                    className={`download-chip${activeDetailPath === dub.detailPath ? ' active' : ''}`}
                                                    onClick={() => loadDetail(dub.detailPath)}
                                                >
                                                    {dub.lanName || 'Unknown'} <small>DUB</small>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isSeries && seasons.length > 0 && (
                                <div className="download-control-grid">
                                    <label>
                                        <span>Season</span>
                                        <select value={selectedSeason} onChange={(event) => {
                                            setSelectedSeason(event.target.value);
                                            setSelectedEpisode('1');
                                        }}>
                                            {seasons.map((season) => (
                                                <option key={season.se} value={season.se}>
                                                    Season {season.se} - Episodes {season.episodeRange}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Episode</span>
                                        <select value={selectedEpisode} onChange={(event) => setSelectedEpisode(event.target.value)}>
                                            {episodeOptions.map((episode) => (
                                                <option key={episode} value={episode}>Episode {episode}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            )}

                            {isSeries && seasons.length === 0 && (
                                <div className="download-control-grid">
                                    <label>
                                        <span>Season</span>
                                        <input type="number" min="1" value={manualSeason} onChange={(event) => setManualSeason(event.target.value)} />
                                    </label>
                                    <label>
                                        <span>Episode</span>
                                        <input type="number" min="1" value={manualEpisode} onChange={(event) => setManualEpisode(event.target.value)} />
                                    </label>
                                    <button type="button" className="download-primary-btn" onClick={handleManualDownload}>
                                        Get Download Details
                                    </button>
                                </div>
                            )}

                            <div className="download-links-panel">
                                <div className="download-links-header">
                                    <h2>Download Details</h2>
                                    {isDownloadLoading && <Loader2 className="animate-spin" size={20} />}
                                </div>

                                {downloadError && (
                                    <div className="download-error-state">
                                        <p className="download-state-text error">{downloadError}</p>
                                        <button type="button" className="download-retry-btn" onClick={() => window.location.reload()}>
                                            <RefreshCw size={16} /> Retry
                                        </button>
                                    </div>
                                )}
                                {!isDownloadLoading && downloadData && downloads.length === 0 && captions.length === 0 && (
                                    <p className="download-state-text">No download links found.</p>
                                )}

                                {downloads.length > 0 && (
                                    <div className="download-quality-grid">
                                        {downloads.map((download, index) => (
                                            <a
                                                key={`${download.id || download.url}-${index}`}
                                                className="download-quality-card"
                                                href={download.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => {
                                                    if (isApk) {
                                                        e.preventDefault();
                                                        const filename = `${subject.title}${isSeries ? ` S${selectedSeason}E${selectedEpisode}` : ''} ${download.resolution ? `${download.resolution}p` : `Q${index + 1}`}.${download.format || 'mp4'}`;
                                                        window.AndroidApp.downloadFile(download.url, filename, 'primary', isSeries ? 'tv' : 'movie');
                                                    }
                                                }}
                                            >
                                                <Download size={18} />
                                                <strong>{download.resolution ? `${download.resolution}p` : `Quality ${index + 1}`}</strong>
                                                <span>{download.format || 'Video'} {formatBytes(download.size) && `- ${formatBytes(download.size)}`}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}

                                {captions.length > 0 && (
                                    <div className="download-caption-list">
                                        <button
                                            type="button"
                                            className="download-caption-toggle"
                                            onClick={() => setIsCaptionsOpen((open) => !open)}
                                            aria-expanded={isCaptionsOpen}
                                        >
                                            <span><FileText size={16} /> Captions</span>
                                            <small>{captions.length}</small>
                                            <ChevronDown size={16} className={isCaptionsOpen ? 'rotate-180' : ''} />
                                        </button>
                                        {isCaptionsOpen && (
                                            <div className="download-caption-items">
                                                {captions.map((caption, index) => (
                                                <a
                                                    key={`${caption.id || caption.url}-${index}`}
                                                    href={caption.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => {
                                                        if (isApk) {
                                                            e.preventDefault();
                                                            const filename = `${subject.title}${isSeries ? ` S${selectedSeason}E${selectedEpisode}` : ''} ${caption.lanName || caption.lan || `Caption ${index + 1}`}.${caption.format || 'srt'}`;
                                                            window.AndroidApp.downloadFile(caption.url, filename, 'primary', 'caption');
                                                        }
                                                    }}
                                                >
                                                    <FileText size={16} />
                                                    <span>{caption.lanName || caption.lan || `Caption ${index + 1}`}</span>
                                                </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </main>
            <footer className="footer">
                <p>&copy; 2026 4KHDHUB India &bull; All Rights Reserved &bull; <Disclaimer /></p>
            </footer>
        </div>
    );
};

export default DownloadDetailsPage;
