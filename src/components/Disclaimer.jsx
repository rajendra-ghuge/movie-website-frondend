import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Disclaimer = () => {
    const [isOpen, setIsOpen] = useState(false);

    // Lock body scroll when popup is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    const popup = isOpen ? createPortal(
        <div className="disclaimer-overlay" onClick={() => setIsOpen(false)}>
            <div className="disclaimer-popup" onClick={(e) => e.stopPropagation()}>
                <button className="disclaimer-close" onClick={() => setIsOpen(false)}>&times;</button>
                <h2 className="disclaimer-title">Copyright Disclaimer</h2>
                <div className="disclaimer-body">
                    <p>
                        4KHDHUB does not host, upload, store, or control any video files, streams, or media content on its own servers. All movies, TV shows, and related media are provided by third-party sources that are publicly available on the internet.
                    </p>
                    <p>
                        4KHDHUB functions solely as a search and indexing platform that embeds content from external providers for informational and convenience purposes.
                    </p>
                    <p>
                        We do not claim ownership of any trademarks, logos, images, videos, or copyrighted works displayed on this platform. All content remains the property of its respective owners.
                    </p>
                    <p>
                        If you are a copyright owner or authorized representative and believe that any content accessible through this platform infringes your rights, please contact us with the relevant details. Upon receiving a valid notice, we will promptly investigate and remove access to the reported content where appropriate.
                    </p>
                    <p>
                        By using this platform, users acknowledge that they are responsible for ensuring their use of any third-party content complies with applicable laws in their jurisdiction.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <span className="disclaimer-link" onClick={() => setIsOpen(true)}>
                Disclaimer
            </span>
            {popup}
        </>
    );
};

export default Disclaimer;
