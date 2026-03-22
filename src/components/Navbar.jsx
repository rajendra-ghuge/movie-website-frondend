import { useState, useEffect } from 'react';
import { Search, Moon, X, ChevronDown, Menu } from 'lucide-react';
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
                { name: 'Comedy', path: '/?lang=hi&genre=35&cat=hi' },
                { name: 'Drama', path: '/?lang=hi&genre=18&cat=hi' },
                { name: 'Romance', path: '/?lang=hi&genre=10749&cat=hi' }
            ]
        },
        { 
            name: 'Hollywood', 
            cat: 'en',
            dropdown: [
                { name: 'All Hollywood', path: '/?lang=en&cat=en' },
                { name: 'Action', path: '/?lang=en&genre=28&cat=en' },
                { name: 'Sci-Fi', path: '/?lang=en&genre=878&cat=en' },
                { name: 'Horror', path: '/?lang=en&genre=27&cat=en' }
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
        }
    ];

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
                                {link.name}
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
                                                to={subItem.path} 
                                                className="dropdown-item"
                                                onClick={() => setActiveDropdown(null)}
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
                                        <span>{link.name}</span>
                                        {link.dropdown && <ChevronDown size={16} className={activeDropdown === link.name ? 'rotate-180' : ''} />}
                                    </div>
                                    
                                    {link.dropdown && activeDropdown === link.name && (
                                        <div className="mobile-dropdown-content">
                                            {link.dropdown.map(subItem => (
                                                <Link 
                                                    key={subItem.name} 
                                                    to={subItem.path} 
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
