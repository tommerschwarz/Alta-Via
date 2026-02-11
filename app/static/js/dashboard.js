window.PlaylistDashboard = () => {  
    const [playlistData, setPlaylistData] = React.useState([]);

    const [selectedPlaylists, setSelectedPlaylists] = React.useState([]);

    const plotRef = React.useRef(null);
    const yearHistRef = React.useRef(null);
    const popularityHistRef = React.useRef(null);
    const vennRef = React.useRef(null);
    const [selectedSharedTracks, setSelectedSharedTracks] = React.useState([]);
    const defaultAlbumArt = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23eee'/%3E%3Cpath d='M30 25a5 5 0 100 10 5 5 0 000-10zM27 30a3 3 0 116 0 3 3 0 01-6 0z' fill='%23999'/%3E%3C/svg%3E";
    const [currentlyPlaying, setCurrentlyPlaying] = React.useState(null);
    const [spotifyPlayer, setSpotifyPlayer] = React.useState(null);
    const [deviceId, setDeviceId] = React.useState(null);
    const [isSDKReady, setIsSDKReady] = React.useState(false);
    const [selectedSection, setSelectedSection] = React.useState(null); // can be 'left', 'right', or 'intersection'
    const [isLoading, setIsLoading] = React.useState(true);
    const [totalPlaylists, setTotalPlaylists] = React.useState(0);
    const [expectedTotal, setExpectedTotal] = React.useState(null);
    const [isIntroMode, setIsIntroMode] = React.useState(true);
    const [isInfoModalOpen, setIsInfoModalOpen] = React.useState(false);
    const artistHistRef = React.useRef(null);
    const genreHistRef = React.useRef(null);
    const [isAutoRotating, setIsAutoRotating] = React.useState(true);
    const rotationAngleRef = React.useRef(0);
    const animationFrameRef = React.useRef(null);
    const [checkedPlaylists, setCheckedPlaylists] = React.useState(new Set());
    const [focalPlaylistId, setFocalPlaylistId] = React.useState(null);
    const [showPlaylistPanel, setShowPlaylistPanel] = React.useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = React.useState(false);
    const [dataCollectionEnabled, setDataCollectionEnabled] = React.useState(() => {
        const stored = localStorage.getItem('multiwrapped_data_collection');
        return stored === null ? true : stored === 'true';
    });

    // Initialize checked playlists and focal playlist when data loads
    React.useEffect(() => {
        if (playlistData.length > 0 && checkedPlaylists.size === 0) {
            // Select all playlists by default
            setCheckedPlaylists(new Set(playlistData.map(p => p.playlist_id)));
            // Set user's playlist as focal point if available
            const userPlaylist = playlistData.find(p => p.playlist_id === window.userPlaylistId);
            if (userPlaylist) {
                setFocalPlaylistId(userPlaylist.playlist_id);
            }
        }
    }, [playlistData]);

    // Sync privacy preference with backend
    React.useEffect(() => {
        fetch('/privacy-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: dataCollectionEnabled })
        }).catch(err => console.log('Privacy sync failed:', err));
    }, [dataCollectionEnabled]);

    // Auto-rotate effect for the 3D scatterplot ("outer space" floating effect)
    React.useEffect(() => {
        if (!plotRef.current || !playlistData.length || isLoading) return;

        const rotateCamera = () => {
            if (!isAutoRotating || !plotRef.current) return;

            rotationAngleRef.current += 0.002; // Slow rotation speed
            const radius = 2.5;
            const elevation = 0.3; // Slight elevation angle

            const eye = {
                x: radius * Math.cos(rotationAngleRef.current),
                y: radius * Math.sin(rotationAngleRef.current),
                z: radius * elevation + 0.5
            };

            Plotly.relayout(plotRef.current, {
                'scene.camera.eye': eye,
                'scene.camera.center': { x: 0, y: 0, z: 0 }
            });

            animationFrameRef.current = requestAnimationFrame(rotateCamera);
        };

        // Start rotation after a short delay
        const startTimeout = setTimeout(() => {
            if (isAutoRotating) {
                animationFrameRef.current = requestAnimationFrame(rotateCamera);
            }
        }, 500);

        return () => {
            clearTimeout(startTimeout);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [playlistData, isLoading, isAutoRotating]);

    // Stop auto-rotation when user interacts with the plot
    React.useEffect(() => {
        if (!plotRef.current) return;

        const stopRotation = () => {
            setIsAutoRotating(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };

        const plotElement = plotRef.current;
        plotElement.addEventListener('mousedown', stopRotation);
        plotElement.addEventListener('wheel', stopRotation);
        plotElement.addEventListener('touchstart', stopRotation);

        return () => {
            plotElement.removeEventListener('mousedown', stopRotation);
            plotElement.removeEventListener('wheel', stopRotation);
            plotElement.removeEventListener('touchstart', stopRotation);
        };
    }, [plotRef.current]);

    function getCurrentUsername() {
        // Get the username from a data attribute in the HTML or from a global variable
        // For example, if you've stored it in the HTML:
        const usernameElement = document.getElementById('current-username');
        if (usernameElement) {
            return usernameElement.dataset.username;
        }
        // Or directly from window object if you've set it
        return window.currentUsername || '';
    }



    const InfoModal = () => {
        return React.createElement('div', {
            style: {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }
        }, [
            React.createElement('div', {
                style: {
                    backgroundColor: '#FFFFFF',
                    padding: '30px',
                    borderRadius: '8px',
                    maxWidth: '500px',
                    width: '90%',
                    maxHeight: '80%',
                    overflowY: 'auto',
                    position: 'relative',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }
            }, [
                // Close button
                React.createElement('button', {
                    onClick: () => setIsInfoModalOpen(false),
                    style: {
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#633514'
                    }
                }, '×'),

                // Modal Content
                React.createElement('h2', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        marginBottom: '20px',
                        color: '#633514'
                    }
                }, 'Welcome to multiwrapped'),

                React.createElement('p', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        marginBottom: '15px',
                        lineHeight: '1.6'
                    }
                }, 'multiwrapped is a tool that compares your Spotify Wrapped playlists with others.'),

                React.createElement('h3', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        marginTop: '20px',
                        marginBottom: '10px',
                        color: '#633514'
                    }
                }, 'How to Use'),

                React.createElement('ol', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        paddingLeft: '20px',
                        lineHeight: '1.6'
                    }
                }, [
                    React.createElement('li', null, 'Login with your Spotify account'),
                    React.createElement('li', null, [
                        'Make a copy of your Wrapped playlist (usually called "Your Top Songs <year>") into a new playlist called "<name> in <year>"',
                        React.createElement('ul', {
                          style: {
                            marginTop: '8px',
                            marginLeft: '20px'
                          }
                        }, [
                          React.createElement('li', {
                            style: {
                              listStyleType: 'disc',
                              fontSize: '14px',
                              color: '#666'
                            }
                          }, 'Note: You may have to select all tracks in your "Your Top Songs <year>" playlist and copy them into your new playlist')
                        ])
                      ]),
                    React.createElement('li', null, 'Select the Wrapped playlists you want to compare'),
                    React.createElement('li', null, 'Explore visualizations of your music taste compared to others')
                ]),

                React.createElement('p', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        marginTop: '20px',
                        fontStyle: 'italic',
                        color: '#666'
                    }
                }, 'For comments/feedback, write to tommerschwarz <at> gmail <dot> com')
            ])
        ]);
    };

    // Initialize Spotify Web Playback SDK
    React.useEffect(() => {
        let player = null;
        
        const initializePlayer = async () => {
            try {
                // Check premium status first
                const statusResponse = await fetch('/api/debug-token');
                const statusData = await statusResponse.json();
                
                if (statusData.product_type !== 'premium') {
                    console.error('Spotify Premium required for playback');
                    return;
                }

                console.log('Getting token...');
                const response = await fetch('/api/spotify-token');
                const data = await response.json();
                
                if (!data.token) {
                    console.error('No token available');
                    return;
                }

                console.log('Creating player...');
                player = new window.Spotify.Player({
                    name: 'multiwrapped Player',
                    getOAuthToken: cb => cb(data.token)
                });

                // Add error handling
                player.addListener('initialization_error', ({ message }) => {
                    console.error('Initialization error:', message);
                });

                player.addListener('authentication_error', ({ message }) => {
                    console.error('Authentication error:', message);
                });

                player.addListener('account_error', ({ message }) => {
                    console.error('Account error:', message);
                });

                player.addListener('ready', ({ device_id }) => {
                    console.log('Player ready with device ID:', device_id);
                    setDeviceId(device_id);
                    setSpotifyPlayer(player);
                    setIsSDKReady(true);
                });

                console.log('Connecting player...');
                const connected = await player.connect();
                console.log('Player connected:', connected);

            } catch (error) {
                console.error('Spotify initialization failed:', error);
            }
        };

        // Load the Spotify SDK script
        if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;

            script.onload = () => {
                console.log('SDK script loaded, waiting for ready event...');
            };

            document.body.appendChild(script);

            window.onSpotifyWebPlaybackSDKReady = () => {
                console.log('SDK ready, initializing player...');
                initializePlayer();
            };
        }

        return () => {
            if (player) {
                player.disconnect();
            }
        };
    }, []);

    // Update handlePlayPause to check SDK ready state
    const handlePlayPause = React.useCallback(async (track) => {
        if (!track.id) {
            console.error('No track ID provided');
            return;
        }
    
        // Open Spotify track directly
        window.open(`https://open.spotify.com/track/${track.id}`, '_blank');
    }, []);


    // Remove one of the fetch effects and keep just this one
    // Update your API fetch in dashboard.js to handle the new response format

    React.useEffect(() => {
        console.log("Starting data fetch");
        setIsLoading(true);
        setPlaylistData([]);
        
        fetch('/api/playlist-metrics', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Check if we're getting the new response format
            if (data.playlists && Array.isArray(data.playlists)) {
                console.log("Received new API response format");
                console.log("API provided user_playlist_id:", data.user_playlist_id);

                if (data.user_playlist_id) {
                    window.userPlaylistId = data.user_playlist_id;
                    console.log("Updated window.userPlaylistId from API:", window.userPlaylistId);
                }

                setTotalPlaylists(data.playlists.length);
                setPlaylistData(data.playlists);
                setIsLoading(false);
            } else if (Array.isArray(data) && data.length > 0) {
                console.log("Received old API response format (array of playlists)");
                setTotalPlaylists(data.length);
                setPlaylistData(data);
                setIsLoading(false);
            } else {
                console.warn("Received empty or invalid data");
                setIsLoading(false);
            }
        })
        .catch(error => {
            console.error('Error fetching playlist data:', error);
            setIsLoading(false);
        });
    }, []);

    React.useEffect(() => {
        // Don't auto-select anything - just leave it empty until user clicks
        if (playlistData.length > 0 && selectedPlaylists.length === 0) {
            // Initialize with empty selection, so the user has to click to select
            setSelectedPlaylists([]);
        }
    }, [playlistData]);


    // Add a new effect to color the closest and farthest playlists
    // First, modify the 3D scatter plot creation effect:
    React.useEffect(() => {
        if (!plotRef.current || !playlistData || playlistData.length === 0) return;

        // Filter to only show checked playlists
        const visiblePlaylists = playlistData.filter(p => checkedPlaylists.has(p.playlist_id));
        if (visiblePlaylists.length === 0) return;

        // Store current camera position if it exists
        const currentCamera = plotRef.current.layout?.scene?.camera;

        // Find the focal playlist (user-selected focal point)
        const focalPlaylist = visiblePlaylists.find(p => p.playlist_id === focalPlaylistId);
        const userPlaylist = focalPlaylist; // Use focal playlist as the reference point

        // If we have the focal playlist, calculate distances to all others
        let closestPlaylist = null;
        let farthestPlaylist = null;

        const playlistLabels = visiblePlaylists.map(p => {
            return p.playlist_name || p.name || 'Unnamed Playlist';
        });

        // Calculate distances from focal playlist
        if (userPlaylist && visiblePlaylists.length > 2) {
            const playlistsToCompare = visiblePlaylists.filter(p =>
                p.playlist_id !== userPlaylist.playlist_id
            );

            if (playlistsToCompare.length > 0) {
                const popularityValues = visiblePlaylists.map(p => p.avgPopularity);
                const genreValues = visiblePlaylists.map(p => p.genreCount);
                const yearValues = visiblePlaylists.map(p => p.avgYear);
                
                const popularityRange = Math.max(...popularityValues) - Math.min(...popularityValues) || 1;
                const genreRange = Math.max(...genreValues) - Math.min(...genreValues) || 1;
                const yearRange = Math.max(...yearValues) - Math.min(...yearValues) || 1;
                
                // Calculate scaled distances with logging
                const playlistsWithDistance = playlistsToCompare.map(p => {
                    const dx = (p.avgPopularity - userPlaylist.avgPopularity) / popularityRange;
                    const dy = (p.genreCount - userPlaylist.genreCount) / genreRange;
                    const dz = (p.avgYear - userPlaylist.avgYear) / yearRange;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    console.log(`Distance from ${userPlaylist.name} to ${p.name}: ${distance}`);
                    return { ...p, distance };
                });
                    
                // Sort by distance
                playlistsWithDistance.sort((a, b) => a.distance - b.distance);
                
                // Find closest and farthest
                if (playlistsWithDistance.length > 0) {
                    closestPlaylist = playlistsWithDistance[0];
                    farthestPlaylist = playlistsWithDistance[playlistsWithDistance.length - 1];
                    console.log(`Closest playlist: ${closestPlaylist.name} (${closestPlaylist.distance})`);
                    console.log(`Farthest playlist: ${farthestPlaylist.name} (${farthestPlaylist.distance})`);
                }
            }
        }
        
        // Create the main data trace using visible playlists
        const dataSeries = {
            type: 'scatter3d',
            mode: 'markers+text',
            x: visiblePlaylists.map(p => p.avgPopularity),
            y: visiblePlaylists.map(p => p.genreCount),
            z: visiblePlaylists.map(p => p.avgYear),
            text: playlistLabels,
            textfont: {
                size: 14,
                family: 'Inter, sans-serif',
                color: '#000000'
            },
            textposition: 'top',
            marker: {
                size: 15,
                color: visiblePlaylists.map((p, index) => {
                    // If it's selected for comparison
                    if (selectedPlaylists.includes(playlistLabels[index])) {
                        return '#2D3748';  // Dark slate for selected
                    }

                    // FOCAL PLAYLIST - user's chosen focal point
                    if (focalPlaylistId && p.playlist_id === focalPlaylistId) {
                        return '#4A90A4';  // Blue for focal playlist
                    }

                    // Closest playlist to focal
                    if (closestPlaylist && p.playlist_id === closestPlaylist.playlist_id) {
                        return '#5B8C5A';  // Green for most similar
                    }

                    // Farthest playlist from focal
                    if (farthestPlaylist && p.playlist_id === farthestPlaylist.playlist_id) {
                        return '#CC6B6B';  // Muted red for most different
                    }

                    // Default color
                    return '#B8B0A0';  // Neutral gray-beige for other playlists
                }),
                opacity: 0.8
            },
            hoverinfo: 'text',
            hovertext: visiblePlaylists.map((p, index) =>
                `<b>${playlistLabels[index]}</b><br>` +
                `Popularity: ${Math.round(p.avgPopularity)}<br>` +
                `Genres: ${p.genreCount}<br>` +
                `Year: ${p.avgYear.toFixed(1)}`
            ),
            showlegend: false
        };
        
        // Create legend entries
        const traces = [dataSeries];
        
        // Only add legend entries if we have the special playlists
        if (userPlaylist) {
            // User playlist legend
            traces.push({
                type: 'scatter3d',
                mode: 'markers',
                x: [null],
                y: [null],
                z: [null],
                name: 'Focal Playlist',
                marker: { color: '#4A90A4', size: 10 },
                showlegend: true,
                hoverinfo: 'none'
            });

            if (closestPlaylist) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers',
                    x: [null],
                    y: [null],
                    z: [null],
                    name: 'Most Similar',
                    marker: { color: '#5B8C5A', size: 10 },
                    showlegend: true,
                    hoverinfo: 'none'
                });
            }

            if (farthestPlaylist) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers',
                    x: [null],
                    y: [null],
                    z: [null],
                    name: 'Most Different',
                    marker: { color: '#CC6B6B', size: 10 },
                    showlegend: true,
                    hoverinfo: 'none'
                });
            }

            // Selected for comparison legend
            if (selectedPlaylists.length > 0) {
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers',
                    x: [null],
                    y: [null],
                    z: [null],
                    name: 'Selected',
                    marker: { color: '#2D3748', size: 10 },
                    showlegend: true,
                    hoverinfo: 'none'
                });
            }
        }
        
        const layout = {
            scene: {
                xaxis: {
                    title: 'Average Popularity',
                    range: [0, 100],
                    titlefont: { size: 12, family: "'Georgia', serif" }
                },
                yaxis: {
                    title: 'Number of Genres',
                    autorange: true,
                    titlefont: { size: 12, family: "'Georgia', serif" }
                },
                zaxis: {
                    title: 'Average Year',
                    autorange: true,
                    titlefont: { size: 12, family: "'Georgia', serif" },
                    tickformat: 'd'
                },
                camera: currentCamera || undefined,
                aspectratio: { x: 1, y: 1, z: 0.75 }
            },
            margin: { l: 0, r: 0, b: 0, t: 30 },
            showlegend: userPlaylist !== null,
            legend: {
                x: 0.8,
                y: 0.9,
                bgcolor: 'rgba(255,255,255,0.6)',
                bordercolor: '#ccc',
                borderwidth: 1,
                font: { family: "'Georgia', serif" }
            },
            autosize: true,
            paper_bgcolor: '#F2F0ED',
            plot_bgcolor: '#F2F0ED'
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            scrollZoom: true,
            dragmode: 'orbit',
            hovermode: 'closest',
            displaylogo: false
        };

        Plotly.newPlot(plotRef.current, traces, layout, config).then(() => {
            // Add click handler
            plotRef.current.on('plotly_click', (data) => {
                if (!data.points || data.points.length === 0) return;
                
                // Handle clicks on any point in any trace
                const clickedPoint = data.points[0];

                const pointIndex = clickedPoint.pointNumber;
                const pointName = clickedPoint.text;
                
                if (!pointName) return;
                
                console.log("Regular point clicked:", pointName);
                
                const newSelection = selectedPlaylists.includes(pointName) 
                    ? selectedPlaylists.filter(p => p !== pointName)
                    : selectedPlaylists.length < 2 
                        ? [...selectedPlaylists, pointName]
                        : [selectedPlaylists[1], pointName];
                
                setSelectedPlaylists(newSelection);
            });
        });

        return () => {
            if (plotRef.current && plotRef.current.removeAllListeners) {
                plotRef.current.removeAllListeners('plotly_click');
            }
        };
    }, [playlistData, selectedPlaylists, checkedPlaylists, focalPlaylistId]);


    // New effect for histograms
    React.useEffect(() => {
        if (selectedPlaylists.length !== 2) return;
        if (!yearHistRef.current) return;

        const playlist1 = playlistData.find(p => p.playlist_name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.playlist_name === selectedPlaylists[1]);

        // Check if we have the required data
        if (!playlist1?.years || !playlist2?.years || 
            !playlist1?.popularityScores || !playlist2?.popularityScores) {
            console.log("Missing required data for visualization", { playlist1, playlist2 });
            return;
        }
    
        // Year histogram by decades
        const getDecade = year => Math.floor(year / 10) * 10;
        const decades1 = playlist1.years.map(getDecade);
        const decades2 = playlist2.years.map(getDecade);
    
        // Count tracks per decade
        const decadeCounts1 = {};
        const decadeCounts2 = {};
        decades1.forEach(decade => decadeCounts1[decade] = (decadeCounts1[decade] || 0) + 1);
        decades2.forEach(decade => decadeCounts2[decade] = (decadeCounts2[decade] || 0) + 1);
    
        // Create sorted arrays of decades and counts
        const allDecades = [...new Set([...Object.keys(decadeCounts1), ...Object.keys(decadeCounts2)])].sort();
        
        // Modern area chart for decades
        const yearTraces = [
            {
                type: 'scatter',
                mode: 'lines',
                x: allDecades,
                y: allDecades.map(decade => decadeCounts1[decade] || 0),
                name: playlist1.playlist_name,
                line: { color: '#4A90A4', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(74, 144, 164, 0.2)'
            },
            {
                type: 'scatter',
                mode: 'lines',
                x: allDecades,
                y: allDecades.map(decade => decadeCounts2[decade] || 0),
                name: playlist2.playlist_name,
                line: { color: '#5B8C5A', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(91, 140, 90, 0.2)'
            }
        ];

        const yearLayout = {
            title: {
                text: 'Music Timeline',
                font: { family: "'Georgia', serif", size: 20, color: '#333' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                tickmode: 'array',
                ticktext: allDecades.map(d => `${d}s`),
                tickvals: allDecades,
                tickfont: { family: "'Georgia', serif", size: 12 },
                gridcolor: 'rgba(0,0,0,0.05)'
            },
            yaxis: {
                title: { text: 'Tracks', font: { family: "'Georgia', serif", size: 12 } },
                tickfont: { family: "'Georgia', serif", size: 11 },
                gridcolor: 'rgba(0,0,0,0.05)'
            },
            showlegend: true,
            height: 300,
            margin: { t: 50, r: 50, b: 40, l: 40 },
            paper_bgcolor: '#F2F0ED',
            height: 280,
            margin: { l: 50, r: 30, t: 50, b: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            legend: {
                orientation: 'h',
                y: -0.2,
                x: 0.5,
                xanchor: 'center',
                font: { family: "'Georgia', serif", size: 11 }
            },
            hoverlabel: {
                bgcolor: '#fff',
                font: { family: "'Georgia', serif" }
            }
        };

        // Popularity density curve
        const generateKDE = (data, bandwidth = 5) => {
            const x = Array.from({length: 101}, (_, i) => i);
            const y = x.map(xi => {
                return data.reduce((sum, di) => {
                    return sum + Math.exp(-Math.pow(xi - di, 2) / (2 * Math.pow(bandwidth, 2)));
                }, 0) / (data.length * Math.sqrt(2 * Math.PI * Math.pow(bandwidth, 2)));
            });
            return {x, y};
        };
    
        const kde1 = generateKDE(playlist1.popularityScores);
        const kde2 = generateKDE(playlist2.popularityScores);
    
        const popularityLayout = {
            title: {
                text: 'Popularity Distribution',
                font: { family: "'Georgia', serif", size: 20, color: '#333' },
                x: 0.5,
                xanchor: 'center'
            },
            xaxis: {
                range: [0, 100],
                tickfont: { family: "'Georgia', serif", size: 11 },
                gridcolor: 'rgba(0,0,0,0.05)',
                title: { text: 'Popularity Score', font: { family: "'Georgia', serif", size: 12 } }
            },
            yaxis: {
                showticklabels: false,
                zeroline: false,
                showgrid: false
            },
            annotations: [{
                text: '← Obscure · Popular →',
                font: { size: 11, family: "'Georgia', serif", color: '#888' },
                showarrow: false,
                yref: 'paper',
                y: -0.18,
                xref: 'paper',
                x: 0.5
            }],
            height: 280,
            margin: { t: 50, r: 30, b: 60, l: 30 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            legend: {
                orientation: 'h',
                y: -0.25,
                x: 0.5,
                xanchor: 'center',
                font: { family: "'Georgia', serif", size: 11 }
            },
            hoverlabel: {
                bgcolor: '#fff',
                font: { family: "'Georgia', serif" }
            }
        };

        const popularityTraces = [
            {
                type: 'scatter',
                x: kde1.x,
                y: kde1.y,
                name: playlist1.playlist_name,
                line: { color: '#4A90A4', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(74, 144, 164, 0.15)',
                hovertemplate: 'Popularity: %{x}<extra></extra>'
            },
            {
                type: 'scatter',
                x: kde2.x,
                y: kde2.y,
                name: playlist2.playlist_name,
                line: { color: '#5B8C5A', width: 3, shape: 'spline' },
                fill: 'tozeroy',
                fillcolor: 'rgba(91, 140, 90, 0.15)',
                hovertemplate: 'Popularity: %{x}<extra></extra>'
            }
        ];
    
        // Combined plot with subplots
        const combinedTraces = [
            // Timeline traces (top subplot)
            { ...yearTraces[0], xaxis: 'x', yaxis: 'y' },
            { ...yearTraces[1], xaxis: 'x', yaxis: 'y' },
            // Popularity traces (bottom subplot)
            { ...popularityTraces[0], xaxis: 'x2', yaxis: 'y2', showlegend: false },
            { ...popularityTraces[1], xaxis: 'x2', yaxis: 'y2', showlegend: false }
        ];

        const combinedLayout = {
            grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
            xaxis: {
                tickmode: 'array',
                ticktext: allDecades.map(d => `${d}s`),
                tickvals: allDecades,
                tickfont: { family: "'Georgia', serif", size: 11 },
                gridcolor: 'rgba(0,0,0,0.05)',
                domain: [0, 1],
                anchor: 'y'
            },
            yaxis: {
                title: { text: 'Tracks', font: { family: "'Georgia', serif", size: 11 } },
                tickfont: { family: "'Georgia', serif", size: 10 },
                gridcolor: 'rgba(0,0,0,0.05)',
                domain: [0.55, 1],
                anchor: 'x'
            },
            xaxis2: {
                range: [0, 100],
                tickfont: { family: "'Georgia', serif", size: 11 },
                gridcolor: 'rgba(0,0,0,0.05)',
                domain: [0, 1],
                anchor: 'y2',
                title: { text: 'Popularity', font: { family: "'Georgia', serif", size: 11 } }
            },
            yaxis2: {
                showticklabels: false,
                zeroline: false,
                showgrid: false,
                domain: [0, 0.4],
                anchor: 'x2'
            },
            annotations: [
                { text: 'Music Timeline', x: 0.5, y: 1.08, xref: 'paper', yref: 'paper', showarrow: false, font: { family: "'Georgia', serif", size: 14, color: '#333' } },
                { text: 'Popularity Distribution', x: 0.5, y: 0.42, xref: 'paper', yref: 'paper', showarrow: false, font: { family: "'Georgia', serif", size: 14, color: '#333' } }
            ],
            height: 340,
            margin: { l: 50, r: 30, t: 40, b: 50 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            legend: {
                orientation: 'h',
                y: -0.15,
                x: 0.5,
                xanchor: 'center',
                font: { family: "'Georgia', serif", size: 11 }
            },
            hoverlabel: { bgcolor: '#fff', font: { family: "'Georgia', serif" } }
        };

        Plotly.newPlot(yearHistRef.current, combinedTraces, combinedLayout, { responsive: true });
    }, [selectedPlaylists, playlistData]);

    // Add Venn diagram effect
    React.useEffect(() => {
        if (!selectedPlaylists || selectedPlaylists.length !== 2) return;
        if (!vennRef.current || !window.venn || !window.d3) return;

        const playlist1 = playlistData.find(p => p.playlist_name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.playlist_name === selectedPlaylists[1]);

        console.log("Building Venn diagram for:", {
            playlist1: {
                name: playlist1?.playlist_name,
                tracksCount: playlist1?.tracks?.length,
                sampleTrack: playlist1?.tracks?.[0]
            },
            playlist2: {
                name: playlist2?.playlist_name,
                tracksCount: playlist2?.tracks?.length,
                sampleTrack: playlist2?.tracks?.[0]
            }
        });

        if (!playlist1?.tracks || !playlist2?.tracks) {
            console.log("Missing track data for Venn diagram", {
                playlist1Tracks: playlist1?.tracks,
                playlist2Tracks: playlist2?.tracks
            });
            return;
        }
    
        console.log("Selected playlists data:", { playlist1, playlist2 });
    
        if (!playlist1?.tracks || !playlist2?.tracks) {
            console.log("Missing track data for Venn diagram", {
                playlist1Tracks: playlist1?.tracks,
                playlist2Tracks: playlist2?.tracks
            });
            return;
        }
    
        // Create sets of track identifiers (name + artist)
        const getTrackIdentifier = track => `${track.name}___${track.artists.join(',')}`.toLowerCase();

        const tracks1 = new Set(playlist1.tracks.map(t => getTrackIdentifier(t)));
        const tracks2 = new Set(playlist2.tracks.map(t => getTrackIdentifier(t)));

        console.log("Track sets:", {
            tracks1Size: tracks1.size,
            tracks2Size: tracks2.size
        });

        // Calculate intersection
        const intersection = new Set(
            [...tracks1].filter(x => tracks2.has(x))
        );

        console.log("Intersection size:", intersection.size);

        // Map identifiers to track objects for hover info
        const tracksMap1 = Object.fromEntries(playlist1.tracks.map(t => [getTrackIdentifier(t), t]));
        const tracksMap2 = Object.fromEntries(playlist2.tracks.map(t => [getTrackIdentifier(t), t]));
    
    
        // Prepare data for Venn diagram
        const sets = [
            {
                sets: [playlist1.playlist_name],
                size: tracks1.size,
                label: `${playlist1.playlist_name}`
            },
            {
                sets: [playlist2.playlist_name],
                size: tracks2.size,
                label: `${playlist2.playlist_name}`
            },
            {
                sets: [playlist1.playlist_name, playlist2.playlist_name],
                size: intersection.size
            }
        ];
    
        // Clear previous diagram
        window.d3.select(vennRef.current).selectAll("*").remove();
    
        // Create new diagram
        const chart = window.venn.VennDiagram()
            .width(400)
            .height(300);
    
        const div = window.d3.select(vennRef.current);
        div.datum(sets).call(chart);
    
        // Style the diagram
        div.selectAll(".venn-circle path")
            .style("fill", function(d) {
                if (d.sets.length === 2) {  // Intersection
                    return "#633514";  // Brown for intersection
                }
                // For the individual circles, use beige for first playlist and brown for second
                return d.sets[0] === playlist1.playlist_name ? "#c9b687" : "#633514";
            })
            .style("fill-opacity", 0.2)
            .style("stroke", function(d) {
                if (d.sets.length === 2) {  // Intersection
                    return "#633514";  // Brown for intersection
                }
                // Match stroke color to fill
                return d.sets[0] === playlist1.playlist_name ? "#c9b687" : "#633514";
            })
            .style("stroke-width", 2);
    
        div.selectAll(".venn-circle text")
            .style("font-size", "14px")
            .style("font-weight", "100")
            .style("fill", "black");
    
        // Add tooltips with track names
        div.selectAll("g")
            .on("mouseover", function(event) {
                const selection = window.d3.select(this);
                const pathData = selection.select("path").datum();
                let tracksToShow = [];
                
                if (pathData.sets.length === 1) {
                    // Single set - show unique tracks
                    const otherSet = pathData.sets[0] === playlist1.playlist_name ? tracks2 : tracks1;
                    const thisMap = pathData.sets[0] === playlist1.playlist_name ? tracksMap1 : tracksMap2;
                    
                    tracksToShow = Object.entries(thisMap)
                        .filter(([identifier]) => !otherSet.has(identifier))
                        .map(([_, track]) => ({
                            name: track.name,
                            artists: track.artists.join(', ')
                        }))
                        .slice(0, 5);
                } else {
                    // Intersection - show shared tracks
                    tracksToShow = [...intersection]
                        .map(identifier => ({
                            name: tracksMap1[identifier].name,
                            artists: tracksMap1[identifier].artists.join(', ')
                        }))
                        .slice(0, 5);
                }
    
                selection.select("path")
                    .style("fill-opacity", 0.4)
                    .style("stroke-width", 3);
    
                if (tracksToShow.length > 0) {
                    const tooltip = window.d3.select(vennRef.current)
                        .append("div")
                        .attr("class", "venn-tooltip")
                        .style("position", "absolute")
                        .style("background-color", "white")
                        .style("padding", "10px")
                        .style("border", "1px solid #ccc")
                        .style("border-radius", "4px")
                        .style("pointer-events", "none")
                        .style("max-width", "300px")
                        .html(`
                            <strong>Sample tracks:</strong><br>
                            ${tracksToShow.map(t => 
                                `<div style="margin: 5px 0">
                                    <div>${t.name}</div>
                                    <div style="font-size: 0.9em; color: #666">by ${t.artists}</div>
                                 </div>`
                            ).join('')}
                        `);
    
                    const bounds = this.getBoundingClientRect();
                    const containerBounds = vennRef.current.getBoundingClientRect();
                    tooltip
                        .style("left", `${bounds.left - containerBounds.left + bounds.width/2}px`)
                        .style("top", `${bounds.top - containerBounds.top - 10}px`);
                }
            })
            
            .on("mouseout", function() {
                window.d3.select(this).select("path")
                    .style("fill-opacity", 0.2)  // Back to original opacity
                    .style("stroke-width", 2);
                window.d3.select(vennRef.current).selectAll(".venn-tooltip").remove();
            });

        // Add click handler for all sections of Venn diagram
        div.selectAll("g")
            .on('click', function(event) {
                const selection = window.d3.select(this);
                const pathData = selection.select("path").datum();
                
                if (pathData.sets.length === 2) {
                    // Intersection
                    const sharedTracks = [...intersection].map(identifier => ({
                        id: tracksMap1[identifier].id,  // Keep original ID for playback
                        name: tracksMap1[identifier].name,
                        artists: tracksMap1[identifier].artists.join(', '),
                        album_image: tracksMap1[identifier].album_image
                    }));
                    setSelectedSharedTracks(sharedTracks);
                    setSelectedSection('intersection');
                } else {
                    // Single set - exclusive tracks
                    const isFirstPlaylist = pathData.sets[0] === playlist1.playlist_name;
                    const thisMap = isFirstPlaylist ? tracksMap1 : tracksMap2;
                    const otherSet = isFirstPlaylist ? tracks2 : tracks1;
                    
                    const exclusiveTracks = Object.entries(thisMap)
                        .filter(([identifier]) => !otherSet.has(identifier))
                        .map(([_, track]) => ({
                            id: track.id,  // Keep original ID for playback
                            name: track.name,
                            artists: track.artists.join(', '),
                            album_image: track.album_image
                        }));
                    setSelectedSharedTracks(exclusiveTracks);
                    setSelectedSection(isFirstPlaylist ? 'left' : 'right');
                }
            });
    
    }, [selectedPlaylists, playlistData]);

    // Artist Comparison Chart (keep the existing implementation)
    React.useEffect(() => {
        if (selectedPlaylists.length !== 2) return;
        if (!artistHistRef.current) return;

        const playlist1 = playlistData.find(p => p.playlist_name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.playlist_name === selectedPlaylists[1]);

        // Create sets of artists for each playlist
        const artists1 = new Set(playlist1.tracks.flatMap(track => track.artists));
        const artists2 = new Set(playlist2.tracks.flatMap(track => track.artists));

        // Find common artists
        const commonArtists = [...artists1].filter(artist => artists2.has(artist));

        // Count tracks for each common artist in both playlists
        const artistOverlap = commonArtists.map(artist => ({
            artist,
            playlist1Tracks: playlist1.tracks.filter(track => track.artists.includes(artist)).length,
            playlist2Tracks: playlist2.tracks.filter(track => track.artists.includes(artist)).length
        }))
        // Sort by total tracks in descending order
        .sort((a, b) => (b.playlist1Tracks + b.playlist2Tracks) - (a.playlist1Tracks + a.playlist2Tracks))
        // Take top 10
        .slice(0, 10);

        console.log("Artist Overlap:", artistOverlap);

        // Compact horizontal bar chart for artists
        const artists = artistOverlap.map(item => item.artist).reverse();
        const p1Counts = artistOverlap.map(item => item.playlist1Tracks).reverse();
        const p2Counts = artistOverlap.map(item => item.playlist2Tracks).reverse();

        const traces = [
            {
                x: p1Counts,
                y: artists,
                type: 'bar',
                orientation: 'h',
                name: playlist1.playlist_name,
                marker: { color: '#4A90A4', opacity: 0.85 },
                hovertemplate: '<b>%{y}</b>: %{x} tracks<extra></extra>'
            },
            {
                x: p2Counts,
                y: artists,
                type: 'bar',
                orientation: 'h',
                name: playlist2.playlist_name,
                marker: { color: '#5B8C5A', opacity: 0.85 },
                hovertemplate: '<b>%{y}</b>: %{x} tracks<extra></extra>'
            }
        ];

        const artistLayout = {
            title: { text: 'Shared Artists', font: { family: "'Georgia', serif", size: 14, color: '#333' }, x: 0.5 },
            barmode: 'group',
            bargap: 0.3,
            xaxis: {
                title: { text: 'Tracks', font: { family: "'Georgia', serif", size: 11 } },
                tickfont: { family: "'Georgia', serif", size: 10 },
                gridcolor: 'rgba(0,0,0,0.05)'
            },
            yaxis: {
                tickfont: { family: "'Georgia', serif", size: 11 },
                automargin: true
            },
            height: 260,
            margin: { l: 90, r: 15, t: 25, b: 45 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            legend: {
                orientation: 'h',
                y: -0.22,
                x: 0.5,
                xanchor: 'center',
                font: { family: "'Georgia', serif", size: 9 }
            },
            hoverlabel: { bgcolor: '#fff', font: { family: "'Georgia', serif", size: 10 } }
        };

        // Only plot if we have common artists
        if (artistOverlap.length > 0) {
            Plotly.newPlot(artistHistRef.current, traces, artistLayout, { responsive: true });
        } else {
            console.log("No common artists to plot");
        }
    }, [selectedPlaylists, playlistData]);

    // Genre Comparison Chart
    React.useEffect(() => {
        if (selectedPlaylists.length !== 2) return;
        if (!genreHistRef.current) return;

        const playlist1 = playlistData.find(p => p.playlist_name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.playlist_name === selectedPlaylists[1]);

        // Get genres and exclude 'unknown'
        const genres1 = { ...(playlist1.genres || {}) };
        const genres2 = { ...(playlist2.genres || {}) };
        delete genres1['unknown'];
        delete genres2['unknown'];
        
        // Get all unique genres and sort by total count
        const allGenres = [...new Set([...Object.keys(genres1), ...Object.keys(genres2)])];
        const topGenres = allGenres
            .sort((a, b) => {
                const totalA = (genres1[a] || 0) + (genres2[a] || 0);
                const totalB = (genres1[b] || 0) + (genres2[b] || 0);
                return totalB - totalA;
            })
            .slice(0, 8); // Take top 8 genres

        // Find the maximum count for any genre to set the scale
        const maxCount = Math.max(
            ...topGenres.map(genre => Math.max(genres1[genre] || 0, genres2[genre] || 0))
        );
            
        const trace1 = {
            type: 'scatterpolar',
            r: topGenres.map(genre => genres1[genre] || 0),
            theta: topGenres,
            name: playlist1.playlist_name,
            fill: 'toself',
            fillcolor: 'rgba(74, 144, 164, 0.15)',
            line: { color: '#4A90A4', width: 2 },
            marker: { size: 6, color: '#4A90A4' },
            hovertemplate: '<b>%{theta}</b><br>%{r} tracks<extra></extra>'
        };

        const trace2 = {
            type: 'scatterpolar',
            r: topGenres.map(genre => genres2[genre] || 0),
            theta: topGenres,
            name: playlist2.playlist_name,
            fill: 'toself',
            fillcolor: 'rgba(91, 140, 90, 0.15)',
            line: { color: '#5B8C5A', width: 2 },
            marker: { size: 6, color: '#5B8C5A' },
            hovertemplate: '<b>%{theta}</b><br>%{r} tracks<extra></extra>'
        };

        const layout = {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, maxCount],
                    tickfont: { family: "'Georgia', serif", size: 10, color: '#888' },
                    gridcolor: 'rgba(0,0,0,0.08)'
                },
                angularaxis: {
                    tickfont: { family: "'Georgia', serif", size: 11 },
                    gridcolor: 'rgba(0,0,0,0.08)'
                },
                bgcolor: 'transparent'
            },
            showlegend: true,
            title: {
                text: 'Genre Fingerprint',
                font: { family: "'Georgia', serif", size: 14, color: '#333' },
                x: 0.5,
                xanchor: 'center'
            },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            height: 270,
            margin: { t: 40, b: 40, l: 40, r: 40 },
            legend: {
                orientation: 'h',
                y: -0.1,
                x: 0.5,
                xanchor: 'center',
                font: { family: "'Georgia', serif", size: 11 }
            }
        };

        Plotly.newPlot(genreHistRef.current, [trace1, trace2], layout, { responsive: true });
    }, [selectedPlaylists, playlistData]);


    // Check if user is logged in (has username and year selected)
    const isLoggedIn = window.currentUsername && window.selectedYear && window.selectedYear !== 'None';

    // Show loading screen for logged-in users waiting for data
    if (playlistData.length === 0 && isLoggedIn) {
        return React.createElement('div', {
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#F2F0ED',
                padding: '40px'
            }
        }, [
            React.createElement('style', null, `
                @keyframes orbit {
                    from { transform: rotate(0deg) translateX(40px) rotate(0deg); }
                    to { transform: rotate(360deg) translateX(40px) rotate(-360deg); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
            `),
            // Orbiting animation
            React.createElement('div', {
                style: {
                    position: 'relative',
                    width: '100px',
                    height: '100px',
                    marginBottom: '40px'
                }
            }, [
                React.createElement('div', {
                    style: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#633514'
                    }
                }),
                React.createElement('div', {
                    style: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#c9b687',
                        animation: 'orbit 2s linear infinite'
                    }
                }),
                React.createElement('div', {
                    style: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#597b8c',
                        animation: 'orbit 3s linear infinite reverse'
                    }
                })
            ]),
            React.createElement('h2', {
                style: {
                    fontFamily: "'Georgia', serif",
                    fontSize: '26px',
                    color: '#633514',
                    marginBottom: '15px',
                    fontWeight: 'normal',
                    animation: 'float 2s ease-in-out infinite'
                }
            }, 'Building your musical universe'),
            React.createElement('p', {
                style: {
                    fontFamily: "'Georgia', serif",
                    fontSize: '16px',
                    color: '#8b7355',
                    fontStyle: 'italic'
                }
            }, `Loading ${window.selectedYear} wrapped playlists...`)
        ]);
    }

    // Show welcome screen for non-logged-in users
    if (playlistData.length === 0) {
        return React.createElement('div', {
            style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#F2F0ED',
                padding: '20px',
                gap: '20px'
            }
        }, [
            isInfoModalOpen && InfoModal(),
            // White frame with image - smaller size
            React.createElement('div', {
                style: {
                    padding: '8px',
                    backgroundColor: '#FFFFFF',
                    maxWidth: '500px',
                    width: '90%',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
            },
                React.createElement('img', {
                    src: '/static/images/welcome-img.png',
                    alt: 'Lake house with mountains',
                    style: {
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        maxHeight: '50vh',
                        objectFit: 'cover'
                    }
                })
            ),
            React.createElement('div', {
                style: {
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center'
                }
            }, [
                React.createElement('button', {
                    onClick: () => window.location.href = '/login',
                    style: {
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #000000',
                        padding: '4px 20px',
                        boxShadow: '2px 2px 0px #000000',
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        cursor: 'pointer',
                        minWidth: '120px',
                        textAlign: 'center',
                        position: 'relative',
                        top: '0',
                        left: '0',
                        transition: 'all 0.1s'
                    },
                    onMouseDown: (e) => {
                        e.target.style.boxShadow = '1px 1px 0px #000000';
                        e.target.style.top = '1px';
                        e.target.style.left = '1px';
                    },
                    onMouseUp: (e) => {
                        e.target.style.boxShadow = '2px 2px 0px #000000';
                        e.target.style.top = '0';
                        e.target.style.left = '0';
                    },
                    onMouseLeave: (e) => {
                        e.target.style.boxShadow = '2px 2px 0px #000000';
                        e.target.style.top = '0';
                        e.target.style.left = '0';
                    }
                }, 'Login with Spotify'),
                React.createElement('button', {
                    onClick: () => setIsInfoModalOpen(true),
                    style: {
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #633514',
                        padding: '4px 20px',
                        boxShadow: '2px 2px 0px #633514',
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        cursor: 'pointer',
                        minWidth: '120px',
                        textAlign: 'center',
                        position: 'relative',
                        top: '0',
                        left: '0',
                        transition: 'all 0.1s'
                    },
                    onMouseDown: (e) => {
                        e.target.style.boxShadow = '1px 1px 0px #633514';
                        e.target.style.top = '1px';
                        e.target.style.left = '1px';
                    },
                    onMouseUp: (e) => {
                        e.target.style.boxShadow = '2px 2px 0px #633514';
                        e.target.style.top = '0';
                        e.target.style.left = '0';
                    },
                    onMouseLeave: (e) => {
                        e.target.style.boxShadow = '2px 2px 0px #633514';
                        e.target.style.top = '0';
                        e.target.style.left = '0';
                    }
                }, 'How To Use')
            ])
        ]);
    }

    return React.createElement('div', {
        style: {
            padding: '20px',
            width: '100%',
            maxWidth: '100vw',
            boxSizing: 'border-box',
            margin: '0 auto',
            backgroundColor: '#F2F0ED',
            minHeight: '100vh',
            overflow: 'hidden'
        }
    }, [// Loading bar
        isLoading && React.createElement('div', {
            style: {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                zIndex: 1000
            }
        }, [
            React.createElement('div', {
                style: {
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#e5e5e5',
                    overflow: 'hidden'
                }
            }, [
                React.createElement('div', {
                    style: {
                        width: '30%',
                        height: '100%',
                        backgroundColor: '#633514',
                        animation: 'loading 1s infinite linear',
                        transform: 'translateX(-100%)'
                    }
                })
            ])
        ]),
    
        // Add style tags for animations
        React.createElement('style', null, `
            @keyframes loading {
                from { transform: translateX(-100%); }
                to { transform: translateX(400%); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.4; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            @keyframes orbit {
                from { transform: rotate(0deg) translateX(30px) rotate(0deg); }
                to { transform: rotate(360deg) translateX(30px) rotate(-360deg); }
            }
            .plot-container { transition: opacity 0.5s ease-in-out; }
            .playlist-item:hover { background-color: rgba(99, 53, 20, 0.08); }
            .focal-star { color: #f4b942; font-size: 16px; cursor: pointer; }
            .focal-star:hover { transform: scale(1.2); }
        `),

        // Floating Playlist Selection Panel (sidebar style)
        !isLoading && React.createElement('div', {
            style: {
                position: 'fixed',
                left: showPlaylistPanel ? '0' : '-280px',
                top: '80px',
                width: '280px',
                maxHeight: 'calc(100vh - 120px)',
                backgroundColor: '#fff',
                borderRadius: '0 12px 12px 0',
                boxShadow: '2px 0 20px rgba(0,0,0,0.1)',
                transition: 'left 0.3s ease',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column'
            }
        }, [
            // Toggle button (always visible, sticks out)
            React.createElement('div', {
                key: 'toggle',
                onClick: () => setShowPlaylistPanel(!showPlaylistPanel),
                style: {
                    position: 'absolute',
                    right: '-36px',
                    top: '10px',
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#fff',
                    borderRadius: '0 8px 8px 0',
                    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '14px'
                }
            }, showPlaylistPanel ? '◀' : '▶'),

            // Panel header
            React.createElement('div', {
                key: 'header',
                style: {
                    padding: '15px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }
            }, [
                React.createElement('span', {
                    key: 'title',
                    style: { fontFamily: "'Georgia', serif", fontSize: '14px', fontWeight: '600', color: '#333' }
                }, 'Playlists'),
                React.createElement('span', {
                    key: 'count',
                    style: { fontSize: '11px', color: '#888', backgroundColor: '#f0f0f0', padding: '2px 8px', borderRadius: '10px' }
                }, `${checkedPlaylists.size}/${playlistData.length}`)
            ]),

            // Quick actions
            React.createElement('div', {
                key: 'actions',
                style: { padding: '10px 15px', borderBottom: '1px solid #eee', display: 'flex', gap: '8px' }
            }, [
                React.createElement('button', {
                    key: 'all',
                    onClick: () => setCheckedPlaylists(new Set(playlistData.map(p => p.playlist_id))),
                    style: {
                        flex: 1, padding: '5px', fontSize: '11px', border: '1px solid #ddd',
                        borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer'
                    }
                }, 'All'),
                React.createElement('button', {
                    key: 'none',
                    onClick: () => setCheckedPlaylists(new Set()),
                    style: {
                        flex: 1, padding: '5px', fontSize: '11px', border: '1px solid #ddd',
                        borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer'
                    }
                }, 'None')
            ]),

            // Playlist list (scrollable)
            React.createElement('div', {
                key: 'list',
                style: { flex: 1, overflowY: 'auto', padding: '10px 0' }
            }, playlistData.map((playlist) =>
                React.createElement('div', {
                    key: playlist.playlist_id,
                    className: 'playlist-item',
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 15px',
                        gap: '8px',
                        cursor: 'pointer'
                    },
                    onClick: () => {
                        const newSet = new Set(checkedPlaylists);
                        if (newSet.has(playlist.playlist_id)) {
                            newSet.delete(playlist.playlist_id);
                        } else {
                            newSet.add(playlist.playlist_id);
                        }
                        setCheckedPlaylists(newSet);
                    }
                }, [
                    // Checkbox
                    React.createElement('input', {
                        key: 'cb',
                        type: 'checkbox',
                        checked: checkedPlaylists.has(playlist.playlist_id),
                        onChange: (e) => {
                            e.stopPropagation();
                            const newSet = new Set(checkedPlaylists);
                            if (e.target.checked) {
                                newSet.add(playlist.playlist_id);
                            } else {
                                newSet.delete(playlist.playlist_id);
                            }
                            setCheckedPlaylists(newSet);
                        },
                        style: { cursor: 'pointer', width: '14px', height: '14px', flexShrink: 0 }
                    }),
                    // Focal star
                    React.createElement('span', {
                        key: 'star',
                        onClick: (e) => { e.stopPropagation(); setFocalPlaylistId(playlist.playlist_id); },
                        style: {
                            color: '#f4b942',
                            fontSize: '14px',
                            cursor: 'pointer',
                            opacity: focalPlaylistId === playlist.playlist_id ? 1 : 0.25,
                            transition: 'opacity 0.2s, transform 0.2s',
                            flexShrink: 0
                        },
                        title: 'Set as focal playlist'
                    }, '★'),
                    // Playlist name
                    React.createElement('span', {
                        key: 'name',
                        style: {
                            fontFamily: "'Georgia', serif",
                            fontSize: '12px',
                            color: focalPlaylistId === playlist.playlist_id ? '#4A90A4' : '#444',
                            fontWeight: focalPlaylistId === playlist.playlist_id ? '600' : '400',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }
                    }, playlist.playlist_name)
                ])
            )),

            // Legend at bottom
            React.createElement('div', {
                key: 'legend',
                style: { padding: '10px 15px', borderTop: '1px solid #eee', fontSize: '10px', color: '#888' }
            }, '★ Click star to set focal point')
        ]),

        // Privacy settings button (top-right)
        !isLoading && React.createElement('button', {
            onClick: () => setShowPrivacyModal(true),
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '8px 16px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#633514',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }
        }, ['⚙', ' Privacy']),

        // Privacy Modal
        showPrivacyModal && React.createElement('div', {
            style: {
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            },
            onClick: () => setShowPrivacyModal(false)
        }, React.createElement('div', {
            style: {
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            },
            onClick: (e) => e.stopPropagation()
        }, [
            React.createElement('h2', {
                key: 'title',
                style: { margin: '0 0 20px', color: '#633514', fontFamily: "'Georgia', serif" }
            }, 'Privacy Settings'),

            React.createElement('div', {
                key: 'toggle-section',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '15px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }
            }, [
                React.createElement('span', { key: 'label' }, 'Allow anonymous data collection'),
                React.createElement('button', {
                    key: 'toggle',
                    onClick: () => {
                        const newValue = !dataCollectionEnabled;
                        setDataCollectionEnabled(newValue);
                        localStorage.setItem('multiwrapped_data_collection', newValue.toString());
                    },
                    style: {
                        width: '50px',
                        height: '26px',
                        borderRadius: '13px',
                        border: 'none',
                        backgroundColor: dataCollectionEnabled ? '#5B8C5A' : '#ccc',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 0.2s'
                    }
                }, React.createElement('span', {
                    style: {
                        position: 'absolute',
                        top: '3px',
                        left: dataCollectionEnabled ? '27px' : '3px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }
                }))
            ]),

            React.createElement('div', {
                key: 'info',
                style: { fontSize: '14px', lineHeight: '1.6', color: '#555' }
            }, [
                React.createElement('p', { key: 'note', style: { margin: '0 0 15px', padding: '10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '13px' } },
                    'This setting applies to future sessions. Data from your current session may have already been collected.'),

                React.createElement('h4', { key: 'h1', style: { color: '#633514', margin: '0 0 10px' } }, 'What data is collected?'),
                React.createElement('p', { key: 'p1', style: { margin: '0 0 15px' } },
                    'When enabled, we collect anonymized playlist statistics (average popularity, genre counts, release years) to help compare your music taste with others. Your Spotify username and playlist ID are stored to prevent duplicates.'),

                React.createElement('h4', { key: 'h2', style: { color: '#633514', margin: '0 0 10px' } }, 'How to delete existing data'),
                React.createElement('p', { key: 'p2', style: { margin: '0 0 15px' } },
                    'To request deletion of your previously submitted data, contact the app maintainer with your Spotify username.')
            ]),

            React.createElement('button', {
                key: 'close',
                onClick: () => setShowPrivacyModal(false),
                style: {
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#633514',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '10px'
                }
            }, 'Close')
        ])),

        React.createElement('div', {
            ref: plotRef,
            className: 'plot-container',
            style: {
                width: '100%',
                marginBottom: '30px',
                height: 'min(70vh, 600px)',
                minHeight: '400px',
                display: isLoading ? 'flex' : 'block',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fff',
                borderRadius: '12px',
                position: 'relative',
                boxShadow: isLoading ? 'none' : '0 4px 20px rgba(0, 0, 0, 0.08)',
                overflow: 'hidden'
            }
        }, isLoading ? [
            // Loading state - cosmic/space themed
            React.createElement('div', {
                style: {
                    textAlign: 'center',
                    padding: '40px'
                }
            }, [
                // Orbiting dots animation
                React.createElement('div', {
                    style: {
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 30px'
                    }
                }, [
                    // Center dot
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#633514'
                        }
                    }),
                    // Orbiting dot 1
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#c9b687',
                            animation: 'orbit 2s linear infinite'
                        }
                    }),
                    // Orbiting dot 2
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#597b8c',
                            animation: 'orbit 3s linear infinite reverse'
                        }
                    })
                ]),
                React.createElement('h3', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '22px',
                        marginBottom: '12px',
                        color: '#633514',
                        fontWeight: 'normal',
                        animation: 'float 2s ease-in-out infinite'
                    }
                }, 'Building your musical universe'),
                React.createElement('p', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '14px',
                        color: '#8b7355',
                        fontStyle: 'italic'
                    }
                }, 'Gathering playlists from across the cosmos...')
            ])
        ] : []),

        // Navigation buttons - Back to Journey and Logout
        React.createElement('div', {
            style: {
                textAlign: 'center',
                marginBottom: '20px',
                display: isLoading ? 'none' : 'flex',
                justifyContent: 'center',
                gap: '12px'
            }
        }, [
            React.createElement('button', {
                key: 'back-to-journey',
                onClick: () => {
                    window.location.href = '/journey';
                },
                style: {
                    backgroundColor: 'transparent',
                    border: '1px solid #633514',
                    padding: '8px 20px',
                    fontFamily: "'Georgia', serif",
                    fontSize: '13px',
                    color: '#633514',
                    cursor: 'pointer',
                    borderRadius: '20px',
                    transition: 'all 0.2s ease'
                },
                onMouseEnter: (e) => {
                    e.target.style.backgroundColor = '#633514';
                    e.target.style.color = '#fff';
                },
                onMouseLeave: (e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#633514';
                }
            }, '← Back to Journey'),
            React.createElement('button', {
                key: 'logout',
                onClick: () => {
                    window.location.href = '/logout';
                },
                style: {
                    backgroundColor: 'transparent',
                    border: '1px solid #997b66',
                    padding: '8px 20px',
                    fontFamily: "'Georgia', serif",
                    fontSize: '13px',
                    color: '#997b66',
                    cursor: 'pointer',
                    borderRadius: '20px',
                    transition: 'all 0.2s ease'
                },
                onMouseEnter: (e) => {
                    e.target.style.backgroundColor = '#997b66';
                    e.target.style.color = '#fff';
                },
                onMouseLeave: (e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#997b66';
                }
            }, 'Logout')
        ]),

        // Selection instruction
        selectedPlaylists.length < 2 && React.createElement('div', {
            style: {
                textAlign: 'center',
                marginBottom: '30px',
                padding: '16px 24px',
                backgroundColor: 'rgba(99, 53, 20, 0.08)',
                borderRadius: '8px',
                maxWidth: '400px',
                margin: '0 auto 30px'
            }
        }, [
            React.createElement('p', {
                style: {
                    fontFamily: "'Georgia', serif",
                    fontSize: '16px',
                    color: '#633514',
                    margin: 0
                }
            }, selectedPlaylists.length === 0
                ? 'Click on two playlists to compare them'
                : `Select one more playlist to compare with ${selectedPlaylists[0]}`)
        ]),

        // Comparison section
        selectedPlaylists.length === 2 && React.createElement('div', {
            style: {
                marginTop: '40px',
                padding: '30px',
                borderRadius: '12px',
                backgroundColor: '#fff',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                animation: 'fadeIn 0.5s ease-out'
            }
        }, [
            React.createElement('style', null, `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `),
            React.createElement('h2', {
                style: {
                    marginBottom: '30px',
                    textAlign: 'center',
                    fontFamily: "'Georgia', serif",
                    fontWeight: 400,
                    fontSize: '26px',
                    color: '#633514',
                    borderBottom: '2px solid #c9b687',
                    paddingBottom: '15px'
                }
            }, `${selectedPlaylists[0]} & ${selectedPlaylists[1]}`),

            // Summary cards
            (() => {
                const p1 = playlistData.find(p => p.playlist_name === selectedPlaylists[0]);
                const p2 = playlistData.find(p => p.playlist_name === selectedPlaylists[1]);
                if (!p1?.tracks || !p2?.tracks) return null;

                const getTrackId = t => `${t.name}___${t.artists.join(',')}`.toLowerCase();
                const tracks1 = new Set(p1.tracks.map(getTrackId));
                const tracks2 = new Set(p2.tracks.map(getTrackId));
                const sharedTrackIds = [...tracks1].filter(t => tracks2.has(t));
                const sharedTracks = sharedTrackIds.length;

                const artists1 = new Set(p1.tracks.flatMap(t => t.artists));
                const artists2 = new Set(p2.tracks.flatMap(t => t.artists));
                const sharedArtists = [...artists1].filter(a => artists2.has(a)).length;

                const avgPopDiff = Math.abs(p1.avgPopularity - p2.avgPopularity).toFixed(0);

                // Calculate similarity percentile - compare this pair to all other pairs
                const calcPairSimilarity = (pa, pb) => {
                    if (!pa?.tracks || !pb?.tracks) return 0;
                    const ta = new Set(pa.tracks.map(getTrackId));
                    const tb = new Set(pb.tracks.map(getTrackId));
                    const shared = [...ta].filter(t => tb.has(t)).length;
                    const artistsA = new Set(pa.tracks.flatMap(t => t.artists));
                    const artistsB = new Set(pb.tracks.flatMap(t => t.artists));
                    const sharedArt = [...artistsA].filter(a => artistsB.has(a)).length;
                    const popDiff = Math.abs(pa.avgPopularity - pb.avgPopularity);
                    const yearDiff = Math.abs(pa.avgYear - pb.avgYear);
                    // Combined score: shared tracks + artists, minus differences
                    return shared * 2 + sharedArt - popDiff * 0.1 - yearDiff * 0.05;
                };

                const currentPairScore = calcPairSimilarity(p1, p2);
                let lessSimCount = 0;
                let totalPairs = 0;
                for (let i = 0; i < playlistData.length; i++) {
                    for (let j = i + 1; j < playlistData.length; j++) {
                        const score = calcPairSimilarity(playlistData[i], playlistData[j]);
                        if (score < currentPairScore) lessSimCount++;
                        totalPairs++;
                    }
                }
                const percentile = totalPairs > 1 ? Math.round((lessSimCount / totalPairs) * 100) : 50;

                return React.createElement('div', {
                    style: {
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '20px',
                        marginBottom: '40px',
                        flexWrap: 'wrap'
                    }
                }, [
                    // Similarity percentile card
                    React.createElement('div', {
                        key: 'sim',
                        style: {
                            background: 'linear-gradient(135deg, #5B8C5A 0%, #4A7A49 100%)',
                            borderRadius: '12px',
                            padding: '20px 30px',
                            textAlign: 'center',
                            color: '#fff',
                            minWidth: '160px',
                            boxShadow: '0 4px 15px rgba(91, 140, 90, 0.3)'
                        }
                    }, [
                        React.createElement('div', {
                            style: { fontSize: '32px', fontWeight: 'bold', fontFamily: "'Georgia', serif" }
                        }, `Top ${100 - percentile}%`),
                        React.createElement('div', {
                            style: { fontSize: '12px', opacity: 0.9, marginTop: '5px', lineHeight: 1.3 }
                        }, `More similar than ${percentile}% of pairs`)
                    ]),
                    // Shared tracks card
                    React.createElement('div', {
                        key: 'tracks',
                        style: {
                            background: 'linear-gradient(135deg, #4A90A4 0%, #3A7A8F 100%)',
                            borderRadius: '12px',
                            padding: '20px 30px',
                            textAlign: 'center',
                            color: '#fff',
                            minWidth: '140px',
                            boxShadow: '0 4px 15px rgba(74, 144, 164, 0.3)'
                        }
                    }, [
                        React.createElement('div', {
                            style: { fontSize: '36px', fontWeight: 'bold', fontFamily: "'Georgia', serif" }
                        }, sharedTracks),
                        React.createElement('div', {
                            style: { fontSize: '13px', opacity: 0.9, marginTop: '5px' }
                        }, 'Shared Tracks')
                    ]),
                    // Shared artists card
                    React.createElement('div', {
                        key: 'artists',
                        style: {
                            background: 'linear-gradient(135deg, #8B7355 0%, #6B5545 100%)',
                            borderRadius: '12px',
                            padding: '20px 30px',
                            textAlign: 'center',
                            color: '#fff',
                            minWidth: '140px',
                            boxShadow: '0 4px 15px rgba(139, 115, 85, 0.3)'
                        }
                    }, [
                        React.createElement('div', {
                            style: { fontSize: '36px', fontWeight: 'bold', fontFamily: "'Georgia', serif" }
                        }, sharedArtists),
                        React.createElement('div', {
                            style: { fontSize: '13px', opacity: 0.9, marginTop: '5px' }
                        }, 'Common Artists')
                    ]),
                    // Popularity difference card
                    React.createElement('div', {
                        key: 'pop',
                        style: {
                            background: 'linear-gradient(135deg, #CC6B6B 0%, #B55A5A 100%)',
                            borderRadius: '12px',
                            padding: '20px 30px',
                            textAlign: 'center',
                            color: '#fff',
                            minWidth: '140px',
                            boxShadow: '0 4px 15px rgba(204, 107, 107, 0.3)'
                        }
                    }, [
                        React.createElement('div', {
                            style: { fontSize: '36px', fontWeight: 'bold', fontFamily: "'Georgia', serif" }
                        }, `±${avgPopDiff}`),
                        React.createElement('div', {
                            style: { fontSize: '13px', opacity: 0.9, marginTop: '5px' }
                        }, 'Popularity Gap')
                    ]),
                    // Top Shared Tracks Album Grid (inside the cards container)
                    sharedTracks > 0 && React.createElement('div', {
                        key: 'shared-tracks',
                        style: {
                            width: '100%',
                            marginTop: '20px',
                            textAlign: 'center'
                        }
                    }, [
                        React.createElement('h4', {
                            key: 'title',
                            style: {
                                fontFamily: "'Georgia', serif",
                                fontSize: '14px',
                                color: '#666',
                                marginBottom: '12px',
                                fontWeight: 400
                            }
                        }, 'Shared Tracks'),
                        React.createElement('div', {
                            key: 'grid',
                            style: {
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                            }
                        }, sharedTrackIds.slice(0, 8).map((trackId, idx) => {
                            const track = p1.tracks.find(t => getTrackId(t) === trackId);
                            if (!track) return null;
                            return React.createElement('div', {
                                key: idx,
                                style: {
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s'
                                },
                                onClick: () => window.open(`https://open.spotify.com/track/${track.id}`, '_blank'),
                                onMouseEnter: (e) => e.currentTarget.style.transform = 'scale(1.05)',
                                onMouseLeave: (e) => e.currentTarget.style.transform = 'scale(1)'
                            }, [
                                React.createElement('img', {
                                    key: 'img',
                                    src: track.album_image || '',
                                    alt: track.name,
                                    style: {
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '6px',
                                        objectFit: 'cover',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }
                                }),
                                React.createElement('div', {
                                    key: 'label',
                                    style: {
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                        borderRadius: '0 0 6px 6px',
                                        padding: '3px',
                                        fontSize: '8px',
                                        color: '#fff',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }
                                }, track.name)
                            ]);
                        }))
                    ])
                ]);
            })(),

            // Venn diagram
            React.createElement('div', {
                style: {
                    textAlign: 'center',
                    marginBottom: '40px',
                    padding: '20px',
                    backgroundColor: '#F2F0ED',
                    borderRadius: '8px'
                }
            }, [
                React.createElement('h3', {
                    style: {
                        marginBottom: '20px',
                        fontFamily: "'Georgia', serif",
                        fontWeight: 400,
                        fontSize: '20px',
                        textAlign: 'center',
                        color: '#633514',
                        letterSpacing: '0.5px'
                    }
                }, 'Track Overlap'),
                React.createElement('p', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        fontSize: '13px',
                        color: '#8b7355',
                        marginBottom: '15px',
                        fontStyle: 'italic'
                    }
                }, 'Click on any section to see the tracks'),
                React.createElement('div', {
                    ref: vennRef,
                    style: {
                        height: '300px',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center'
                    }
                })
            ]),

            // Track display panel
            React.createElement('div', {
                style: {
                    display: selectedSharedTracks.length > 0 ? 'block' : 'none',
                    backgroundColor: selectedSection === 'left' ? '#c9b687' : 
                                   selectedSection === 'right' ? '#633514' : 
                                   '#8b6349',  // intersection color
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }
            }, [
                React.createElement('h4', {
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '18px',
                        marginBottom: '15px',
                        color: '#fff'
                    }
                }, `${selectedSharedTracks.length} ${
                    selectedSection === 'intersection' ? 'Shared' : 
                    selectedSection === 'left' ? `${selectedPlaylists[0]} Only` :
                    `${selectedPlaylists[1]} Only`
                } Tracks`),
                ...selectedSharedTracks.map((track, index, array) => 
                    React.createElement('div', {
                        key: track.id,
                        style: {
                            padding: '12px',
                            borderBottom: index < array.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px'
                        }
                    }, [
                        React.createElement('img', {
                            src: track.album_image || defaultAlbumArt,
                            alt: `${track.name} album art`,
                            style: {
                                width: '50px',
                                height: '50px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                backgroundColor: '#eee'
                            },
                            onError: (e) => {
                                e.target.src = defaultAlbumArt;
                            }
                        }),
                        React.createElement('div', {
                            style: {
                                flex: 1,
                                color: '#fff'
                            }
                        }, [
                            React.createElement('div', {
                                style: {
                                    fontWeight: 500,
                                    marginBottom: '4px'
                                }
                            }, track.name),
                            React.createElement('div', {
                                style: {
                                    fontSize: '0.9em',
                                    opacity: 0.8
                                }
                            }, track.artists)
                        ]),
                        React.createElement('button', {
                            onClick: () => handlePlayPause(track),
                            style: {
                                padding: '8px',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: 'none',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff'
                            }
                        }, '▶️')
                    ])
                )
            ]),
            
            // Combined Timeline + Popularity chart
            React.createElement('div', {
                ref: yearHistRef,
                style: {
                    height: '360px',
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#F2F0ED',
                    borderRadius: '8px'
                }
            }),

            // Two-column layout for Artist and Genre charts
            React.createElement('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                    marginBottom: '20px'
                }
            }, [
                // Artist comparison
                React.createElement('div', {
                    ref: artistHistRef,
                    key: 'artist',
                    style: {
                        height: '300px',
                        padding: '15px',
                        backgroundColor: '#F2F0ED',
                        borderRadius: '8px'
                    }
                }),
                // Genre radar chart
                React.createElement('div', {
                    ref: genreHistRef,
                    key: 'genre',
                    style: {
                        height: '300px',
                        padding: '15px',
                        backgroundColor: '#F2F0ED',
                        borderRadius: '8px'
                    }
                })
            ])
        ])

    ]);
};