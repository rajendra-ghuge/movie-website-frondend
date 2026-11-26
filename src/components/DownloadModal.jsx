import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    X, 
    Download, 
    Zap, 
    ExternalLink, 
    Loader2, 
    AlertCircle, 
    RefreshCw, 
    HardDrive,
    Copy,
    Check,
    Volume2,
    Layers,
    Server,
    Package
} from 'lucide-react';
import { movieApi } from '../api';

/**
 * Parses release filenames into clean metadata chips and tags.
 * e.g. "Doctor Strange (2016) {Hindi-English} 1080p {60FPS} BluRay 10bit HEVC DD+5.1 [5.7GB]"
 */
const parseReleaseInfo = (rawTitle = '', showTitle = '') => {
    if (!rawTitle) {
        return { cleanTitle: '', audio: '', tags: [] };
    }

    const tags = [];
    let working = rawTitle;

    // 1. Audio Language Detection (e.g. {Hindi-English}, {Hindi-Korean}, Dual Audio, etc.)
    let audio = '';
    const audioMatch = working.match(/\{([^{}]+(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Chinese|Spanish|French|German|Dual|Multi)[^{}]*)\}/i) 
        || working.match(/\[([^\]]+(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Chinese|Spanish|French|German|Dual|Multi)[^\]]*)\]/i)
        || working.match(/\b(Dual[- ]Audio|Multi[- ]Audio|Hindi[-+]English|Hindi[-+]Korean)\b/i);
    if (audioMatch) {
        audio = audioMatch[1]
            .replace(/[-+–]/g, ' + ')
            .replace(/Dual Audio/i, 'Dual Audio')
            .replace(/\s+/g, ' ')
            .trim();
        working = working.replace(audioMatch[0], ' ');
    }

    // 2. Audio Format / Channels (e.g. DD+5.1, Atmos, AAC2.0)
    const audioChMatch = working.match(/\b(DD\+?5\.1|DD5\.1|5\.1|AAC2\.0|AAC|Atmos|DTS[- ]?HD|DTS)\b/i);
    if (audioChMatch) {
        tags.push(audioChMatch[1].toUpperCase());
        working = working.replace(audioChMatch[0], ' ');
    }

    // 3. Frame Rate (e.g. 60FPS)
    const fpsMatch = working.match(/\{?(\d{2,3}FPS)\}?/i);
    if (fpsMatch) {
        tags.push(fpsMatch[1].toUpperCase());
        working = working.replace(fpsMatch[0], ' ');
    }

    // 4. Color Depth / Dynamic Range (e.g. 10-bit, HDR, DV)
    const hdrMatch = working.match(/\b(10[- ]?bit|HDR10\+?|HDR|Dolby[- ]Vision|DV)\b/i);
    if (hdrMatch) {
        tags.push(hdrMatch[1].toUpperCase());
        working = working.replace(hdrMatch[0], ' ');
    }

    // 5. Source / Rip Type (e.g. BluRay, WEB-DL, WEBRip, IMAX)
    const sourceMatch = working.match(/\b(BluRay|WEB[- ]?DL|WEBRip|HDRip|HDTV|IMAX[- ]?Enhanced|IMAX)\b/i);
    if (sourceMatch) {
        tags.push(sourceMatch[1]);
        working = working.replace(sourceMatch[0], ' ');
    }

    // 6. Video Codec (e.g. HEVC, x265, x264, AV1)
    const codecMatch = working.match(/\b(x265|HEVC|x264|H\.?264|H\.?265|AV1)\b/i);
    if (codecMatch) {
        tags.push(codecMatch[1].toUpperCase());
        working = working.replace(codecMatch[0], ' ');
    }

    // 7. Strip resolution, file sizes, redundant show title, season labels & brackets
    if (showTitle) {
        try {
            const escaped = showTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            working = working.replace(new RegExp(escaped, 'gi'), ' ');
        } catch {
            // ignore
        }
    }

    working = working
        .replace(/\b(2160p|4K|1080p|720p|480p)\b/gi, ' ')
        .replace(/\[\d+(\.\d+)?\s*(GB|MB)(\/E)?\]/gi, ' ')
        .replace(/\{[^{}]*\}\s*/g, ' ')
        .replace(/\[[^\]]*\]\s*/g, ' ')
        .replace(/\b(Season\s*\d+|S\d+)\b/gi, ' ')
        .replace(/[-–—]\s*/g, ' ')
        .replace(/\(\s*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        cleanTitle: working,
        audio,
        tags: Array.from(new Set(tags)),
    };
};

const DownloadModal = ({
    isOpen,
    onClose,
    type = 'movie',
    id,
    title = '',
    season = 1,
    episode = 1,
    seasons = [],
    totalEpisodes = null,
}) => {
    const isTv = type === 'tv';
    const [selectedSeason, setSelectedSeason] = useState(season || 1);
    const [selectedEpisode, setSelectedEpisode] = useState(episode || 1);
    const [isPackMode, setIsPackMode] = useState(false);
    const [activeQualityFilter, setActiveQualityFilter] = useState('ALL');
    const [copiedKey, setCopiedKey] = useState(null);

    useEffect(() => {
        setSelectedSeason(season || 1);
        setSelectedEpisode(episode || 1);
    }, [season, episode, id]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent background scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const {
        data: downloadData,
        isLoading,
        isFetching,
        error,
        refetch
    } = useQuery({
        queryKey: ['fast-downloads', type, id, selectedSeason, isPackMode ? 'pack' : selectedEpisode],
        queryFn: () => movieApi.getDownloads(type, id, selectedSeason, isPackMode ? 1 : selectedEpisode, isPackMode),
        enabled: Boolean(isOpen && id),
        staleTime: 10 * 60 * 1000,
    });

    const downloads = useMemo(() => downloadData?.downloads || [], [downloadData?.downloads]);
    const hasDownloads = downloads.length > 0;

    // Available seasons: combine seasons returned by backend API with TMDB seasons prop
    const availableSeasons = useMemo(() => {
        const fromApi = downloadData?.available_seasons || [];
        const fromProps = (seasons || [])
            .map(s => (typeof s === 'object' ? s.season_number : s))
            .filter(n => typeof n === 'number' && n > 0);
        const combined = Array.from(new Set([...fromApi, ...fromProps]));
        if (combined.length > 0) {
            return combined.sort((a, b) => a - b);
        }
        if (selectedSeason) return [selectedSeason];
        return [1];
    }, [downloadData?.available_seasons, seasons, selectedSeason]);

    // Available episodes for selected season
    const episodeList = useMemo(() => {
        const currentSeasonObj = (seasons || []).find(
            s => (typeof s === 'object' ? s.season_number : s) === selectedSeason
        );
        const count = currentSeasonObj?.episode_count || totalEpisodes || 10;
        return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1);
    }, [seasons, selectedSeason, totalEpisodes]);

    // Collect available qualities for tabs (e.g. ALL, 4K, 1080p, 720p, 480p)
    const availableQualities = useMemo(() => {
        if (!downloads.length) return ['ALL'];
        const set = new Set();
        downloads.forEach((d) => {
            const q = (d.quality || '').toUpperCase().trim();
            if (q) set.add(q);
        });
        return ['ALL', ...Array.from(set)];
    }, [downloads]);

    // Filter downloads based on selected quality tab
    const filteredDownloads = useMemo(() => {
        if (activeQualityFilter === 'ALL') return downloads;
        return downloads.filter((d) => {
            const q = (d.quality || '').toUpperCase().trim();
            return q === activeQualityFilter;
        });
    }, [downloads, activeQualityFilter]);

    if (!isOpen) return null;

    const handleSeasonChange = (sNum) => {
        setSelectedSeason(sNum);
        setActiveQualityFilter('ALL');
    };

    const handleSelectPack = () => {
        setIsPackMode(true);
        setActiveQualityFilter('ALL');
    };

    const handleSelectEpisode = (epNum) => {
        setIsPackMode(false);
        setSelectedEpisode(epNum);
        setActiveQualityFilter('ALL');
    };

    const handleDirectDownload = (url) => {
        if (!url) return;
        window.location.assign(url);
    };

    const handleCopy = (url, key) => {
        if (!url) return;
        navigator.clipboard?.writeText(url);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2500);
    };

    return (
        <div className="download-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="download-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="download-modal-header">
                    <div className="download-header-left">
                        <span className="download-tag">
                            <Zap size={13} className="tag-icon" />
                            <span className="desktop-text">FAST CLOUD DOWNLOADS</span>
                            <span className="mobile-text">FAST DOWNLOADS</span>
                        </span>
                        <h2 className="download-title">{title}</h2>
                        {isTv && (
                            <span className="download-subtitle">
                                Season {selectedSeason} &bull; {isPackMode ? 'Complete Season Pack' : `EP ${selectedEpisode}`}
                            </span>
                        )}
                    </div>
                    <button 
                        type="button" 
                        className="download-close-btn" 
                        onClick={onClose}
                        aria-label="Close download modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Season Switcher for TV Series */}
                {isTv && availableSeasons.length > 1 && (
                    <div className="download-season-selector">
                        <span className="selector-label desktop-text">Season:</span>
                        <div className="season-chips-scroll">
                            {availableSeasons.map((sNum) => (
                                <button
                                    key={sNum}
                                    type="button"
                                    className={`season-chip ${selectedSeason === sNum ? 'active' : ''}`}
                                    onClick={() => handleSeasonChange(sNum)}
                                >
                                    <span className="desktop-text">Season {sNum}</span>
                                    <span className="mobile-text">S{sNum}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Download Type & Episode Selector for TV Series */}
                {isTv && (
                    <div className="download-ep-selector">
                        <span className="selector-label desktop-text">Download:</span>
                        <div className="ep-chips-scroll">
                            {/* 📦 Full Season Pack Option */}
                            <button
                                type="button"
                                className={`ep-chip ep-chip-pack ${isPackMode ? 'active' : ''}`}
                                onClick={handleSelectPack}
                                title="Download complete season archive (all episodes in one batch)"
                            >
                                <Package size={13} />
                                <span className="desktop-text">Full Season Pack</span>
                                <span className="mobile-text">Season Pack</span>
                            </button>

                            {/* Individual Episodes */}
                            {episodeList.map((epNum) => (
                                <button
                                    key={epNum}
                                    type="button"
                                    className={`ep-chip ${!isPackMode && selectedEpisode === epNum ? 'active' : ''}`}
                                    onClick={() => handleSelectEpisode(epNum)}
                                >
                                    EP {epNum}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quality Filter Tabs (Segmented bar when releases are present) */}
                {hasDownloads && availableQualities.length > 2 && (
                    <div className="download-quality-filter-bar">
                        {availableQualities.map((q) => {
                            const count = q === 'ALL' 
                                ? downloads.length 
                                : downloads.filter((d) => (d.quality || '').toUpperCase().trim() === q).length;
                            return (
                                <button
                                    key={q}
                                    type="button"
                                    className={`quality-filter-tab ${activeQualityFilter === q ? 'active' : ''}`}
                                    onClick={() => setActiveQualityFilter(q)}
                                >
                                    <span>
                                        {q === 'ALL' ? (
                                            <>
                                                <span className="desktop-text">All Qualities</span>
                                                <span className="mobile-text">All</span>
                                            </>
                                        ) : q}
                                    </span>
                                    <span className="quality-tab-count">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Modal Content */}
                <div className="download-modal-body">
                    {isLoading ? (
                        <div className="download-loading-state">
                            <Loader2 size={38} className="animate-spin text-accent" />
                            <p>
                                {isPackMode 
                                    ? `Fetching Season ${selectedSeason} Pack...` 
                                    : 'Connecting to Cloud CDN...'}
                            </p>
                            <span>Fetching verified sources</span>
                        </div>
                    ) : error || !hasDownloads ? (
                        <div className="download-empty-state">
                            <AlertCircle size={38} className="text-muted" />
                            <h3>
                                {isPackMode 
                                    ? `No Season ${selectedSeason} Pack Archive` 
                                    : 'No Direct Downloads Available'}
                            </h3>
                            <p>
                                {downloadData?.message || 
                                 "We couldn't resolve direct fast download links for this selection."}
                            </p>
                            <div className="empty-state-actions">
                                {isPackMode && (
                                    <button
                                        type="button"
                                        className="btn-switch-episodes"
                                        onClick={() => handleSelectEpisode(1)}
                                    >
                                        Download Episodes (EP 1 - EP {episodeList.length})
                                    </button>
                                )}
                                <button 
                                    type="button" 
                                    className="download-retry-btn" 
                                    onClick={() => refetch()}
                                    disabled={isFetching}
                                >
                                    <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                                    {isFetching ? 'Retrying...' : 'Retry Server'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="download-releases-list">
                            {filteredDownloads.map((rel, idx) => {
                                const directOptions = (rel.options || []).filter(o => o.kind === 'direct');
                                const mirrorOptions = (rel.options || []).filter(o => o.kind !== 'direct');
                                const primaryDirect = directOptions[0];
                                const secondaryDirect = directOptions.slice(1);

                                // Parse title, audio, and technical tags
                                const parsed = parseReleaseInfo(rel.head || rel.file, title);
                                const isHighQuality = (rel.quality || '').includes('1080') || (rel.quality || '').includes('2160') || (rel.quality || '').includes('4K');
                                const isPackItem = rel.is_pack || isPackMode || (rel.head && /complete|pack|zip/i.test(rel.head));

                                return (
                                    <div key={idx} className={`download-release-card ${isHighQuality ? 'high-def' : ''}`}>
                                        {/* Card Header: Badges & Info */}
                                        <div className="release-card-header">
                                            <div className="release-badges-group">
                                                {/* Quality Badge */}
                                                <div className={`release-quality-pill quality-${(rel.quality || 'hd').toLowerCase()}`}>
                                                    {rel.quality || 'HD'}
                                                </div>

                                                {/* Full Season Pack Badge */}
                                                {isPackItem && (
                                                    <div className="release-pack-badge">
                                                        <Package size={12} />
                                                        <span className="desktop-text">FULL SEASON PACK</span>
                                                        <span className="mobile-text">SEASON PACK</span>
                                                    </div>
                                                )}

                                                {/* Size Badge */}
                                                {rel.size && (
                                                    <div className="release-size-badge">
                                                        <HardDrive size={12} /> {rel.size}
                                                    </div>
                                                )}

                                                {/* Audio Pill */}
                                                {parsed.audio && (
                                                    <div className="release-audio-pill" title={parsed.audio}>
                                                        <Volume2 size={12} />
                                                        <span>{parsed.audio}</span>
                                                    </div>
                                                )}

                                                {/* Format / Codec / Spec Badges */}
                                                {parsed.tags.map((tag, tIdx) => (
                                                    <span key={tIdx} className="release-spec-tag">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Clean Title / Edition string (only shown if not empty) */}
                                            {parsed.cleanTitle ? (
                                                <div className="release-clean-title" title={rel.head || rel.file}>
                                                    {parsed.cleanTitle}
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Primary Action Buttons (side-by-side on mobile) */}
                                        <div className="release-actions-row">
                                            {/* Primary Direct Download CTA */}
                                            {primaryDirect && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDirectDownload(primaryDirect.url)}
                                                    className="btn-direct-download"
                                                    title="Starts instant direct download in browser"
                                                >
                                                    <Zap size={15} />
                                                    <span className="desktop-text">
                                                        {isPackItem 
                                                            ? `Direct Download Pack (${primaryDirect.name.replace(/ Server$/i, '')})`
                                                            : `Direct Download (${primaryDirect.name.replace(/ Server$/i, '')})`}
                                                    </span>
                                                    <span className="mobile-text">
                                                        {isPackItem ? 'Download Pack' : 'Download'}
                                                    </span>
                                                </button>
                                            )}

                                            {/* Copy Link Button */}
                                            {primaryDirect && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(primaryDirect.url, `copy_${idx}`)}
                                                    className="btn-copy-link"
                                                    title="Copy direct URL to clipboard for IDM / 1DM / ADM"
                                                >
                                                    {copiedKey === `copy_${idx}` ? (
                                                        <>
                                                            <Check size={14} className="text-green" />
                                                            <span className="text-green">Copied!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy size={14} />
                                                            <span className="desktop-text">Copy Link</span>
                                                            <span className="mobile-text">Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* Secondary Mirrors & Alternate Servers Row */}
                                        {(secondaryDirect.length > 0 || mirrorOptions.length > 0) && (
                                            <div className="release-mirrors-row">
                                                <span className="mirrors-label">
                                                    <Server size={11} />
                                                    <span className="desktop-text">Alternate Mirrors:</span>
                                                    <span className="mobile-text">Mirrors:</span>
                                                </span>
                                                <div className="mirrors-buttons-wrap">
                                                    {secondaryDirect.map((opt, optIdx) => (
                                                        <button
                                                            key={optIdx}
                                                            type="button"
                                                            onClick={() => handleDirectDownload(opt.url)}
                                                            className="btn-mirror-pill"
                                                            title={`Direct mirror from ${opt.name}`}
                                                        >
                                                            <Zap size={11} />
                                                            <span>{opt.name.replace(/ Server$/i, '')}</span>
                                                        </button>
                                                    ))}

                                                    {mirrorOptions.map((opt, optIdx) => (
                                                        <a
                                                            key={optIdx}
                                                            href={opt.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn-mirror-pill external"
                                                            title={`Open ${opt.name} mirror in a new tab`}
                                                        >
                                                            <ExternalLink size={11} />
                                                            <span>{opt.name.replace(/ Server$/i, '')}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="download-modal-footer">
                    <span className="download-footer-note desktop-text">
                        ⚡ High-Speed Direct CDN & Cloud Mirrors &bull; Resumable Downloads &bull; No Ads
                    </span>
                    <span className="download-footer-note mobile-text">
                        ⚡ Direct Cloud CDN &bull; Resumable &bull; No Ads
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DownloadModal;
