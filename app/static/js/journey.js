window.JourneyOverview = () => {
    const [journeyData, setJourneyData] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [showAllTracks, setShowAllTracks] = React.useState(false);
    const [showAllArtists, setShowAllArtists] = React.useState(false);

    const defaultAlbumArt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23eee'/%3E%3Cpath d='M30 25a5 5 0 100 10 5 5 0 000-10zM27 30a3 3 0 116 0 3 3 0 01-6 0z' fill='%23999'/%3E%3C/svg%3E";

    React.useEffect(() => {
        fetchJourneyData();
    }, []);

    const fetchJourneyData = async () => {
        try {
            setIsLoading(true);
            console.log('Fetching journey data...');
            const response = await fetch('/api/journey-data');
            console.log('Response status:', response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error('Failed to fetch journey data');
            }
            const data = await response.json();
            console.log('Journey data loaded:', data);
            console.log('Cross-year stats:', data.cross_year_stats);
            console.log('Recurring tracks:', data.cross_year_stats?.recurring_tracks?.length || 0);
            console.log('Recurring artists:', data.cross_year_stats?.recurring_artists?.length || 0);
            setJourneyData(data);
        } catch (err) {
            console.error('Error fetching journey data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleYearClick = (year) => {
        window.location.href = `/select-year?year=${year}`;
    };

    const handleLogout = () => {
        window.location.href = '/logout';
    };

    // Loading state
    if (isLoading) {
        return React.createElement('div', {
            style: {
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F2F0ED'
            }
        }, [
            React.createElement('div', {
                key: 'spinner',
                style: {
                    width: '50px',
                    height: '50px',
                    border: '3px solid #c9b687',
                    borderTopColor: '#633514',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }
            }),
            React.createElement('p', {
                key: 'text',
                style: {
                    marginTop: '20px',
                    fontFamily: "'Georgia', serif",
                    color: '#633514',
                    fontSize: '18px'
                }
            }, 'Loading your wrapped journey...'),
            React.createElement('style', { key: 'style' }, `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `)
        ]);
    }

    // Error state
    if (error) {
        return React.createElement('div', {
            style: {
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F2F0ED',
                padding: '20px'
            }
        }, [
            React.createElement('h2', {
                key: 'title',
                style: { color: '#633514', fontFamily: "'Georgia', serif" }
            }, 'Something went wrong'),
            React.createElement('p', {
                key: 'error',
                style: { color: '#666', marginBottom: '20px' }
            }, error),
            React.createElement('a', {
                key: 'retry',
                href: '/journey',
                style: {
                    padding: '12px 24px',
                    backgroundColor: '#633514',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px'
                }
            }, 'Try Again')
        ]);
    }

    if (!journeyData) return null;

    const { username, total_wrapped_count, years, playlists, cross_year_stats } = journeyData;

    // Safely access cross_year_stats with defaults
    const recurring_tracks = cross_year_stats?.recurring_tracks || [];
    const recurring_artists = cross_year_stats?.recurring_artists || [];
    const total_unique_tracks = cross_year_stats?.total_unique_tracks || 0;
    const total_unique_artists = cross_year_stats?.total_unique_artists || 0;

    const displayedTracks = showAllTracks ? recurring_tracks : recurring_tracks.slice(0, 5);
    const displayedArtists = showAllArtists ? recurring_artists : recurring_artists.slice(0, 5);

    return React.createElement('div', {
        style: {
            minHeight: '100vh',
            backgroundColor: '#F2F0ED',
            padding: '0'
        }
    }, [
        // Header
        React.createElement('header', {
            key: 'header',
            style: {
                backgroundColor: '#633514',
                padding: '20px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        }, [
            React.createElement('div', { key: 'title' }, [
                React.createElement('h1', {
                    style: {
                        margin: 0,
                        color: 'white',
                        fontFamily: "'Georgia', serif",
                        fontSize: '28px',
                        fontWeight: 'normal'
                    }
                }, 'Your Wrapped Journey'),
                React.createElement('p', {
                    style: {
                        margin: '5px 0 0 0',
                        color: 'rgba(255,255,255,0.8)',
                        fontFamily: "'Georgia', serif",
                        fontSize: '16px'
                    }
                }, `${username}'s ${total_wrapped_count} year${total_wrapped_count !== 1 ? 's' : ''} of music`)
            ]),
            React.createElement('button', {
                key: 'logout',
                onClick: handleLogout,
                style: {
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: "'Georgia', serif",
                    fontSize: '14px',
                    transition: 'all 0.2s'
                },
                onMouseOver: (e) => {
                    e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    e.target.style.borderColor = 'white';
                },
                onMouseOut: (e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                }
            }, 'Logout')
        ]),

        // Main content
        React.createElement('main', {
            key: 'main',
            style: {
                maxWidth: '1000px',
                margin: '0 auto',
                padding: '40px 20px'
            }
        }, [
            // Stats Cards
            React.createElement('div', {
                key: 'stats',
                style: {
                    display: 'flex',
                    gap: '20px',
                    marginBottom: '40px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }
            }, [
                // Wrappeds count
                React.createElement('div', {
                    key: 'wrappeds',
                    style: {
                        backgroundColor: 'white',
                        padding: '24px 32px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        minWidth: '150px'
                    }
                }, [
                    React.createElement('div', {
                        style: {
                            fontSize: '36px',
                            fontWeight: '600',
                            color: '#633514',
                            fontFamily: "'Roboto Condensed', sans-serif"
                        }
                    }, total_wrapped_count),
                    React.createElement('div', {
                        style: {
                            fontSize: '14px',
                            color: '#888',
                            marginTop: '4px',
                            fontFamily: "'Georgia', serif"
                        }
                    }, 'Wrappeds')
                ]),
                // Unique tracks
                React.createElement('div', {
                    key: 'tracks',
                    style: {
                        backgroundColor: 'white',
                        padding: '24px 32px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        minWidth: '150px'
                    }
                }, [
                    React.createElement('div', {
                        style: {
                            fontSize: '36px',
                            fontWeight: '600',
                            color: '#633514',
                            fontFamily: "'Roboto Condensed', sans-serif"
                        }
                    }, total_unique_tracks),
                    React.createElement('div', {
                        style: {
                            fontSize: '14px',
                            color: '#888',
                            marginTop: '4px',
                            fontFamily: "'Georgia', serif"
                        }
                    }, 'Unique Tracks')
                ]),
                // Unique artists
                React.createElement('div', {
                    key: 'artists',
                    style: {
                        backgroundColor: 'white',
                        padding: '24px 32px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        minWidth: '150px'
                    }
                }, [
                    React.createElement('div', {
                        style: {
                            fontSize: '36px',
                            fontWeight: '600',
                            color: '#633514',
                            fontFamily: "'Roboto Condensed', sans-serif"
                        }
                    }, total_unique_artists),
                    React.createElement('div', {
                        style: {
                            fontSize: '14px',
                            color: '#888',
                            marginTop: '4px',
                            fontFamily: "'Georgia', serif"
                        }
                    }, 'Unique Artists')
                ])
            ]),

            // Year Cards Section
            React.createElement('div', {
                key: 'years-section',
                style: {
                    marginBottom: '50px'
                }
            }, [
                React.createElement('h2', {
                    key: 'years-title',
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '20px',
                        color: '#633514',
                        marginBottom: '20px',
                        fontWeight: 'normal'
                    }
                }, 'Your Wrapped Years'),
                React.createElement('p', {
                    key: 'years-subtitle',
                    style: {
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '20px',
                        fontFamily: "'Georgia', serif"
                    }
                }, 'Click any year to compare with other users'),
                React.createElement('div', {
                    key: 'years-grid',
                    style: {
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                    }
                }, years.map(year => {
                    const playlist = playlists[year] || {};
                    return React.createElement('div', {
                        key: year,
                        onClick: () => handleYearClick(year),
                        style: {
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minWidth: '140px',
                            textAlign: 'center',
                            border: '2px solid transparent'
                        },
                        onMouseOver: (e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
                            e.currentTarget.style.borderColor = '#633514';
                        },
                        onMouseOut: (e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                            e.currentTarget.style.borderColor = 'transparent';
                        }
                    }, [
                        React.createElement('div', {
                            key: 'year',
                            style: {
                                fontSize: '32px',
                                fontWeight: '700',
                                color: '#633514',
                                fontFamily: "'Roboto Condensed', sans-serif",
                                marginBottom: '8px'
                            }
                        }, year),
                        React.createElement('div', {
                            key: 'tracks',
                            style: {
                                fontSize: '13px',
                                color: '#888',
                                fontFamily: "'Georgia', serif"
                            }
                        }, `${playlist.track_count || 0} tracks`)
                    ]);
                }))
            ]),

            // Recurring Tracks Section (always show, with empty state message)
            React.createElement('div', {
                key: 'recurring-tracks',
                style: {
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }
            }, [
                React.createElement('h2', {
                    key: 'title',
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '20px',
                        color: '#633514',
                        marginTop: 0,
                        marginBottom: '8px',
                        fontWeight: 'normal'
                    }
                }, 'Your Timeless Tracks'),
                React.createElement('p', {
                    key: 'subtitle',
                    style: {
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '24px',
                        fontFamily: "'Georgia', serif"
                    }
                }, recurring_tracks.length > 0
                    ? `Songs that appeared in multiple years (${recurring_tracks.length} total)`
                    : years.length < 2
                        ? 'Add more Wrapped years to see songs that appear across multiple years!'
                        : 'No songs appeared in multiple years'),
                React.createElement('div', {
                    key: 'list',
                    style: { display: 'flex', flexDirection: 'column', gap: '12px' }
                }, displayedTracks.map((track, index) =>
                    React.createElement('div', {
                        key: track.id || index,
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '12px',
                            backgroundColor: '#F9F8F6',
                            borderRadius: '8px'
                        }
                    }, [
                        React.createElement('img', {
                            key: 'img',
                            src: track.album_image || defaultAlbumArt,
                            alt: track.name,
                            style: {
                                width: '50px',
                                height: '50px',
                                borderRadius: '4px',
                                objectFit: 'cover'
                            }
                        }),
                        React.createElement('div', {
                            key: 'info',
                            style: { flex: 1, minWidth: 0 }
                        }, [
                            React.createElement('div', {
                                key: 'name',
                                style: {
                                    fontFamily: "'Georgia', serif",
                                    fontSize: '15px',
                                    color: '#333',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }
                            }, track.name),
                            React.createElement('div', {
                                key: 'artist',
                                style: {
                                    fontSize: '13px',
                                    color: '#888',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }
                            }, track.artists.join(', '))
                        ]),
                        React.createElement('div', {
                            key: 'years',
                            style: {
                                fontSize: '12px',
                                color: '#633514',
                                backgroundColor: 'rgba(99, 53, 20, 0.1)',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                whiteSpace: 'nowrap'
                            }
                        }, track.years.join(', '))
                    ])
                )),
                recurring_tracks.length > 5 && React.createElement('button', {
                    key: 'show-more',
                    onClick: () => setShowAllTracks(!showAllTracks),
                    style: {
                        marginTop: '16px',
                        padding: '10px 20px',
                        backgroundColor: 'transparent',
                        color: '#633514',
                        border: '2px solid #633514',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Georgia', serif",
                        fontSize: '14px',
                        width: '100%'
                    }
                }, showAllTracks ? 'Show Less' : `Show All ${recurring_tracks.length} Tracks`)
            ]),

            // Recurring Artists Section (always show, with empty state message)
            React.createElement('div', {
                key: 'recurring-artists',
                style: {
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }
            }, [
                React.createElement('h2', {
                    key: 'title',
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '20px',
                        color: '#633514',
                        marginTop: 0,
                        marginBottom: '8px',
                        fontWeight: 'normal'
                    }
                }, 'Your Loyal Artists'),
                React.createElement('p', {
                    key: 'subtitle',
                    style: {
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '24px',
                        fontFamily: "'Georgia', serif"
                    }
                }, recurring_artists.length > 0
                    ? `Artists who appeared in multiple years (${recurring_artists.length} total)`
                    : years.length < 2
                        ? 'Add more Wrapped years to see artists that appear across multiple years!'
                        : 'No artists appeared in multiple years'),
                React.createElement('div', {
                    key: 'list',
                    style: { display: 'flex', flexDirection: 'column', gap: '12px' }
                }, displayedArtists.map((artist, index) =>
                    React.createElement('div', {
                        key: artist.name || index,
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px',
                            backgroundColor: '#F9F8F6',
                            borderRadius: '8px'
                        }
                    }, [
                        React.createElement('div', {
                            key: 'info',
                            style: { flex: 1 }
                        }, [
                            React.createElement('div', {
                                key: 'name',
                                style: {
                                    fontFamily: "'Georgia', serif",
                                    fontSize: '16px',
                                    color: '#333',
                                    fontWeight: '500'
                                }
                            }, artist.name),
                            React.createElement('div', {
                                key: 'stats',
                                style: {
                                    fontSize: '13px',
                                    color: '#888',
                                    marginTop: '4px'
                                }
                            }, `${artist.year_count} years, ${artist.total_tracks} tracks`)
                        ]),
                        React.createElement('div', {
                            key: 'years',
                            style: {
                                fontSize: '12px',
                                color: '#633514',
                                backgroundColor: 'rgba(99, 53, 20, 0.1)',
                                padding: '6px 12px',
                                borderRadius: '20px'
                            }
                        }, artist.years.join(', '))
                    ])
                )),
                recurring_artists.length > 5 && React.createElement('button', {
                    key: 'show-more',
                    onClick: () => setShowAllArtists(!showAllArtists),
                    style: {
                        marginTop: '16px',
                        padding: '10px 20px',
                        backgroundColor: 'transparent',
                        color: '#633514',
                        border: '2px solid #633514',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Georgia', serif",
                        fontSize: '14px',
                        width: '100%'
                    }
                }, showAllArtists ? 'Show Less' : `Show All ${recurring_artists.length} Artists`)
            ]),

            // Compare CTA
            React.createElement('div', {
                key: 'cta',
                style: {
                    textAlign: 'center',
                    marginTop: '40px',
                    marginBottom: '40px'
                }
            }, [
                React.createElement('p', {
                    key: 'text',
                    style: {
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '16px',
                        fontFamily: "'Georgia', serif"
                    }
                }, 'Ready to see how your taste compares to others?'),
                React.createElement('button', {
                    key: 'button',
                    onClick: () => handleYearClick(years[0]),
                    style: {
                        padding: '14px 32px',
                        backgroundColor: '#633514',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: "'Georgia', serif",
                        fontSize: '16px',
                        transition: 'background-color 0.2s'
                    },
                    onMouseOver: (e) => {
                        e.target.style.backgroundColor = '#4a2710';
                    },
                    onMouseOut: (e) => {
                        e.target.style.backgroundColor = '#633514';
                    }
                }, 'Compare with other users')
            ])
        ])
    ]);
};
