import { useState, useEffect } from 'react';
import { Search, Moon, X, ChevronDown, Menu, Dice6 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const query = new URLSearchParams(location.search);
    const currentCat = query.get('cat') || 'home';

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
        setActiveDropdown(null);
    }, [location]);

    const navLinks = [
        { name: 'Home', path: '/', cat: 'home' },
        { name: 'Movies', path: '/?type=movie&cat=movie', cat: 'movie' },
        {
            name: 'Latest',
            cat: 'latest',
            dropdown: [
                { name: 'All Latest', path: '/?latest=all&cat=latest' },
                { name: 'OTT', path: '/?latest=ott&cat=latest' },
                { name: 'Theatrical', path: '/?latest=theatrical&cat=latest' }
            ]
        },
        { 
            name: 'Web Series', 
            path: '/?type=tv&cat=tv', 
            cat: 'tv',
            dropdown: [
                { name: 'Latest Web Series', path: '/?type=tv&cat=tv' },
                { name: 'Indian', path: '/?type=tv&lang=hi&cat=tv_hi' },
                { name: 'Hollywood', path: '/?type=tv&lang=en&cat=tv_en' }
            ]
        },
        { 
            name: 'Bollywood', 
            cat: 'hi',
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
            name: 'Hollywood', 
            cat: 'en',
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
            name: 'OTT', 
            cat: 'ott',
            dropdown: [
                { name: 'Netflix', path: '/?provider=8&cat=ott' },
                { name: 'Prime Video', path: '/?provider=119&cat=ott' },
                { name: 'Disney+ Hotstar', path: '/?provider=122&cat=ott' },
                { name: 'Zee5', path: '/?provider=232&cat=ott' },
                { name: 'SonyLIV', path: '/?provider=237&cat=ott' },
                { name: 'JioCinema', path: '/?provider=220&cat=ott' }
            ]
        },
        {
            name: 'Language',
            cat: 'lang',
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
        },
        {
            name: '', // No text, just icon
            cat: 'dice',
            icon: <Dice6 size={18} className="mr-1" title="Random" />, // Only icon
            dropdown: [
                { name: 'Indian (Random)', action: 'indian_dice' },
                { name: 'Hollywood (Random)', action: 'hollywood_dice' }
            ]
        }
    ];

    const generateRandomDiceParams = (type) => {
        const genres = [28, 12, 16, 35, 80, 18, 27, 10749, 878, 53];
        // Weighted languages: Hindi is much more common than others
        const indianLangs = ['hi', 'hi', 'hi', 'hi', 'mr', 'ta', 'te', 'ml', 'kn', 'bn', 'gu', 'pa'];
        const sorts = ['popularity.desc', 'primary_release_date.desc', 'vote_average.desc'];
        
        const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
        
        let lang = 'en';
        let pageLimit = 20;
        let genreCount = Math.random() > 0.6 ? 2 : 1;
        let minRatingVal = (Math.random() * 2 + 5).toFixed(1); // 5.0 to 7.0

        if (type === 'indian') {
            lang = indianLangs[Math.floor(Math.random() * indianLangs.length)];
            // Less content for regional languages, so reduce constraints
            if (lang !== 'hi') {
                pageLimit = 5;
                genreCount = 1;
                minRatingVal = 0; // Don't filter by rating for regional to ensure results
            }
        }

        const selectedGenres = [];
        for (let i = 0; i < genreCount; i++) {
            const g = genres[Math.floor(Math.random() * genres.length)];
            if (!selectedGenres.includes(g)) selectedGenres.push(g);
        }

        const randomPage = Math.floor(Math.random() * pageLimit) + 1;
        
        const params = new URLSearchParams();
        params.set('cat', 'dice');
        params.set('lang', lang);
        params.set('genre', selectedGenres.join(','));
        params.set('sort', randomSort);
        params.set('page', randomPage);
        if (minRatingVal > 0) params.set('min_rating', minRatingVal);
        params.set('r', Math.random().toString(36).substring(7));

        return params.toString();
    };

    const handleDiceClick = (action) => {
        setIsMenuOpen(false); // Close mobile menu if open
        if (action === 'indian_dice') {
            const params = generateRandomDiceParams('indian');
            navigate(`/?${params}`);
        } else if (action === 'hollywood_dice') {
            const params = generateRandomDiceParams('hollywood');
            navigate(`/?${params}`);
        }
    };

    const handleSearchSubmit = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/?s=${encodeURIComponent(searchQuery.trim())}&cat=search`);
            setIsSearchOpen(false);
            setSearchQuery('');
        }
    };

    const toggleMobileDropdown = (name) => {
        setActiveDropdown(activeDropdown === name ? null : name);
    };

    return (
        <nav className="navbar">
            <div className="nav-left">
                <button className="mobile-menu-btn" onClick={() => setIsMenuOpen(true)}>
                    <Menu size={24} />
                </button>
                
                <Link to="/" className="nav-brand">
                    4KH<span className="brand-yellow">DHUB</span>
                </Link>
                
                <div className="nav-links">
                    {navLinks.map(link => (
                        <div 
                            key={link.name} 
                            className="nav-item-container"
                            onMouseEnter={() => link.dropdown && setActiveDropdown(link.name)}
                            onMouseLeave={() => setActiveDropdown(null)}
                        >
                            <Link 
                                to={link.path || '#'} 
                                className={`nav-link ${currentCat === link.cat || (link.cat === 'home' && location.pathname === '/' && !location.search) ? 'active' : ''}`}
                                onClick={(e) => link.dropdown && e.preventDefault()}
                            >
                                {link.icon && link.icon}
                                {link.name && link.name}
                                {link.dropdown && <ChevronDown size={14} className="ml-1" />}
                            </Link>

                            {link.dropdown && activeDropdown === link.name && (
                                <div className="nav-dropdown">
                                    {link.dropdown.map(subItem => (
                                        subItem.isHeader ? (
                                            <div key={subItem.name} className="dropdown-header">{subItem.name}</div>
                                        ) : (
                                            <Link 
                                                key={subItem.name} 
                                                to={subItem.path || '#'} 
                                                className="dropdown-item"
                                                onClick={(e) => {
                                                    if (subItem.action) {
                                                        e.preventDefault();
                                                        handleDiceClick(subItem.action);
                                                    }
                                                    setActiveDropdown(null);
                                                }}
                                            >
                                                {subItem.name}
                                            </Link>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="nav-right">
                {isSearchOpen ? (
                    <div className="search-container-nav">
                        <input 
                            type="text" 
                            className="nav-search-input" 
                            placeholder="Search..."
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchSubmit}
                        />
                        <X 
                            size={20} 
                            className="nav-icon" 
                            onClick={() => setIsSearchOpen(false)} 
                        />
                    </div>
                ) : (
                    <Search 
                        size={20} 
                        className="nav-icon" 
                        onClick={() => setIsSearchOpen(true)} 
                    />
                )}
            </div>

            {/* Mobile Side Menu Overlay */}
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
                                        onClick={() => link.dropdown ? toggleMobileDropdown(link.name) : navigate(link.path)}
                                    >
                                        <span>{link.icon}{link.name}</span>
                                        {link.dropdown && <ChevronDown size={16} className={activeDropdown === link.name ? 'rotate-180' : ''} />}
                                    </div>
                                    
                                    {link.dropdown && activeDropdown === link.name && (
                                        <div className="mobile-dropdown-content">
                                            {link.dropdown.map(subItem => (
                                                <Link 
                                                    key={subItem.name} 
                                                    to={subItem.path || '#'} 
                                                    className="mobile-dropdown-item"
                                                    onClick={(e) => {
                                                        if (subItem.action) {
                                                            e.preventDefault();
                                                            handleDiceClick(subItem.action);
                                                        }
                                                    }}
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
