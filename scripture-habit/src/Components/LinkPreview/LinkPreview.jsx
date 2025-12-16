import React, { useState, useEffect } from 'react';
import './LinkPreview.css';

import { Capacitor } from '@capacitor/core';

const LinkPreview = ({ url, isSent }) => {
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // TODO: Replace with your actual production URL
    const API_BASE_URL = 'https://scripture-habit.vercel.app';

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                setLoading(true);
                setError(false);

                const baseUrl = Capacitor.isNativePlatform() ? API_BASE_URL : '';
                const response = await fetch(`${baseUrl}/api/url-preview?url=${encodeURIComponent(url)}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch preview');
                }

                const data = await response.json();
                setPreview(data);
            } catch (err) {
                console.error('Error fetching link preview:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (url) {
            fetchPreview();
        }
    }, [url]);

    if (loading) {
        return (
            <div className={`link-preview loading ${isSent ? 'sent' : 'received'}`}>
                <div className="link-preview-skeleton">
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text short"></div>
                </div>
            </div>
        );
    }

    if (error || !preview) {
        return null; // Just show the link without preview on error
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`link-preview ${isSent ? 'sent' : 'received'}`}
            onClick={(e) => e.stopPropagation()}
        >
            {preview.image && (
                <div className="link-preview-image">
                    <img
                        src={preview.image}
                        alt=""
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}
            <div className="link-preview-content">
                <div className="link-preview-site">
                    {preview.favicon && (
                        <img
                            src={preview.favicon}
                            alt=""
                            className="link-preview-favicon"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    )}
                    <span>{preview.siteName || new URL(url).hostname}</span>
                </div>
                <div className="link-preview-title">
                    {preview.title || url}
                </div>
                {preview.description && (
                    <div className="link-preview-description">
                        {preview.description.length > 100
                            ? preview.description.substring(0, 100) + '...'
                            : preview.description
                        }
                    </div>
                )}
            </div>
        </a>
    );
};

export default LinkPreview;
