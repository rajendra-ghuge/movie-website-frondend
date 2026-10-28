/**
 * Deduce video quality based on media type, OTT context, and theatrical release timeline.
 * 
 * - OTT / Streaming Context (provider, cat=ott, latest=ott): Always WEB-DL (or 4K if > 120 days)
 * - Confirmed Direct-to-OTT Releases (via ottMovieIds or metadata): WEB-DL
 * - TV / Web Series: HD (or NEW • HD if <= 14 days)
 * - Theatrical Window (First 60 days / 8 weeks): In cinema theaters, not yet exited to OTT -> CAM
 * - Post-Theatrical Exit / Digital Window (61 to 120 days): Exited theaters to OTT -> WEB-DL
 * - Catalog Classics (> 120 days): 4K
 * - Future releases: COMING SOON
 */
export const getMovieQuality = (movie, context = {}) => {
    const isTv = !movie.title && (movie.name || movie.media_type === 'tv');
    const releaseDateStr = movie.release_date || movie.first_air_date;

    if (!releaseDateStr) {
        return { label: 'HD', type: 'hd' };
    }

    const releaseDate = new Date(releaseDateStr);
    const now = new Date();
    const diffTime = now - releaseDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Future releases
    if (diffDays < 0) {
        return { label: 'COMING SOON', type: 'upcoming' };
    }

    // TV / Web Series: Airs directly on OTT/TV
    if (isTv) {
        if (diffDays <= 14) {
            return { label: 'NEW • HD', type: 'webdl' };
        }
        return { label: 'HD', type: 'hd' };
    }

    // 1. Browsing OTT Context (provider or cat=ott or latest=ott) -> Always on OTT
    if (context.isOtt) {
        if (diffDays > 120) {
            return { label: '4K', type: 'uhd' };
        }
        return { label: 'WEB-DL', type: 'webdl' };
    }

    // 2. Confirmed Direct-to-OTT Releases (even when browsing general or regional feeds)
    const isConfirmedOtt = context.ottMovieIds && context.ottMovieIds.has(movie.id);
    const homepage = (movie.homepage || '').toLowerCase();
    const isOttDirect = isConfirmedOtt || 
                        homepage.includes('netflix') || 
                        homepage.includes('primevideo') || 
                        homepage.includes('hotstar') || 
                        homepage.includes('zee5') ||
                        homepage.includes('sonyliv') ||
                        homepage.includes('apple.com');

    if (isOttDirect) {
        if (diffDays > 120) {
            return { label: '4K', type: 'uhd' };
        }
        return { label: 'WEB-DL', type: 'webdl' };
    }

    // 3. Theatrical Window (first 60 days / 8 weeks after release)
    // Theatrical movies are currently in cinemas and haven't exited to OTT yet -> CAM
    if (diffDays <= 60) {
        return { label: 'CAM', type: 'cam' };
    }

    // 4. Post-Theatrical Exit / Digital OTT Window (61 to 120 days)
    // Theatrical run has finished and digital/streaming copy has released -> WEB-DL
    if (diffDays <= 120) {
        return { label: 'WEB-DL', type: 'webdl' };
    }

    // 5. Full 4K & Blu-ray Window (120+ days)
    return { label: '4K', type: 'uhd' };
};
