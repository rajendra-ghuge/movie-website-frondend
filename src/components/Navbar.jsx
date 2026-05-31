import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown, Menu } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────
   TV keyboard nav is ONLY active on laptop / TV viewports.
   Mobile (< 1024px) is completely unchanged — no impact.
───────────────────────────────────────────────────────── */
const isTV = () => {
    if (typeof window === 'undefined') return false;
    const isTVUA = /TV|LargeScreen|AndroidTV|SmartTV/i.test(navigator.userAgent);
    return window.innerWidth >= 1024 || isTVUA;
};

// ── DropdownMenu ───────────────────────────────────────────
// Handles Up/Down between items, Enter to select, Escape/Left to close
const DropdownMenu = ({ items, onSelect, onClose }) => {
    const [focusedIdx, setFocusedIdx] = useState(0);
    const itemRefs = useRef([]);

    // Focus first selectable item on mount
    useEffect(() => {
        const firstEl = itemRefs.current[0];
        if (firstEl) firstEl.focus();
    }, []);

    // Sync DOM focus when focused index changes
    useEffect(() => {
        const el = itemRefs.current[focusedIdx];
        if (el) el.focus();
    }, [focusedIdx]);

    const selectableItems = items.filter(it => !it.isHeader);

    const handleKeyDown = (e) => {
        const key = e.key;
        if (key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setFocusedIdx(i => Math.max(0, i - 1));
        } else if (key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setFocusedIdx(i => Math.min(selectableItems.length - 1, i + 1));
        } else if (key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onSelect(selectableItems[focusedIdx]);
        } else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Escape' || key === 'Backspace') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    };

    let sIdx = -1;

    return (
        <div className="nav-dropdown" onKeyDown={handleKeyDown}>
            {items.map((item) => {
                if (item.isHeader) {
                    return <div key={item.name} className="dropdown-header">{item.name}</div>;
                }
                sIdx++;
                const idx = sIdx;
                return (
                    <div
                        key={item.name}
                        ref={el => { itemRefs.current[idx] = el; }}
                        tabIndex={-1}
                        className={`dropdown-item ${focusedIdx === idx && isTV() ? 'dropdown-item--tv-focused' : ''}`}
                        onClick={() => onSelect(item)}
                        onFocus={() => setFocusedIdx(idx)}
                    >
                        {item.name}
                    </div>
                );
            })}
        </div>
    );
};

// ── Navbar ─────────────────────────────────────────────────
const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [focusedNavIdx, setFocusedNavIdx] = useState(0);

    const navLinkRefs = useRef([]);
    const searchIconRef = useRef(null);

    const query = new URLSearchParams(location.search);
    const currentCat = query.get('cat') || 'home';

    const tvMode = isTV();

    const navLinks = [
        { name: 'Trending', path: '/?type=movie&cat=movie', cat: 'movie' },
        {
            name: 'Latest', cat: 'latest',
            dropdown: [
                { name: 'All Latest', path: '/?latest=all&cat=latest' },
                { name: 'OTT', path: '/?latest=ott&cat=latest' },
                { name: 'Theatrical', path: '/?latest=theatrical&cat=latest' }
            ]
        },
        {
            name: 'Top Rated', cat: 'top',
            dropdown: [
                { name: 'All Top Rated', path: '/?cat=top' },
                { name: 'Top Movies', path: '/?type=movie&cat=top' },
                { name: 'Top TV Shows', path: '/?type=tv&cat=top' },
                { name: 'Top Indian Movies', path: '/?type=movie&lang=hi&cat=top' },
                { name: 'Top Hollywood Movies', path: '/?type=movie&lang=en&cat=top' },
                { name: 'Top Hollywood Shows', path: '/?type=tv&lang=en&cat=top' },
                { name: 'Top Rated K-Dramas', path: '/?type=tv&lang=ko&cat=top' }
            ]
        },
        {
            name: 'Anime', cat: 'anime',
            dropdown: [
                { name: 'All Anime', path: '/?lang=ja&genre=16&cat=anime' },
                { name: 'Anime Movies', path: '/?type=movie&lang=ja&genre=16&cat=anime' },
                { name: 'Anime Series', path: '/?type=tv&lang=ja&genre=16&cat=anime' },
                { name: 'Top Rated Anime', path: '/?type=tv&lang=ja&genre=16&sort=vote_average.desc&cat=anime' }
            ]
        },
        {
            name: 'Web Series', path: '/?type=tv&cat=tv', cat: 'tv',
            dropdown: [
                { name: 'Latest Web Series', path: '/?type=tv&cat=tv' },
                { name: 'Indian', path: '/?type=tv&lang=hi&cat=tv_hi' },
                { name: 'Hollywood', path: '/?type=tv&lang=en&cat=tv_en' }
            ]
        },
        {
            name: 'Bollywood', cat: 'hi',
            dropdown: [
                { name: 'All Bollywood', path: '/?lang=hi&cat=hi' },
                { name: 'Action', path: '/?lang=hi&genre=28&cat=hi' },
                { name: 'Adventure', path: '/?lang=hi&genre=12&cat=hi' },
                { name: 'Animation', path: '/?lang=hi&genre=16&cat=hi' },
                { name: 'Comedy', path: '/?lang=hi&genre=35&cat=hi' },
                { name: 'Crime', path: '/?lang=hi&genre=80&cat=hi' },
                { name: 'Drama', path: '/?lang=hi&genre=18&cat=hi' },
                { name: 'Horror', path: '/?lang=hi&genre=27&cat=hi' },
                { name: 'Romance', path: '/?lang=hi&genre=10749&cat=hi' },
                { name: 'Sci-Fi', path: '/?lang=hi&genre=878&cat=hi' },
                { name: 'Thriller', path: '/?lang=hi&genre=53&cat=hi' }
            ]
        },
        {
            name: 'Hollywood', cat: 'en',
            dropdown: [
                { name: 'All Hollywood', path: '/?lang=en&cat=en' },
                { name: 'Action', path: '/?lang=en&genre=28&cat=en' },
                { name: 'Adventure', path: '/?lang=en&genre=12&cat=en' },
                { name: 'Animation', path: '/?lang=en&genre=16&cat=en' },
                { name: 'Comedy', path: '/?lang=en&genre=35&cat=en' },
                { name: 'Crime', path: '/?lang=en&genre=80&cat=en' },
                { name: 'Drama', path: '/?lang=en&genre=18&cat=en' },
                { name: 'Horror', path: '/?lang=en&genre=27&cat=en' },
                { name: 'Romance', path: '/?lang=en&genre=10749&cat=en' },
                { name: 'Sci-Fi', path: '/?lang=en&genre=878&cat=en' },
                { name: 'Thriller', path: '/?lang=en&genre=53&cat=en' }
            ]
        },
        {
            name: 'OTT', cat: 'ott',
            dropdown: [
                { name: 'Netflix', path: '/?provider=8&cat=ott' },
                { name: 'Prime Video', path: '/?provider=119&cat=ott' },
                { name: 'JioHotstar', path: '/?provider=2336&cat=ott' },
                { name: 'Zee5', path: '/?provider=232&cat=ott' },
                { name: 'SonyLIV', path: '/?provider=237&cat=ott' }
            ]
            
        },
        {
            name: 'Language', cat: 'lang',
            dropdown: [
                { name: 'Hindi', path: '/?lang=hi&cat=lang' },
                { name: 'Tamil', path: '/?lang=ta&cat=lang' },
                { name: 'Telugu', path: '/?lang=te&cat=lang' },
                { name: 'Malayalam', path: '/?lang=ml&cat=lang' },
                { name: 'Kannada', path: '/?lang=kn&cat=lang' },
                { name: 'Bengali', path: '/?lang=bn&cat=lang' },
                { name: 'Marathi', path: '/?lang=mr&cat=lang' },
                { name: 'Punjabi', path: '/?lang=pa&cat=lang' },
                { name: 'Gujarati', path: '/?lang=gu&cat=lang' },
                { name: 'English', path: '/?lang=en&cat=lang' }
            ]
        }
    ];

    // Sync native DOM focus with the visual TV focus index
    useEffect(() => {
        const tvMode = isTV();
        if (!tvMode || activeDropdown !== null || isSearchOpen) return;
        
        const timer = setTimeout(() => {
            if (focusedNavIdx === navLinks.length) {
                searchIconRef.current?.focus();
            } else {
                navLinkRefs.current[focusedNavIdx]?.focus();
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [focusedNavIdx, activeDropdown, isSearchOpen, navLinks.length]);

    // ── After every route change: close menus & restore nav focus ──
    const lastPathname = useRef(location.pathname);

    useEffect(() => {
        setIsMenuOpen(false);
        setActiveDropdown(null);

        if (!isTV()) return;

        // CRITICAL: Prevent focus-hijacking.
        // We only steal focus for a completely new page (pathname change),
        // or if the focus is currently lost on the <body>. 
        // If the user already has focus on a video player, button, or card, DO NOT touch it.
        const pathChanged = lastPathname.current !== location.pathname;
        lastPathname.current = location.pathname;

        const isFocusLost = !document.activeElement || document.activeElement === document.body;
        if (!pathChanged && !isFocusLost) return;

        // Find which nav item matches the new route
        const matchedIdx = navLinks.findIndex(link => {
            if (link.cat === currentCat) return true;
            if (link.path === location.pathname) return true;
            return false;
        });

        const newIdx = matchedIdx >= 0 ? matchedIdx : 0;
        setFocusedNavIdx(newIdx);

        // Slight delay so the new page DOM is ready before we steal focus
        const timer = setTimeout(() => {
            // Verify focus is still "safe" to steal before doing it
            const stillLost = !document.activeElement || document.activeElement === document.body;
            if (pathChanged || stillLost) {
                navLinkRefs.current[newIdx]?.focus();
                // If path changed, we also scroll to top
                if (pathChanged) window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 150); // Increased delay slightly for better TV compatibility

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, location.search]);

    // ── Sync DOM focus when focusedNavIdx changes via arrow keys ──
    useEffect(() => {
        if (isTV()) {
            if (focusedNavIdx < navLinks.length) {
                navLinkRefs.current[focusedNavIdx]?.focus();
            } else {
                searchIconRef.current?.focus();
            }
        }
    }, [focusedNavIdx, navLinks.length]);

    // ── Dice helpers (unchanged) ───────────────────────────
    // ── Dropdown selection ─────────────────────────────────
    const handleDropdownSelect = (item) => {
        if (item.path) {
            navigate(item.path);
        }
        setActiveDropdown(null);
        // After selecting a dropdown item, move the TV focus indicator back to the first nav item.
        // so only one yellow underline is ever shown at a time.
        if (isTV()) {
            setFocusedNavIdx(0);
            setTimeout(() => navLinkRefs.current[0]?.focus({ preventScroll: true }), 50);
        }
    };

    const handleDropdownClose = () => {
        setActiveDropdown(null);
        // Restore focus to the current nav item immediately
        navLinkRefs.current[focusedNavIdx]?.focus({ preventScroll: true });
    };

    const handleSearchKeyDown = (e) => {
        // Prevent Backspace/Escape from bubbling up to handleNavKeyDown
        if (e.key === 'Backspace' || e.key === 'Escape') {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (searchQuery.trim()) {
                if (location.pathname === '/downloads') {
                    // Contextual search: hit Aoneroom search when on Downloads page
                    navigate(`/downloads?s=${encodeURIComponent(searchQuery.trim())}`);
                } else {
                    // Standard search: hit TMDB proxy search
                    navigate(`/?s=${encodeURIComponent(searchQuery.trim())}&cat=search`);
                }
                setIsSearchOpen(false);
                setSearchQuery('');
                
                // Reset TV focus to the first nav item when search is executed
                if (isTV()) {
                    setFocusedNavIdx(0);
                    setTimeout(() => navLinkRefs.current[0]?.focus({ preventScroll: true }), 50);
                }
            }
        }
    };

    // ── Mobile dropdown toggle ─────────────────────────────
    const toggleMobileDropdown = (name) => {
        setActiveDropdown(activeDropdown === name ? null : name);
    };

    // ── Navbar keyboard handler ────────────────────────────
    const handleNavKeyDown = useCallback((e) => {
        if (!isTV()) return;

        // If the TV video player is in interactive/fullscreen mode, completely
        // ignore all key events so D-pad presses inside the iframe don't
        // mutate navbar state (focused item, open dropdowns, etc.) in the background.
        if (window.__tvPlayerActive) return;

        // While search is open, global nav keys (Arrows/Enter) should be disabled
        // to prevent double-navigation or focus jumping.
        if (isSearchOpen) return;

        // While a dropdown is open, only handle Escape/Back here;
        // everything else is handled inside DropdownMenu.
        if (activeDropdown !== null) {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault();
                handleDropdownClose();
            }
            return;
        }

        const key = e.key;

        if (key === 'ArrowLeft') {
            e.preventDefault();
            setFocusedNavIdx(i => Math.max(0, i - 1));

        } else if (key === 'ArrowRight') {
            e.preventDefault();
            // Allow navigating to Search button (navLinks.length)
            setFocusedNavIdx(i => Math.min(navLinks.length, i + 1));

        } else if (key === 'Enter' || key === 'ArrowDown') {
            e.preventDefault();
            const isSearchBtn = focusedNavIdx === navLinks.length;

            if (isSearchBtn) {
                if (key === 'Enter') setIsSearchOpen(true);
                else { /* ArrowDown from Search also goes to grid */
                    document.getElementById('tv-grid-focus-anchor')?.focus();
                }
                return;
            }

            const link = navLinks[focusedNavIdx];
            if (link?.dropdown) {
                // Open dropdown
                setActiveDropdown(link.name);
            } else if (key === 'ArrowDown') {
                // No dropdown — move focus down to the movie grid
                document.getElementById('tv-grid-focus-anchor')?.focus();
            } else if (link?.path) {
                navigate(link.path);
            }

        } else if (key === 'ArrowUp') {
            // Already at the top — no-op
            e.preventDefault();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeDropdown, isSearchOpen, focusedNavIdx, navLinks, navigate]);

    return (
        <nav className={`navbar ${tvMode ? 'navbar--tv-mode' : ''}`} onKeyDown={handleNavKeyDown} id="tv-navbar">
            <div className="nav-left">
                {/* Hamburger — mobile only */}
                <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(true)}>
                    <Menu size={24} />
                </button>

                <Link to="/" className="nav-brand">
                    4KH<span className="brand-yellow">DHUB</span>
                </Link>

                {/* ── Desktop nav links ── */}
                <div className="nav-links">
                    {navLinks.map((link, idx) => {
                        const isActive =
                            currentCat === link.cat ||
                            link.path === location.pathname ||
                            false;
                        const isKbFocused = focusedNavIdx === idx && tvMode;
                        const isOpen = activeDropdown === link.name;

                        return (
                            <div
                                key={link.name}
                                className="nav-item-container"
                                onMouseEnter={() => link.dropdown && setActiveDropdown(link.name)}
                                onMouseLeave={() => setActiveDropdown(null)}
                            >
                                <Link
                                    ref={el => { navLinkRefs.current[idx] = el; }}
                                    to={link.path || '#'}
                                    className={`nav-link${isActive ? ' active' : ''}${isKbFocused ? ' nav-link--tv-focused' : ''}`}
                                    onClick={(e) => {
                                        if (link.dropdown) {
                                            e.preventDefault();
                                            // Mouse click toggles dropdown
                                            setActiveDropdown(isOpen ? null : link.name);
                                        }
                                        // For non-dropdown links, React Router handles navigation
                                    }}
                                    onKeyDown={(e) => {
                                        if (!tvMode) return;
                                        if (e.key === 'ArrowDown' && link.dropdown) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setActiveDropdown(link.name);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (tvMode) setFocusedNavIdx(idx);
                                    }}
                                    // tabIndex: on TV, only the "currently focused" item is
                                    // tab-reachable so Tab key jumps predictably.
                                    tabIndex={tvMode ? (idx === focusedNavIdx ? 0 : -1) : 0}
                                >
                                    {link.icon && link.icon}
                                    {link.name && link.name}
                                    {link.dropdown && <ChevronDown size={14} className="ml-1" />}
                                </Link>

                                {/* Dropdown — keyboard or hover driven */}
                                {link.dropdown && isOpen && (
                                    <DropdownMenu
                                        items={link.dropdown}
                                        onSelect={handleDropdownSelect}
                                        onClose={handleDropdownClose}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Search */}
            <div className="nav-right">
                {isSearchOpen ? (
                    <div className="search-container-nav">
                        <input
                            type="text"
                            className="nav-search-input"
                            placeholder={location.pathname === '/downloads' ? 'Search Downloads...' : 'Search Movies & TV...'}
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                        />
                        <button
                            ref={searchIconRef}
                            className={`nav-icon-btn ${focusedNavIdx === navLinks.length && tvMode ? 'nav-icon--tv-focused' : ''}`}
                            tabIndex={tvMode ? 0 : -1}
                            onKeyDown={(e) => { if (e.key === 'Enter') setIsSearchOpen(false); }}
                            onClick={() => setIsSearchOpen(false)}
                            aria-label="Close Search"
                        >
                            <X size={20} className="nav-icon" />
                        </button>
                    </div>
                ) : (
                    <button
                        ref={searchIconRef}
                        className={`nav-icon-btn ${focusedNavIdx === navLinks.length && tvMode ? 'nav-icon--tv-focused' : ''}`}
                        tabIndex={tvMode ? 0 : -1}
                        onKeyDown={(e) => { if (e.key === 'Enter') setIsSearchOpen(true); }}
                        onClick={() => setIsSearchOpen(true)}
                        aria-label="Open Search"
                    >
                        <Search size={20} className="nav-icon" />
                    </button>
                )}
            </div>

            {/* ══════════════════════════════════════════
                MOBILE SIDE MENU — completely unchanged
            ══════════════════════════════════════════ */}
            {isMenuOpen && (
                <div className="mobile-menu-overlay" onClick={() => setIsMenuOpen(false)}>
                    <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="mobile-menu-header">
                            <span className="nav-brand">4KH<span className="brand-yellow">DHUB</span></span>
                            <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <div className="mobile-nav-links">
                            {navLinks.map(link => (
                                <div key={link.name} className="mobile-nav-item">
                                    <div
                                        className={`mobile-nav-link-main ${activeDropdown === link.name ? 'active' : ''}`}
                                        onClick={() =>
                                            link.dropdown
                                                ? toggleMobileDropdown(link.name)
                                                : navigate(link.path)
                                        }
                                    >
                                        <span>{link.icon}{link.name}</span>
                                        {link.dropdown && (
                                            <ChevronDown
                                                size={16}
                                                className={activeDropdown === link.name ? 'rotate-180' : ''}
                                            />
                                        )}
                                    </div>
                                    {link.dropdown && activeDropdown === link.name && (
                                        <div className="mobile-dropdown-content">
                                            {link.dropdown.map(subItem => (
                                                <Link
                                                    key={subItem.name}
                                                    to={subItem.path || '#'}
                                                    className="mobile-dropdown-item"
                                                >
                                                    {subItem.name}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
