/**
 * TV Navigation bootstrap.
 * 
 * We use manual DOM-based keyboard navigation instead of the spatial nav
 * library — this gives us full control over focus hand-off between the
 * navbar and the movie grid, which is critical for the "click a menu item
 * then immediately use arrow keys" flow to work correctly.
 *
 * The hook exists as a clean extension point if deeper integration is
 * needed in the future (e.g. adding norigin for complex multi-section pages).
 */
const useTVNavigation = () => {
    // No-op — navigation is handled directly in Navbar.jsx and MovieGrid.jsx
    // via onKeyDown handlers guarded by isTV() (window.innerWidth >= 1024).
};

export default useTVNavigation;
