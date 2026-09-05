import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, X, Send, Trash2, Sparkles, RefreshCw, Film, ExternalLink, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { askMovieBotStream, clearChatSession, getChatbotBaseUrl } from '../api/chatbotApi';
import { movieApi, DEFAULT_CONFIG } from '../api';

const QUICK_SUGGESTIONS = [
  'Which movies are released today in India?',
  'What are the most anticipated sci-fi movies in 2026?',
  'Suggest 3 top rated psychological thrillers',
  'Where can I stream Dune: Part Two right now?'
];

// Regex components for movie and series title detection:
// 1. ** Title (Details) ** or ** Title () ** (e.g. ** Baalveer (TV Series, 2018–2020) **, ** Inception (2010) **, ** Leo () **)
// 2. **Title** (Details) (e.g. **Baalveer** (TV Series, 2018–2020))
// 3. Line-start or list item: 1. Baalveer (TV Series, 2018–2020) or - Baalveer (TV Series, 2018–2020)
// 4. Line-start or list item with 4-digit year: 1. Inception (2010)
const P_BOLD_WITH_PARENS = '\\*\\*\\s*([^*()]+?)\\s*\\(([^)]*)\\)\\s*\\*\\*(?!:)';
const P_BOLD_THEN_PARENS = '\\*\\*\\s*([^*()]+?)\\s*\\*\\*\\s*\\(([^)]*)\\)';
const P_LIST_SERIES = '(?:^|\\n|[•*]|\\d+\\.|-)\\s*([A-Za-z0-9:,\'’–—!&.\\s]+?)\\s*\\(([^)\\n]*(?:(?:19|20)\\d{2}|TV Series|Series|Mini-Series|Anime)[^)\\n]*)\\)';
const P_LIST_YEAR = '(?:^|\\n|[•*]|\\d+\\.|-)\\s*([A-Za-z0-9:,\'’–—!&.\\s]+?)\\s*\\((\\d{4})\\)';

const MOVIE_NAME_REGEX = new RegExp(
  `${P_BOLD_WITH_PARENS}|${P_BOLD_THEN_PARENS}|${P_LIST_SERIES}|${P_LIST_YEAR}`,
  'g'
);

const IGNORED_TITLES = new Set([
  'note', 'plot', 'summary', 'synopsis', 'overview', 'genre', 'genres',
  'release date', 'runtime', 'cast', 'director', 'rating', 'ratings',
  'budget', 'box office', 'streaming', 'platform', 'where to watch',
  'disclaimer', 'source', 'sources'
]);

// Inline token renderer for bold, markdown links, and URLs
const renderStandardTokens = (text) => {
  if (!text) return '';

  const tokenRegex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a key={idx} href={part} target="_blank" rel="noopener noreferrer">
          {part.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28)}...
        </a>
      );
    }

    return part;
  });
};

// Parser that turns movie/series titles into clickable buttons
const renderInlineStyles = (text, onMovieTagClick) => {
  if (!text) return '';

  if (!onMovieTagClick) {
    return renderStandardTokens(text);
  }

  const parts = [];
  let lastIndex = 0;
  let match;
  MOVIE_NAME_REGEX.lastIndex = 0;

  while ((match = MOVIE_NAME_REGEX.exec(text)) !== null) {
    const rawTitle = match[1] || match[3] || match[5] || match[7];
    const details = match[2] !== undefined ? match[2] : (match[4] !== undefined ? match[4] : (match[6] !== undefined ? match[6] : match[8]));
    const startIndex = match.index;

    // Text before the movie match
    if (startIndex > lastIndex) {
      parts.push(renderStandardTokens(text.slice(lastIndex, startIndex)));
    }

    // Clean title from numbering (e.g. "1. Inception" -> "Inception") and leading emojis/markdown
    const cleanTitle = (rawTitle || '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^[🎬🍿⭐🎭📺•\s*]+/, '')
      .replace(/[*_#]/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();

    // Guard against non-movie markdown labels (e.g. **Note (Important):**)
    if (!cleanTitle || IGNORED_TITLES.has(cleanTitle.toLowerCase())) {
      parts.push(renderStandardTokens(match[0]));
      lastIndex = startIndex + match[0].length;
      continue;
    }

    // Check if there was leading numbering like "1. "
    const leadingNumberMatch = (rawTitle || '').match(/^(\d+\.\s*)/) || match[0].match(/^(\d+\.\s*)/);
    const leadingNumber = leadingNumberMatch ? leadingNumberMatch[1] : '';

    if (leadingNumber) {
      parts.push(
        <span
          key={`num-${startIndex}`}
          style={{ fontWeight: 700, color: 'var(--accent-yellow, #fdd835)', marginRight: '4px' }}
        >
          {leadingNumber}
        </span>
      );
    }

    const trimmedDetails = (details || '').trim();
    const yearMatch = trimmedDetails.match(/\b((?:19|20)\d{2})\b/);
    const targetYear = yearMatch ? yearMatch[1] : '';

    parts.push(
      <button
        key={`movie-${cleanTitle}-${targetYear}-${startIndex}`}
        type="button"
        className="movie-clickable-badge"
        title={`Click to view ${cleanTitle} details`}
        onClick={() => onMovieTagClick(cleanTitle, targetYear)}
      >
        <span>🎬</span>
        <span className="movie-title">{cleanTitle}</span>
        {trimmedDetails ? <span className="movie-year">({trimmedDetails})</span> : null}
      </button>
    );

    lastIndex = startIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderStandardTokens(text.slice(lastIndex)));
  }

  return parts;
};

// Helper to format bot markdown text cleanly
const renderFormattedContent = (content, onMovieTagClick) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="chatbot-markdown">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} style={{ height: '6px' }} />;
        }

        // Heading lines (e.g. ### Title or ## Title)
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const headingText = trimmed.replace(/^#+\s*/, '');
          return (
            <p key={lineIdx} style={{ fontWeight: 700, color: 'var(--accent-yellow, #fdd835)', margin: '6px 0 2px' }}>
              {renderInlineStyles(headingText, onMovieTagClick)}
            </p>
          );
        }

        // Bullet point lines (- item or * item)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.substring(2);
          return (
            <div key={lineIdx} style={{ display: 'flex', gap: '6px', margin: '2px 0' }}>
              <span style={{ color: 'var(--accent-yellow, #fdd835)', flexShrink: 0 }}>•</span>
              <div>{renderInlineStyles(itemText, onMovieTagClick)}</div>
            </div>
          );
        }

        return (
          <p key={lineIdx} style={{ margin: '3px 0' }}>
            {renderInlineStyles(line, onMovieTagClick)}
          </p>
        );
      })}
    </div>
  );
};

const getOrInitSessionId = () => {
  try {
    let sid = sessionStorage.getItem('moviebot_session_id');
    if (!sid) {
      sid = `cinephile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('moviebot_session_id', sid);
    }
    return sid;
  } catch {
    return `cinephile_${Date.now()}`;
  }
};

export default function MovieChatbot() {
  const { data: serverConfig } = useQuery({
    queryKey: ['server-config'],
    queryFn: movieApi.getServerConfig,
    staleTime: 1000 * 60 * 60, // 1 hour (same as WatchPage and Navbar)
  });

  const isChatbotEnabled = serverConfig?.Enable_chatbot ?? serverConfig?.enable_chatbot ?? serverConfig?.unable_chatbot ?? DEFAULT_CONFIG.Enable_chatbot ?? false;

  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const [sessionId, setSessionId] = useState(getOrInitSessionId);

  // Inline Movie Preview State
  const [activeMovieGrid, setActiveMovieGrid] = useState(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);

  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, isFullScreen, agentStatus, activeMovieGrid]);

  // Focus input when opened (desktop only; prevents jarring keyboard popup on mobile)
  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
      const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 640 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
      if (!isMobile) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [isOpen]);

  // Allow Escape key to exit fullscreen mode
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullScreen]);

  // 1. Fetch movie details: Clean title strictly WITHOUT YYYY or parenthetical details
  const handleMovieTagClick = async (title, year) => {
    // ⚠️ Strip any parenthetical text (e.g. "(TV Series, 2018–2020)"), numbering, and leading emojis - search using strictly clean title
    const cleanQuery = title
      .replace(/\([^)]*\)/g, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^[🎬🍿⭐🎭📺•\s*]+/, '')
      .replace(/[*_#]/g, '')
      .trim();

    if (!cleanQuery) return;

    setIsLoadingMovie(true);
    try {
      // Use existing website movieApi searchMulti
      const res = await movieApi.searchMulti(cleanQuery, 1);
      const allResults = res.data?.results || [];

      // Filter out people (cast/crew)
      let movies = allResults.filter(
        (m) => m.media_type === 'movie' || m.media_type === 'tv' || (!m.media_type && (m.title || m.name))
      );

      // If target year is provided and we have multiple matches, prioritize matching year
      if (year && movies.length > 1) {
        movies.sort((a, b) => {
          const yearA = (a.release_date || a.first_air_date || '').slice(0, 4);
          const yearB = (b.release_date || b.first_air_date || '').slice(0, 4);
          if (yearA === year && yearB !== year) return -1;
          if (yearB === year && yearA !== year) return 1;
          return 0;
        });
      }

      setActiveMovieGrid({
        query: cleanQuery,
        targetYear: year,
        movies: movies.slice(0, 4), // Top 4 matches
      });
    } catch (err) {
      console.error('Failed to search movie for chatbot preview:', err);
    } finally {
      setIsLoadingMovie(false);
    }
  };

  // 2. Click on grid item -> Navigate to Movie Detail & Minimize Bot
  const handleMovieCardSelect = (movie) => {
    // 1. Minimize or close the chatbot
    setIsOpen(false);
    setIsFullScreen(false);

    // 2. Open the movie details page
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    navigate(`/${mediaType}/${movie.id}`, { state: { movie } });
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsgId = `usr_${Date.now()}`;
    const botMsgId = `bot_${Date.now()}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: query,
      timestamp: timeNow,
    };

    const emptyBotMsg = {
      id: botMsgId,
      sender: 'bot',
      text: '',
      sources: [],
      timestamp: timeNow,
    };

    setMessages((prev) => [...prev, userMsg, emptyBotMsg]);
    setInputMessage('');
    setIsLoading(true);
    setAgentStatus('Connecting to MovieBot...');

    try {
      await askMovieBotStream(
        {
          message: query,
          sessionId: sessionId,
        },
        {
          onStatus: (statusText) => {
            setAgentStatus(statusText);
          },
          onToken: (token) => {
            setAgentStatus(null);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId ? { ...msg, text: msg.text + token } : msg
              )
            );
          },
          onDone: ({ answer, sources }) => {
            setAgentStatus(null);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId
                  ? {
                      ...msg,
                      text: answer || msg.text,
                      sources: Array.isArray(sources) ? sources : msg.sources,
                    }
                  : msg
              )
            );
          },
          onError: (errMsg) => {
            setAgentStatus(null);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId
                  ? {
                      ...msg,
                      isError: true,
                      text: msg.text ? `${msg.text}\n\n⚠️ ${errMsg}` : (typeof errMsg === 'string' ? errMsg : 'An error occurred during streaming.'),
                    }
                  : msg
              )
            );
          },
        }
      );
    } catch (err) {
      console.error('MovieBot stream failed:', err);
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout');
      const isNetworkError = err.code === 'ERR_NETWORK' || !err.response;
      const baseUrl = getChatbotBaseUrl() || 'http://localhost:8000';

      let errorText = '';
      if (isTimeout) {
        errorText = 'The request timed out. The AI agent web search took longer than 120 seconds. Please try again or ask a more specific query.';
      } else if (isNetworkError) {
        errorText = `Could not reach the MovieBot server at ${baseUrl}. If your backend already generated output, the browser blocked it due to missing CORS headers in FastAPI.`;
      } else {
        errorText = `Error: ${err.message || 'Something went wrong.'}`;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMsgId
            ? { ...msg, isError: true, text: msg.text ? `${msg.text}\n\n⚠️ ${errorText}` : errorText }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setAgentStatus(null);
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSendMessage();
    }
  };

  const handleClearChat = async () => {
    if (sessionId) {
      clearChatSession(sessionId).catch(() => {});
    }
    const newSid = `cinephile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sessionStorage.setItem('moviebot_session_id', newSid);
    setSessionId(newSid);
    setMessages([]);
    setActiveMovieGrid(null);
  };

  if (!isChatbotEnabled) {
    return null;
  }

  return (
    <div className={`chatbot-root ${isFullScreen ? 'chatbot-root-fullscreen' : ''}`} aria-label="AI Movie Chatbot">
      {/* ── Chat Window ── */}
      {isOpen && (
        <div className={`chatbot-window ${isFullScreen ? 'chatbot-window-fullscreen' : ''}`} role="dialog" aria-modal="true">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <Bot size={18} />
              </div>
              <div className="chatbot-title-container">
                <h3 className="chatbot-title">
                  <span>Movie</span><span className="brand-yellow">Bot</span> <Sparkles size={14} className="brand-yellow" />
                </h3>
                <span className="chatbot-status">
                  <span className="chatbot-status-dot" /> AI Cinephile Concierge
                </span>
              </div>
            </div>

            <div className="chatbot-header-actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="chatbot-header-btn"
                  title="Clear conversation"
                  onClick={handleClearChat}
                  aria-label="Clear conversation"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                type="button"
                className="chatbot-header-btn"
                title={isFullScreen ? 'Exit full screen' : 'Full screen mode'}
                onClick={() => setIsFullScreen((prev) => !prev)}
                aria-label={isFullScreen ? 'Exit full screen' : 'Full screen mode'}
              >
                {isFullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              <button
                type="button"
                className="chatbot-header-btn"
                title="Close chat"
                onClick={() => {
                  setIsOpen(false);
                  setIsFullScreen(false);
                }}
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="chatbot-welcome">
                <div className="chatbot-welcome-icon">🎬</div>
                <div className="chatbot-welcome-title">
                  <span>Welcome to Movie</span><span className="brand-yellow">Bot</span>
                </div>
                <div className="chatbot-welcome-desc">
                  Your AI cinema concierge. Ask for 2026 releases, tailored recommendations, streaming platforms, or review consensus.
                </div>

                <div className="chatbot-suggestions">
                  {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chatbot-suggestion-chip"
                      onClick={() => handleSendMessage(suggestion)}
                    >
                      <Film size={13} className="brand-yellow" style={{ flexShrink: 0 }} />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chatbot-msg-row ${msg.sender}`}>
                {msg.sender === 'bot' && (
                  <div className="chatbot-msg-avatar">
                    <Bot size={15} />
                  </div>
                )}
                <div className="chatbot-bubble">
                  {msg.isError ? (
                    <div className="chatbot-error-box">
                      {msg.text}
                      <br />
                      <button
                        type="button"
                        className="chatbot-retry-btn"
                        onClick={() => {
                          const lastUser = [...messages].reverse().find((m) => m.sender === 'user');
                          if (lastUser) handleSendMessage(lastUser.text);
                        }}
                      >
                        <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Retry
                      </button>
                    </div>
                  ) : msg.sender === 'bot' ? (
                    msg.text ? (
                      renderFormattedContent(msg.text, handleMovieTagClick)
                    ) : (
                      <div className="chatbot-typing" style={{ padding: '4px 0' }}>
                        <div className="chatbot-dot" />
                        <div className="chatbot-dot" />
                        <div className="chatbot-dot" />
                      </div>
                    )
                  ) : (
                    msg.text
                  )}

                  {/* Sources tag list */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="chatbot-sources">
                      <span style={{ fontSize: '0.66rem', color: '#9e9e9e', marginRight: '4px' }}>Sources:</span>
                      {msg.sources.map((src, sIdx) => {
                        const url = typeof src === 'string' ? src : src.url || '';
                        let domain = 'Source';
                        try {
                          domain = new URL(url).hostname.replace('www.', '');
                        } catch {
                          domain = typeof src === 'string' ? src.slice(0, 20) : 'Link';
                        }
                        return (
                          <a
                            key={sIdx}
                            href={url.startsWith('http') ? url : `https://${url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chatbot-source-tag"
                            title={url}
                          >
                            {domain} <ExternalLink size={10} style={{ display: 'inline' }} />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  <div className="chatbot-msg-time">{msg.timestamp}</div>
                </div>
              </div>
            ))}

            {agentStatus && (
              <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0 6px 34px' }}>
                <div className="chatbot-status-banner">
                  <span className="chatbot-status-pulse-dot" />
                  <span>{agentStatus}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 4. Inline Movie Preview Grid */}
          {isLoadingMovie && (
            <div className="movie-loading-banner">
              <Loader2 size={15} className="animate-spin brand-yellow" />
              <span>Searching movie preview for you...</span>
            </div>
          )}

          {activeMovieGrid && activeMovieGrid.movies.length > 0 && (
            <div className="inline-movie-grid-container">
              <div className="grid-header">
                <span>
                  🎬 Results for "<span className="brand-yellow">{activeMovieGrid.query}</span>"
                  {activeMovieGrid.targetYear && ` (${activeMovieGrid.targetYear})`}
                </span>
                <button
                  type="button"
                  className="grid-header-close"
                  onClick={() => setActiveMovieGrid(null)}
                  title="Close preview"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>

              <div className="inline-movie-grid">
                {activeMovieGrid.movies.map((movie) => {
                  const title = movie.title || movie.name || 'Untitled';
                  const releaseDate = movie.release_date || movie.first_air_date || '';
                  const releaseYear = releaseDate ? releaseDate.slice(0, 4) : '';
                  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
                  const posterUrl = movie.poster_path
                    ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
                    : movieApi.getImageUrl(null, 'w200');

                  return (
                    <div
                      key={movie.id}
                      className="movie-mini-card"
                      onClick={() => handleMovieCardSelect(movie)}
                      title={`Open ${title}`}
                    >
                      <img
                        src={posterUrl}
                        alt={title}
                        className="mini-card-poster"
                        loading="lazy"
                      />
                      <div className="mini-card-info">
                        <h4 className="mini-card-title">{title}</h4>
                        <div className="mini-card-meta">
                          {rating && <span>⭐ {rating}</span>}
                          {releaseYear && <span> • {releaseYear}</span>}
                        </div>
                        <span className="view-details-prompt">Click to view page →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Input */}
          <div className="chatbot-footer">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="chatbot-input-wrapper"
            >
              <input
                ref={inputRef}
                type="text"
                className="chatbot-input"
                placeholder="Ask MovieBot about movies..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 280);
                }}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="chatbot-send-btn"
                disabled={!inputMessage.trim() || isLoading}
                title="Send message"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Floating Launcher Button ── */}
      {!isFullScreen && (
        <div className="chatbot-launcher-container">
          {showTooltip && !isOpen && (
            <div className="chatbot-tooltip">
              <Sparkles size={13} className="brand-yellow" /> Ask Movie<span className="brand-yellow">Bot</span>
            </div>
          )}
          <button
            type="button"
            className="chatbot-launcher-btn"
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? 'Close MovieBot' : 'Open AI Movie Chatbot'}
            aria-label={isOpen ? 'Close MovieBot' : 'Open AI Movie Chatbot'}
          >
            {isOpen ? (
              <X size={24} className="chatbot-launcher-icon" />
            ) : (
              <>
                <Bot size={28} className="chatbot-launcher-icon" />
                <span className="chatbot-badge-pulse" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
