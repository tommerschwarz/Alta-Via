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
                }, 'Welcome to Alta Via'),

                React.createElement('p', {
                    style: {
                        fontFamily: "'Georgia', serif",
                        marginBottom: '15px',
                        lineHeight: '1.6'
                    }
                }, 'Alta Via is a tool that helps you dive into your Spotify Wrapped playlists.'),

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
                    name: 'Alta Via Player',
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
                // New format - handle additional properties
                console.log("Received new API response format");
                console.log("API provided user_playlist_id:", data.user_playlist_id);
                
                // Update the window object with these values in case they weren't set
                if (data.user_playlist_id) {
                    window.userPlaylistId = data.user_playlist_id;
                    console.log("Updated window.userPlaylistId from API:", window.userPlaylistId);
                }
                
                // Set total first
                setTotalPlaylists(data.playlists.length);
                
                // Function to add playlists with a delay
                const addPlaylist = (index) => {
                    if (index >= data.playlists.length) {
                        setIsLoading(false);
                        return;
                    }
                    
                    // Force a state update for each playlist
                    setPlaylistData(prevData => {
                        const newData = [...prevData, data.playlists[index]];
                        console.log(`Loaded ${newData.length} of ${data.playlists.length} playlists`);
                        return newData;
                    });
                    
                    setTimeout(() => addPlaylist(index + 1), 100);
                };
                
                // Start adding playlists
                setTimeout(() => addPlaylist(0), 100);
            } else if (Array.isArray(data) && data.length > 0) {
                // Old format - just an array of playlists
                console.log("Received old API response format (array of playlists)");
                
                // Set total first
                setTotalPlaylists(data.length);
                
                // Function to add playlists with a delay
                const addPlaylist = (index) => {
                    if (index >= data.length) {
                        setIsLoading(false);
                        return;
                    }
                    
                    // Force a state update for each playlist
                    setPlaylistData(prevData => {
                        const newData = [...prevData, data[index]];
                        console.log(`Loaded ${newData.length} of ${data.length} playlists`);
                        return newData;
                    });
                    
                    setTimeout(() => addPlaylist(index + 1), 100);
                };
                
                // Start adding playlists
                setTimeout(() => addPlaylist(0), 100);
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
        
        // Store current camera position if it exists
        const currentCamera = plotRef.current.layout?.scene?.camera;

        // Add diagnostic logging for all playlists
        console.log("All playlists data:", playlistData.map(p => ({
            name: p.name,
            playlist_name: p.playlist_name,
            avgYear: p.avgYear
        })));

    
        // Find user's selected year playlist
        const currentUsername = window.currentUsername || '';
        const selectedYear = window.selectedYear || '';

        console.log(`!!! currentUsername IS: ${currentUsername}`);
        console.log(`!!! userPlaylist IS: ${userPlaylist}`);

        // Find the user's playlist with clear logging
        const exactUserPlaylistName = `${currentUsername} in ${selectedYear}`;
        const userPlaylist = playlistData.find(p => p.name === exactUserPlaylistName);

        console.log(`!!! exactUserPlaylistName IS: ${exactUserPlaylistName}`);
        console.log(`!!! userPlaylist IS: ${userPlaylist}`);

        if (userPlaylist) {
            console.log(`Found user playlist: ${userPlaylist.name}`);
        } else {
            console.log(`No exact match found for "${exactUserPlaylistName}"`);
            // Log all playlist names for debugging
            console.log("Available playlists:", playlistData.map(p => p.name));
        }
                
        // If we have the user's playlist, calculate distances to all others
        let closestPlaylist = null;
        let farthestPlaylist = null;

        const playlistLabels = playlistData.map(p => {
            // For display purposes, prefer playlist_name which is the original name
            // This is the key fix - we need to generate consistent labels
            return p.playlist_name || p.name || 'Unnamed Playlist';
        });
        
        // In the second plot effect where distances are calculated
        if (userPlaylist && playlistData.length > 2) {
            // Make sure userPlaylist isn't included in distance calculations
            const playlistsToCompare = playlistData.filter(p => 
                p.name !== userPlaylist.name && 
                p.playlist_id !== userPlaylist.playlist_id
            );
            
            // Only proceed if we have playlists to compare
            if (playlistsToCompare.length > 0) {
                // Get the ranges for scaling
                const popularityValues = playlistData.map(p => p.avgPopularity);
                const genreValues = playlistData.map(p => p.genreCount);
                const yearValues = playlistData.map(p => p.avgYear);
                
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
        
        // Create the main data trace
        const dataSeries = {
            type: 'scatter3d',
            mode: 'markers+text',
            x: playlistData.map(p => p.avgPopularity),
            y: playlistData.map(p => p.genreCount),
            z: playlistData.map(p => p.avgYear),
            text: playlistLabels, // Use consistent labels for display
            textfont: {
                size: 14, 
                family: 'Inter, sans-serif',
                color: '#000000'
            },
            textposition: 'top',
            marker: {
                size: 15,
                color: playlistData.map((p, index) => {
                    // Get user playlist ID from window object or session
                    const userPlaylistId = window.userPlaylistId || '';
                    
                    // SPECIAL PLAYLIST CHECK - User's playlist
                    if (userPlaylistId && p.playlist_id === userPlaylistId) {
                        // Add a custom property to identify this as the user's playlist
                        playlistData[index].isUserPlaylist = true;
                        return '#cb6d51';  // Terra cotta for user's playlist
                    }
                    
                    // SPECIAL PLAYLIST CHECK - Closest playlist
                    if (closestPlaylist && p.playlist_id === closestPlaylist.playlist_id) {
                        // Add a custom property to identify this as the closest playlist
                        playlistData[index].isClosestPlaylist = true;
                        return '#597b8c';  // Teal for closest
                    }
                    
                    // SPECIAL PLAYLIST CHECK - Farthest playlist
                    if (farthestPlaylist && p.playlist_id === farthestPlaylist.playlist_id) {
                        // Add a custom property to identify this as the farthest playlist
                        playlistData[index].isFarthestPlaylist = true;
                        return '#d5d5ce';  // Light gray for farthest
                    }
                    
                    // If it's selected
                    if (selectedPlaylists.includes(playlistLabels[index])) {
                        return '#0f5c2e';  // Green for selected
                    }
                    
                    // Default color
                    return '#c9b687';  // Beige for other playlists
                }),
                opacity: 0.8
            },
            hoverinfo: 'text',
            hovertext: playlistData.map((p, index) => 
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
                name: 'Your Playlist', // Clear label that this is the user's playlist
                marker: { color: '#cb6d51', size: 10 },
                showlegend: true,
                hoverinfo: 'none'
            });
            
            if (closestPlaylist) {
                // Closest playlist legend
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers',
                    x: [null],
                    y: [null],
                    z: [null],
                    name: 'Most Similar Playlist',
                    marker: { color: '#597b8c', size: 10 },
                    showlegend: true,
                    hoverinfo: 'none'
                });
            }
            
            if (farthestPlaylist) {
                // Farthest playlist legend
                traces.push({
                    type: 'scatter3d',
                    mode: 'markers',
                    x: [null],
                    y: [null],
                    z: [null],
                    name: 'Most Different Playlist',
                    marker: { color: '#d5d5ce', size: 10 },
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
            height: 600,
            width: 1000,
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
                
                // If clicking a point in the main data series
                /*'''if (clickedPoint.curveNumber === 0) {
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
                }
                // If clicking on a legend item, find the corresponding playlist
                else if (clickedPoint.curveNumber > 0) {
                    // Legend items don't give us the text, so we need to determine which one was clicked
                    let targetPlaylist = null;
                    
                    if (clickedPoint.curveNumber === 1 && userPlaylist) {
                        // User's playlist legend was clicked
                        targetPlaylist = playlistLabels[playlistData.findIndex(p => p.playlist_id === userPlaylist.playlist_id)];
                        console.log("Your Playlist legend clicked:", targetPlaylist);
                    }
                    else if (clickedPoint.curveNumber === 2 && closestPlaylist) {
                        // Closest playlist legend was clicked
                        targetPlaylist = playlistLabels[playlistData.findIndex(p => p.playlist_id === closestPlaylist.playlist_id)];
                        console.log("Most Similar Playlist legend clicked:", targetPlaylist);
                    }
                    else if (clickedPoint.curveNumber === 3 && farthestPlaylist) {
                        // Farthest playlist legend was clicked
                        targetPlaylist = playlistLabels[playlistData.findIndex(p => p.playlist_id === farthestPlaylist.playlist_id)];
                        console.log("Most Different Playlist legend clicked:", targetPlaylist);
                    }
                    
                    if (targetPlaylist) {
                        const newSelection = selectedPlaylists.includes(targetPlaylist) 
                            ? selectedPlaylists.filter(p => p !== targetPlaylist)
                            : selectedPlaylists.length < 2 
                                ? [...selectedPlaylists, targetPlaylist]
                                : [selectedPlaylists[1], targetPlaylist];
                        
                        setSelectedPlaylists(newSelection);
                    }
                }'''/*/
            });
        });

        return () => {
            if (plotRef.current && plotRef.current.removeAllListeners) {
                plotRef.current.removeAllListeners('plotly_click');
            }
        };
    }, [playlistData, selectedPlaylists]);


    // New effect for histograms
    React.useEffect(() => {
        if (selectedPlaylists.length !== 2) return;
        if (!yearHistRef.current || !popularityHistRef.current) return;

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
        
        const yearTraces = [
            {
                type: 'bar',
                x: allDecades,
                y: allDecades.map(decade => decadeCounts1[decade] || 0),
                name: playlist1.playlist_name,
                marker: { color: '#633514' },
                width: 3
            },
            {
                type: 'bar',
                x: allDecades,
                y: allDecades.map(decade => decadeCounts2[decade] || 0),
                name: playlist2.playlist_name,
                marker: { color: '#c9b687' },
                width: 3
            }
        ];
    
        const yearLayout = {
            title: {
                text: 'Tracks by Decade',
                font: {
                    family: "'Georgia', serif",
                    size: 22,
                    color: '#5D4037', // Darker brown
                    weight: 400
                }
            },
            xaxis: { 
                title: {
                    text: 'Decade',
                    font: {
                        family: "'Georgia', serif",
                        size: 14
                    }
                },
                tickmode: 'array',
                ticktext: allDecades.map(d => `${d}s`),
                tickvals: allDecades,
                tickfont: {
                    family: "'Georgia', serif"
                }
            },
            yaxis: { 
                title: {
                    text: 'Number of Tracks',
                    font: {
                        family: "'Georgia', serif",
                        size: 14
                    }
                },
                tickfont: {
                    family: "'Georgia', serif"
                }
            },
            barmode: 'group',
            showlegend: true,
            height: 300,
            margin: { t: 50, r: 50, b: 40, l: 40 },
            paper_bgcolor: '#F2F0ED',
            plot_bgcolor: '#F2F0ED',
            hoverlabel: {
                namelength: -1,
                font: {
                    family: "'Georgia', serif"
                }
            },
            legend: {
                font: {
                    family: "'Georgia', serif"
                }
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
                text: 'Distribution of Track Popularity',
                font: {
                    family: "'Georgia', serif",
                    size: 22,
                    color: '#6D4C41', // Medium brown
                    weight: 400,
                    style: 'italic'
                }
            },
            xaxis: { 
                title: {
                    text: 'Popularity Score',
                    font: {
                        family: "'Georgia', serif",
                        size: 14
                    }
                },
                range: [0, 100],
                tickfont: {
                    family: "'Georgia', serif"
                },
                annotations: [{
                    text: '← More Obscure     More Popular →',
                    font: {
                        size: 12,
                        family: "'Georgia', serif"
                    },
                    showarrow: false,
                    yref: 'paper',
                    y: -0.2,
                    xref: 'paper',
                    x: 0.5,
                    yanchor: 'top'
                }]
            },
            yaxis: { 
                showticklabels: false,
                zeroline: false,
                showgrid: false,
                title: ''
            },
            showlegend: true,
            height: 300,
            margin: { t: 50, r: 20, b: 60, l: 20 },
            paper_bgcolor: '#F2F0ED',
            plot_bgcolor: '#F2F0ED',
            hoverlabel: {
                font: {
                    family: "'Georgia', serif"
                }
            },
            legend: {
                font: {
                    family: "'Georgia', serif"
                }
            }
        };
        
        const popularityTraces = [
            {
                type: 'scatter',
                x: kde1.x,
                y: kde1.y,
                name: playlist1.playlist_name,
                line: { color: '#633514', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(99, 53, 20, 0.2)',
                hovertemplate: 'Popularity: %{x}<br><extra></extra>'  // Only show x value on hover
            },
            {
                type: 'scatter',
                x: kde2.x,
                y: kde2.y,
                name: playlist2.playlist_name,
                line: { color: '#c9b687', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(201, 182, 135, 0.2)',
                hovertemplate: 'Popularity: %{x}<br><extra></extra>'  // Only show x value on hover
            }
        ];
    
        Plotly.newPlot(yearHistRef.current, yearTraces, yearLayout, { responsive: true });
        Plotly.newPlot(popularityHistRef.current, popularityTraces, popularityLayout, { responsive: true });
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

        // Prepare traces for Plotly
        const traces = [
            {
                x: artistOverlap.map(item => item.artist),
                y: artistOverlap.map(item => item.playlist1Tracks),
                name: playlist1.playlist_name,
                type: 'bar',
                marker: { color: '#633514' },
                hovertemplate: '%{y} tracks in ' + playlist1.playlist_name + '<extra></extra>'
            },
            {
                x: artistOverlap.map(item => item.artist),
                y: artistOverlap.map(item => item.playlist2Tracks),
                name: playlist2.playlist_name,
                type: 'bar',
                marker: { color: '#c9b687' },
                hovertemplate: '%{y} tracks in ' + playlist2.playlist_name + '<extra></extra>'
            }
        ];

        const artistLayout = {
            title: {
                text: 'Top Shared Artists',
                font: {
                    family: "'Georgia', serif",
                    size: 22,
                    color: '#6D4C41'
                }
            },
            xaxis: {
                title: {
                    text: 'Artists',
                    font: {
                        family: "'Georgia', serif",
                        size: 14
                    },
                    standoff: 40  // Add some space between title and axis
                },
                tickangle: -45,
                tickfont: {
                    family: "'Georgia', serif",
                    size: 11
                },
                automargin: true
            },
            yaxis: {
                title: {
                    text: 'Number of Tracks',
                    font: {
                        family: "'Georgia', serif",
                        size: 14
                    }
                },
                tickfont: {
                    family: "'Georgia', serif"
                }
            },
            barmode: 'group',
            height: 500,  // Increased height
            margin: { 
                b: 300,   // Increased bottom margin
                l: 50, 
                r: 50,
                t: 50 
            },
            paper_bgcolor: '#F2F0ED',
            plot_bgcolor: '#F2F0ED',
            legend: {
                font: {
                    family: "'Georgia', serif"
                }
            },
            hoverlabel: {
                bgcolor: '#FFF',
                bordercolor: '#633514',
                font: { family: "'Georgia', serif" },
                namelength: -1  // Show full playlist name in hover
            }
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
            fillcolor: 'rgba(99, 53, 20, 0.2)',
            line: { color: '#633514' },
            hovertemplate: '%{r} tracks in ' + playlist1.playlist_name + '<extra></extra>'
        };
        
        const trace2 = {
            type: 'scatterpolar',
            r: topGenres.map(genre => genres2[genre] || 0),
            theta: topGenres,
            name: playlist2.playlist_name,
            fill: 'toself',
            fillcolor: 'rgba(201, 182, 135, 0.2)',
            line: { color: '#c9b687' },
            hovertemplate: '%{r} tracks in ' + playlist2.playlist_name + '<extra></extra>'
        };

        const layout = {
            polar: {
                radialaxis: {
                    visible: true,
                    range: [0, maxCount],
                    tickfont: { family: "'Georgia', serif" }
                },
                angularaxis: {
                    tickfont: { family: "'Georgia', serif" }
                },
                bgcolor: '#F2F0ED'
            },
            showlegend: true,
            title: {
                text: 'Genre Distribution',
                font: {
                    family: "'Georgia', serif",
                    size: 22,
                    color: '#633514'
                }
            },
            paper_bgcolor: '#F2F0ED',
            plot_bgcolor: '#F2F0ED',
            height: 500,
            margin: { t: 50, b: 30, l: 50, r: 50 }
        };

        Plotly.newPlot(genreHistRef.current, [trace1, trace2], layout, { responsive: true });
    }, [selectedPlaylists, playlistData]);


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
                gap: '20px'  // Space between frame and button
            }
        }, [
            isInfoModalOpen && InfoModal(),
            // White frame with image
            React.createElement('div', {
                style: {
                    padding: '10px',
                    backgroundColor: '#FFFFFF',
                    maxWidth: '800px',
                    width: '100%'
                }
            },
                React.createElement('img', {
                    src: '/static/images/welcome-img.png',
                    alt: 'Lake house with mountains',
                    style: {
                        width: '100%',
                        height: 'auto',
                        display: 'block'
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
                // Login with Spotify button (existing code)
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

                // New "How It Works" button
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
                }, 'How It Works')
            ])
        ]);
    }

    return React.createElement('div', {
        style: {
            padding: '20px',
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: '#F2F0ED',
            minHeight: '100vh'  // Make sure it covers full viewport height
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
    
        // Add a style tag for the animation
        React.createElement('style', null, `
            @keyframes loading {
                from {
                    transform: translateX(-100%);
                }
                to {
                    transform: translateX(400%);
                }
            }
        `),
    
        React.createElement('div', {
            ref: plotRef,
            style: {
                width: '100%',
                marginBottom: '40px',
                height: '600px',  // Match your plot height
                display: isLoading ? 'flex' : 'block', // Change to block when not loading
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isLoading ? '#fff' : 'transparent',
                borderRadius: '8px',
                position: 'relative'  // Add this
            }
        }, isLoading ? [
            // Loading state content
            React.createElement('div', {
                style: {
                    textAlign: 'center'
                }
            }, [
                React.createElement('h3', {
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        marginBottom: '20px',
                        color: '#633514'
                    }
                }, 'Loading your playlists...'),
                React.createElement('div', {
                    style: {
                        fontSize: '24px',
                        color: '#633514',
                        fontWeight: 'bold',
                        marginBottom: '20px'
                    }
                }, `${playlistData.length} / ${totalPlaylists} playlists loaded`),
                React.createElement('div', {
                    style: {
                        width: '200px',
                        height: '4px',
                        backgroundColor: '#e5e5e5',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        margin: '0 auto'
                    }
                }, [
                    React.createElement('div', {
                        style: {
                            width: `${totalPlaylists ? (playlistData.length / totalPlaylists) * 100 : 0}%`,
                            height: '100%',
                            backgroundColor: '#633514',
                            transition: 'width 0.3s ease'
                        }
                    })
                ])
            ])
        ] : []),

        // Add the Back button here, AFTER the plotRef div
        React.createElement('div', {
            style: {
                textAlign: 'center',
                marginBottom: '30px',
                display: isLoading ? 'none' : 'block' // Only show when not loading
            }
        }, [
            React.createElement('button', {
                onClick: () => {
                    window.location.href = '/logout';
                },
                style: {
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #633514',
                    padding: '8px 15px',
                    boxShadow: '2px 2px 0px #633514',
                    fontFamily: "'Georgia', serif",
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: '140px',
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
            }, 'Back to Menu')
        ]),

        // Selection instruction
        selectedPlaylists.length < 2 && React.createElement('p', {
            style: { textAlign: 'center', marginBottom: '20px' }
        }, `Click to select ${2 - selectedPlaylists.length} more playlist${selectedPlaylists.length === 1 ? '' : 's'} to compare`),

        // Comparison section
        selectedPlaylists.length === 2 && React.createElement('div', {
            style: {
                marginTop: '40px',
                padding: '20px',
                border: '1px solid #E5E5E5',
                borderRadius: '8px',
                backgroundColor: '#F2F0ED'
            }
        }, [
            React.createElement('h2', {
                style: { 
                    marginBottom: '20px', 
                    textAlign: 'center',
                    fontFamily: "'Georgia', serif",
                    fontWeight: 500,
                    fontSize: '24px'
                }
            }, `${selectedPlaylists[0]} & ${selectedPlaylists[1]}`),
            
            // Venn diagram
            React.createElement('div', {
                style: { textAlign: 'center', marginBottom: '30px' }
            }, [React.createElement('h3', {
                style: { 
                    marginBottom: '20px',
                    fontFamily: "'Georgia', serif",
                    fontWeight: 400,
                    fontSize: '22px',
                    textAlign: 'center',
                    color: '#8B7D6B', // Muted brown
                    letterSpacing: '0.5px'
                }
            }, 'Track Overlap'),
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
            
            // Year histogram
            React.createElement('div', {
                ref: yearHistRef,
                style: { height: '300px', marginBottom: '30px' }
            }),
            
            // Popularity distribution
            React.createElement('div', {
                ref: popularityHistRef,
                style: { height: '300px', marginBottom: '30px' }
            }),

            // new genre histogram
            React.createElement('div', {
                ref: artistHistRef,
                style: { height: '300px', marginBottom: '30px' }
            }),

            // new genre histogram
            React.createElement('div', {
                ref: genreHistRef,
                style: { height: '300px', marginBottom: '30px' }
            })
        ])

    ]);
};