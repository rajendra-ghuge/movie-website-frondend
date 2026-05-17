import React from 'react';
import '../styles/shimmer.css';

export const GridShimmer = () => {
    // Generate an array of 20 elements to simulate a full loaded grid
    const skeletons = Array(20).fill(0);

    return (
        <div className="grid-shimmer-container">
            {skeletons.map((_, index) => (
                <div key={`grid-shim-${index}`} className="grid-shimmer-card">
                    <div className="shimmer-wrapper grid-shimmer-poster"></div>
                    <div className="shimmer-wrapper grid-shimmer-title"></div>
                    <div className="shimmer-wrapper grid-shimmer-meta"></div>
                </div>
            ))}
        </div>
    );
};

export const DetailShimmer = () => {
    // Generate an array of 6 elements to simulate cast members
    const castSkeletons = Array(6).fill(0);

    return (
        <div className="detail-shimmer-container">
            <div className="detail-shimmer-left">
                <div className="shimmer-wrapper detail-shimmer-poster"></div>
            </div>
            
            <div className="detail-shimmer-right">
                <div className="shimmer-wrapper detail-shimmer-title"></div>
                
                <div className="detail-shimmer-meta-row">
                    <div className="shimmer-wrapper detail-shimmer-badge"></div>
                    <div className="shimmer-wrapper detail-shimmer-badge"></div>
                    <div className="shimmer-wrapper detail-shimmer-badge"></div>
                </div>
                
                <div className="shimmer-wrapper detail-shimmer-actions">
                     <div className="shimmer-wrapper detail-shimmer-btn"></div>
                     <div className="shimmer-wrapper detail-shimmer-btn"></div>
                </div>

                <div className="shimmer-wrapper detail-shimmer-overview"></div>
                
                <div className="detail-shimmer-cast">
                    {castSkeletons.map((_, index) => (
                        <div key={`cast-shim-${index}`} className="shimmer-wrapper detail-shimmer-avatar"></div>
                    ))}
                </div>
            </div>
        </div>
    );
};
