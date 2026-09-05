import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Tv, Radio, Sparkles, Filter, ChevronRight, Globe, AlertCircle, Star } from 'lucide-react';
import { fetchLiveChannels, COUNTRIES, CATEGORIES } from '../api/liveTvApi';
import { movieApi, DEFAULT_CONFIG } from '../api';
import LivePlayer, { isRemoteConfirmKey } from '../components/LivePlayer';
import Navbar from '../components/Navbar';
import '../styles/liveTv.css';

export default function LiveTVPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCountry = searchParams.get('country') || 'in';
  const selectedCategory = searchParams.get('genre') || 'All';

  const { data: serverConfig } = useQuery({
    queryKey: ['server-config'],
    queryFn: movieApi.getServerConfig,
    staleTime: 1000 * 60 * 60, // 1 hour (shared across WatchPage, Navbar, LiveTVPage)
  });
  const isLiveTvEnabled = serverConfig?.Enable_livetv ?? serverConfig?.enable_livetv ?? DEFAULT_CONFIG.Enable_livetv ?? true;

  useEffect(() => {
    if (isLiveTvEnabled === false) {
      navigate('/', { replace: true });
    }
  }, [isLiveTvEnabled, navigate]);

  const [channels, setChannels] = useState([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentChannelId, setCurrentChannelId] = useState(null);

  // TV / keyboard navigation focused index
  const [focusedChannelIdx, setFocusedChannelIdx] = useState(0);

  const channelItemRefs = useRef([]);
  const channelListContainerRef = useRef(null);
  const playerRef = useRef(null);

  const handleSelectAndPlayChannel = useCallback((channelId, openFullscreen = true) => {
    setCurrentChannelId(channelId);
    if (openFullscreen) {
      // Direct call within user-gesture callstack ensures browser grants fullscreen permission
      playerRef.current?.enterFullscreen();
    }
  }, []);

  // ── 1. Fetch channels on country change ───────────────────
  useEffect(() => {
    let isMounted = true;
    setIsLoadingChannels(true);
    setFetchError(null);

    fetchLiveChannels(selectedCountry)
      .then((data) => {
        if (!isMounted) return;
        setChannels(data);
        if (data.length > 0) {
          const savedChanId = localStorage.getItem('livetv_last_channel_id');
          const matched = savedChanId ? data.find((c) => c.id === savedChanId) : null;
          const initialChan = matched || data[0];
          setCurrentChannelId(initialChan.id);
          const initialIdx = data.findIndex((c) => c.id === initialChan.id);
          setFocusedChannelIdx(initialIdx >= 0 ? initialIdx : 0);
        } else {
          setCurrentChannelId(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setFetchError(`Failed to load ${selectedCountry.toUpperCase()} channels. Please try again.`);
      })
      .finally(() => {
        if (isMounted) setIsLoadingChannels(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCountry]);

  // ── 2. Filter channels by category and search query ──────
  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      // Category match
      const matchesCategory =
        selectedCategory === 'All' ||
        channel.categories.some((cat) => cat.toLowerCase() === selectedCategory.toLowerCase()) ||
        channel.category.toLowerCase() === selectedCategory.toLowerCase();

      // Search match
      const matchesSearch =
        !searchQuery.trim() ||
        channel.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        channel.category.toLowerCase().includes(searchQuery.toLowerCase().trim());

      return matchesCategory && matchesSearch;
    });
  }, [channels, selectedCategory, searchQuery]);

  // Active playing channel: always derived from full channels list
  // so searching/filtering NEVER changes the currently playing stream automatically!
  const activeChannel = useMemo(() => {
    if (!currentChannelId && channels.length > 0) {
      return channels[0];
    }
    return channels.find((c) => c.id === currentChannelId) || channels[0] || null;
  }, [channels, currentChannelId]);

  // Persist selected channel to localStorage
  useEffect(() => {
    if (currentChannelId) {
      try {
        localStorage.setItem('livetv_last_channel_id', currentChannelId);
      } catch {
        // Ignore localStorage error in private mode
      }
    }
  }, [currentChannelId]);

  // Handle active channel index for Previous / Next channel actions
  const activeChannelIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return filteredChannels.findIndex((c) => c.id === activeChannel.id);
  }, [filteredChannels, activeChannel]);

  const handlePreviousChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const prevIdx = (activeChannelIndex - 1 + filteredChannels.length) % filteredChannels.length;
    const nextChan = filteredChannels[prevIdx];
    if (nextChan) {
      setCurrentChannelId(nextChan.id);
      setFocusedChannelIdx(prevIdx);
      channelItemRefs.current[prevIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeChannelIndex, filteredChannels]);

  const handleNextChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;
    const nextIdx = (activeChannelIndex + 1) % filteredChannels.length;
    const nextChan = filteredChannels[nextIdx];
    if (nextChan) {
      setCurrentChannelId(nextChan.id);
      setFocusedChannelIdx(nextIdx);
      channelItemRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeChannelIndex, filteredChannels]);

  // ── 3. TV Remote & Keyboard D-Pad Navigation ──────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // In fullscreen mode or typing in input, let player/input handle keys
      if (document.fullscreenElement || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }

      // Handle 'F' key to toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        playerRef.current?.toggleFullscreen();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedChannelIdx((prev) => {
          const next = Math.min(filteredChannels.length - 1, prev + 1);
          channelItemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedChannelIdx((prev) => {
          const next = Math.max(0, prev - 1);
          channelItemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
      } else if (isRemoteConfirmKey(e)) {
        e.preventDefault();
        const target = filteredChannels[focusedChannelIdx] || activeChannel;
        if (target) {
          handleSelectAndPlayChannel(target.id, true);
        }
      } else if (e.key === 'ChannelUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePreviousChannel();
      } else if (e.key === 'ChannelDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextChannel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredChannels, focusedChannelIdx, handlePreviousChannel, handleNextChannel, activeChannel, handleSelectAndPlayChannel]);

  return (
    <div className="livetv-page">
      <Navbar />

      {/* ── Main Option C Split Layout ─────────────────────── */}
      <div className="livetv-main-container">
        {/* Left Side: Cinema Player Section */}
        <div className="livetv-player-section">
          {activeChannel ? (
            <LivePlayer
              ref={playerRef}
              channel={activeChannel}
              onPreviousChannel={handlePreviousChannel}
              onNextChannel={handleNextChannel}
            />
          ) : (
            <div className="livetv-player-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#888' }}>
                <Tv size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p>No channel selected.</p>
              </div>
            </div>
          )}

          {/* Active Channel Details Banner */}
          {activeChannel && (
            <div className="livetv-channel-banner">
              <div className="livetv-banner-left">
                {activeChannel.logo ? (
                  <img
                    src={activeChannel.logo}
                    alt={activeChannel.name}
                    className="livetv-banner-logo"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="livetv-banner-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Tv size={24} color="#fdd835" />
                  </div>
                )}
                <div className="livetv-banner-text">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2>{activeChannel.name}</h2>
                    {activeChannel.isFavorite && (
                      <Star
                        size={18}
                        fill="#fdd835"
                        color="#fdd835"
                        className="livetv-maker-star"
                        title="Favorite by Maker"
                      />
                    )}
                  </div>
                  <div className="livetv-banner-tags">
                    <span className="livetv-tag-badge">{activeChannel.category}</span>
                    {activeChannel.quality && (
                      <span className="livetv-tag-quality">{activeChannel.quality}</span>
                    )}
                    {activeChannel.isNot247 && (
                      <span className="livetv-tag-badge" style={{ color: '#fbbf24' }}>Part-Time Feed</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="livetv-control-btn"
                  onClick={handlePreviousChannel}
                  title="Previous Channel (PageUp)"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="livetv-control-btn"
                  onClick={handleNextChannel}
                  title="Next Channel (PageDown)"
                >
                  ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Channel Guide / Switcher Panel */}
        <div className="livetv-channels-panel">
          <div className="livetv-panel-header">
            <div className="livetv-panel-title-group">
              <Tv size={16} color="var(--accent-yellow, #fdd835)" />
              <span className="livetv-panel-title">Channel Guide</span>
              <span className="livetv-channel-badge-count">({filteredChannels.length})</span>
            </div>

            <div className="livetv-guide-search">
              <Search size={14} className="livetv-guide-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedChannelIdx(0);
                }}
                onKeyDown={(e) => {
                  if (isRemoteConfirmKey(e)) {
                    e.preventDefault();
                    const target = filteredChannels[focusedChannelIdx] || filteredChannels[0];
                    if (target) {
                      handleSelectAndPlayChannel(target.id, true);
                    }
                    e.target.blur();
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.target.blur();
                    channelItemRefs.current[0]?.focus();
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="livetv-guide-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="livetv-channels-list" ref={channelListContainerRef}>
            {isLoadingChannels && (
              <div className="livetv-empty-state">
                <div className="livetv-spinner" />
                <span>Loading channel directory...</span>
              </div>
            )}

            {fetchError && !isLoadingChannels && (
              <div className="livetv-empty-state" style={{ color: '#ff5555' }}>
                <AlertCircle size={28} />
                <span>{fetchError}</span>
              </div>
            )}

            {!isLoadingChannels && filteredChannels.length === 0 && !fetchError && (
              <div className="livetv-empty-state">
                <Tv size={32} style={{ opacity: 0.4 }} />
                <span>No channels match your filter.</span>
              </div>
            )}

            {!isLoadingChannels &&
              filteredChannels.map((channel, idx) => {
                const isActive = activeChannel?.id === channel.id;
                const isFocused = focusedChannelIdx === idx;

                return (
                  <button
                    key={channel.id}
                    ref={(el) => { channelItemRefs.current[idx] = el; }}
                    type="button"
                    className={`livetv-channel-item ${isActive ? 'active' : ''} ${isFocused ? 'livetv-channel-item--tv-focused' : ''}`}
                    onClick={() => {
                      handleSelectAndPlayChannel(channel.id, false);
                      setFocusedChannelIdx(idx);
                    }}
                    onDoubleClick={() => {
                      handleSelectAndPlayChannel(channel.id, true);
                    }}
                    onKeyDown={(e) => {
                      if (isRemoteConfirmKey(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectAndPlayChannel(channel.id, true);
                        setFocusedChannelIdx(idx);
                      }
                    }}
                  >
                    <div className="livetv-item-logo-box">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt=""
                          className="livetv-item-logo"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <Tv
                        size={18}
                        className="livetv-item-fallback-icon"
                        style={{ display: channel.logo ? 'none' : 'block' }}
                      />
                    </div>

                    <div className="livetv-item-info">
                      <div className="livetv-item-title-row">
                        <span className="livetv-item-name">{channel.name}</span>
                        {channel.isFavorite && (
                          <Star
                            size={13}
                            fill="#fdd835"
                            color="#fdd835"
                            className="livetv-maker-star"
                            title="Maker Favorite Channel"
                          />
                        )}
                      </div>
                      <div className="livetv-item-meta">
                        <span>{channel.category}</span>
                        {channel.quality && <span>• {channel.quality}</span>}
                      </div>
                    </div>

                    {isActive && (
                      <div className="livetv-item-playing-indicator" title="Currently Playing">
                        <span className="livetv-item-playing-bar" />
                        <span className="livetv-item-playing-bar" />
                        <span className="livetv-item-playing-bar" />
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
