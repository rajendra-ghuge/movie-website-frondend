import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpDown, Flame, Sparkles, Star, ChevronDown, Check } from 'lucide-react';
import '../styles/sortDropdown.css';

export const SORT_OPTIONS = [
    {
        id: 'popularity.desc',
        label: 'Popular',
        icon: Flame,
    },
    {
        id: 'primary_release_date.desc',
        label: 'Latest',
        icon: Sparkles,
    },
    {
        id: 'vote_average.desc',
        label: 'Top Rated',
        icon: Star,
    }
];

const SortDropdown = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const sort = query.get('sort') || '';
    const latest = query.get('latest') || '';
    const cat = query.get('cat') || '';

    // Determine currently active sort option
    const activeSortId = useMemo(() => {
        if (sort === 'primary_release_date.desc' || sort === 'first_air_date.desc' || latest || cat === 'latest') {
            return 'primary_release_date.desc'; // Latest
        }
        if (sort === 'vote_average.desc' || cat === 'top') {
            return 'vote_average.desc'; // Top Rated
        }
        return 'popularity.desc'; // Popular
    }, [cat, latest, sort]);

    const activeOption = useMemo(() => {
        return SORT_OPTIONS.find(o => o.id === activeSortId) || SORT_OPTIONS[0];
    }, [activeSortId]);

    // Close on click outside or Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleSelectSort = (sortId) => {
        setIsOpen(false);
        const nextQuery = new URLSearchParams(location.search);

        if (sortId === 'popularity.desc') {
            nextQuery.delete('latest');
            if (nextQuery.get('cat') === 'latest' || nextQuery.get('cat') === 'top') {
                if (!nextQuery.get('lang') && !nextQuery.get('genre') && !nextQuery.get('provider')) {
                    nextQuery.set('cat', 'movie');
                    nextQuery.set('type', 'movie');
                } else {
                    nextQuery.delete('cat');
                }
            }
            nextQuery.set('sort', 'popularity.desc');
        } else if (sortId === 'primary_release_date.desc') {
            if (!nextQuery.get('lang') && !nextQuery.get('genre') && !nextQuery.get('provider') && (!cat || cat === 'movie')) {
                nextQuery.set('cat', 'latest');
                nextQuery.set('latest', 'all');
                nextQuery.set('sort', 'primary_release_date.desc');
            } else {
                nextQuery.delete('latest');
                if (nextQuery.get('cat') === 'top') nextQuery.delete('cat');
                nextQuery.set('sort', 'primary_release_date.desc');
            }
        } else if (sortId === 'vote_average.desc') {
            nextQuery.delete('latest');
            if (!nextQuery.get('lang') && !nextQuery.get('genre') && !nextQuery.get('provider') && (!cat || cat === 'movie')) {
                nextQuery.set('cat', 'top');
                nextQuery.set('sort', 'vote_average.desc');
            } else {
                if (nextQuery.get('cat') === 'latest') nextQuery.delete('cat');
                nextQuery.set('sort', 'vote_average.desc');
            }
        }

        const qs = nextQuery.toString();
        navigate(qs ? `/?${qs}` : '/');
    };

    return (
        <div className="sort-dropdown-container" ref={dropdownRef}>
            <button
                type="button"
                className={`sort-dropdown-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="true"
                aria-expanded={isOpen}
                title="Sort movies & web shows"
            >
                <ArrowUpDown size={14} className="sort-icon-lead" />
                <span className="sort-label-prefix">Sort:</span>
                <span className="sort-current-value">{activeOption.label}</span>
                <ChevronDown size={14} className={`sort-chevron ${isOpen ? 'rotated' : ''}`} />
            </button>

            {isOpen && (
                <div className="sort-menu" role="menu">
                    <div className="sort-menu-header">Sort By</div>
                    {SORT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = activeSortId === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                role="menuitem"
                                className={`sort-menu-item ${isSelected ? 'active' : ''}`}
                                onClick={() => handleSelectSort(opt.id)}
                            >
                                <span className="sort-item-left">
                                    <Icon size={14} className="sort-item-icon" />
                                    <span>{opt.label}</span>
                                </span>
                                {isSelected && <Check size={14} className="sort-check" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SortDropdown;
