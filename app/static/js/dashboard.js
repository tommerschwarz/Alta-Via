const PlaylistDashboard = () => {    
    const [playlistData, setPlaylistData] = React.useState([
        {
            name: "tommertime in 2024",
            avgPopularity: 45,
            genreCount: 25,
            avgYear: 2020,
            trackCount: 100,
            artistCount: 65,
        },
        {
            name: "tommertime in 2021",
            avgPopularity: 52,
            genreCount: 18,
            avgYear: 2018,
            trackCount: 100,
            artistCount: 45,
        }
    ]);

    const [selectedPlaylists, setSelectedPlaylists] = React.useState([]);
    const plotRef = React.useRef(null);
    const yearHistRef = React.useRef(null);
    const popularityHistRef = React.useRef(null);
    const vennRef = React.useRef(null);

    
    
    // Remove one of the fetch effects and keep just this one
    React.useEffect(() => {
        console.log("Starting data fetch");
        fetch('/api/playlist-metrics', {
            credentials: 'include',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("Received data:", data);
            if (Array.isArray(data) && data.length > 0) {
                setPlaylistData(data);
            } else {
                console.warn("Received empty or invalid data");
            }
        })
        .catch(error => {
            console.error('Error fetching playlist data:', error);
        });
    }, []);

    // Update the plot effect
    // Update the plot effect
    React.useEffect(() => {
        if (!plotRef.current || !playlistData || playlistData.length === 0) return;
    
        // Wait for next tick to ensure DOM is ready
        setTimeout(() => {
            console.log("Creating plot with data:", playlistData);
    
            const trace = {
                type: 'scatter3d',
                mode: 'markers+text',
                x: playlistData.map(p => p.avgPopularity),
                y: playlistData.map(p => p.genreCount),
                z: playlistData.map(p => p.avgYear),
                //text: playlistData.map(p => p.name),
                text: "",
                hoverinfo: 'text',
                hovertext: playlistData.map(p => 
                    `<b>${p.name}</b><br>` +
                    `Popularity: ${p.avgPopularity}<br>` +
                    `Genres: ${p.genreCount}<br>` +
                    `Avg Year: ${p.avgYear}`
                ),
                marker: {
                    size: 15,
                    color: playlistData.map(p => 
                        selectedPlaylists.includes(p.name) ? '#0f5c2e' : '#c9b687'
                    ),
                    opacity: 0.8
                },
                textposition: 'top center'
            };
    
            const layout = {
                title: {
                    text: '',
                    font: {
                        family: 'Georgia, serif',
                        size: 24
                    }
                },
                scene: {
                    xaxis: {
                        title: {
                            text: 'Average Popularity',
                            font: {
                                family: 'Georgia, serif',
                                size: 14
                            }
                        },
                        tickfont: {
                            family: 'Georgia, serif'
                        },
                        range: [0, 100]
                    },
                    yaxis: {
                        title: {
                            text: 'Number of Genres',
                            font: {
                                family: 'Georgia, serif',
                                size: 14
                            }
                        },
                        tickfont: {
                            family: 'Georgia, serif'
                        },
                        autorange: true
                    },
                    zaxis: {
                        title: {
                            text: 'Average Year',
                            font: {
                                family: 'Georgia, serif',
                                size: 14
                            }
                        },
                        tickfont: {
                            family: 'Georgia, serif'
                        },
                        autorange: true
                    },
                    camera: {
                        eye: {x: 1.5, y: 1.5, z: 1.5}
                    }
                },
                margin: {
                    l: 0,
                    r: 0,
                    b: 0,
                    t: 30
                },
                showlegend: false,
                height: 600,
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
    
            // Purge any existing plot
            Plotly.purge(plotRef.current);
    
            // Create new plot
            Plotly.newPlot(plotRef.current, [trace], layout, config).then(() => {
                // Add click handler
                plotRef.current.on('plotly_click', (data) => {
                    const pointName = data.points[0].text;
                    setSelectedPlaylists(prev => {
                        if (prev.includes(pointName)) {
                            return prev.filter(p => p !== pointName);
                        }
                        if (prev.length < 2) {
                            return [...prev, pointName];
                        }
                        return [prev[1], pointName];
                    });
                });
    
                // Add animation
                let angle = 0;
                const radius = 2;
                const speed = 0.002;
                let animationFrame;
                
                function rotate() {
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    
                    Plotly.relayout(plotRef.current, {
                        'scene.camera': {
                            eye: {
                                x: x,
                                y: y,
                                z: 1.5
                            },
                            center: {x: 0, y: 0, z: 0}
                        }
                    });
                    
                    angle += speed;
                    animationFrame = requestAnimationFrame(rotate);
                }
    
                // Start rotation
                animationFrame = requestAnimationFrame(rotate);
    
                // Stop animation on interaction
                plotRef.current.on('plotly_afterplot', () => {
                    if (animationFrame) {
                        cancelAnimationFrame(animationFrame);
                    }
                });
            });
    
            return () => {
                if (plotRef.current) {
                    Plotly.purge(plotRef.current);
                }
            };
        }, 0);
    }, [playlistData, selectedPlaylists]);
    
    // New effect for histograms
    React.useEffect(() => {
        if (selectedPlaylists.length !== 2) return;
        if (!yearHistRef.current || !popularityHistRef.current) return;

        const playlist1 = playlistData.find(p => p.name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.name === selectedPlaylists[1]);

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
                name: playlist1.name,
                marker: { color: '#633514' },
                width: 3
            },
            {
                type: 'bar',
                x: allDecades,
                y: allDecades.map(decade => decadeCounts2[decade] || 0),
                name: playlist2.name,
                marker: { color: '#c9b687' },
                width: 3
            }
        ];
    
        const yearLayout = {
            title: 'Tracks by Decade',
            xaxis: { 
                title: 'Decade',
                tickmode: 'array',
                ticktext: allDecades.map(d => `${d}s`),
                tickvals: allDecades
            },
            yaxis: { title: 'Number of Tracks' },
            barmode: 'group',
            showlegend: true,
            height: 300,
            margin: { t: 50, r: 20, b: 40, l: 40 },
            paper_bgcolor: '#F2F0ED',  // Add this line
            plot_bgcolor: '#F2F0ED'
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
    
        const popularityTraces = [
            {
                type: 'scatter',
                x: kde1.x,
                y: kde1.y,
                name: playlist1.name,
                line: { color: '#633514', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(99, 53, 20, 0.2)'
            },
            {
                type: 'scatter',
                x: kde2.x,
                y: kde2.y,
                name: playlist2.name,
                line: { color: '#c9b687', width: 2 },
                fill: 'tozeroy',
                fillcolor: 'rgba(201, 182, 135, 0.2)'
            }
        ];
    
        const popularityLayout = {
            title: 'Distribution of Track Popularity',
            xaxis: { 
                title: 'Popularity Score',
                range: [0, 100]
            },
            yaxis: { 
                title: 'Density',
                zeroline: true
            },
            showlegend: true,
            height: 300,
            margin: { t: 50, r: 20, b: 40, l: 40 },
            paper_bgcolor: '#F2F0ED',  // Add this line
            plot_bgcolor: '#F2F0ED'
        };
    
        Plotly.newPlot(yearHistRef.current, yearTraces, yearLayout, { responsive: true });
        Plotly.newPlot(popularityHistRef.current, popularityTraces, popularityLayout, { responsive: true });
    }, [selectedPlaylists, playlistData]);

    // venn diagram
    // Add Venn diagram effect
    React.useEffect(() => {
        if (!selectedPlaylists || selectedPlaylists.length !== 2) return;
        if (!vennRef.current || !window.venn || !window.d3) return;

        const playlist1 = playlistData.find(p => p.name === selectedPlaylists[0]);
        const playlist2 = playlistData.find(p => p.name === selectedPlaylists[1]);

        console.log("Building Venn diagram for:", {
            playlist1: {
                name: playlist1?.name,
                tracksCount: playlist1?.tracks?.length,
                sampleTrack: playlist1?.tracks?.[0]
            },
            playlist2: {
                name: playlist2?.name,
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
    
        // Create sets of track IDs
        const tracks1 = new Set(playlist1.tracks.map(t => t.id));
        const tracks2 = new Set(playlist2.tracks.map(t => t.id));
    
        console.log("Track sets:", {
            tracks1Size: tracks1.size,
            tracks2Size: tracks2.size
        });
        
        // Calculate intersection
        const intersection = new Set(
            [...tracks1].filter(x => tracks2.has(x))
        );
    
        console.log("Intersection size:", intersection.size);
    
        // Map IDs to track objects for hover info
        const tracksMap1 = Object.fromEntries(playlist1.tracks.map(t => [t.id, t]));
        const tracksMap2 = Object.fromEntries(playlist2.tracks.map(t => [t.id, t]));
    
    
        // Prepare data for Venn diagram
        const sets = [
            {
                sets: [playlist1.name],
                size: tracks1.size,
                label: `${playlist1.name}\n(${tracks1.size} tracks)`
            },
            {
                sets: [playlist2.name],
                size: tracks2.size,
                label: `${playlist2.name}\n(${tracks2.size} tracks)`
            },
            {
                sets: [playlist1.name, playlist2.name],
                size: intersection.size,
                label: `${intersection.size} shared tracks`
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
                return d.sets[0] === playlist1.name ? "#c9b687" : "#633514";
            })
            .style("fill-opacity", 0.2)
            .style("stroke", function(d) {
                if (d.sets.length === 2) {  // Intersection
                    return "#633514";  // Brown for intersection
                }
                // Match stroke color to fill
                return d.sets[0] === playlist1.name ? "#c9b687" : "#633514";
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
                    const otherSet = pathData.sets[0] === playlist1.name ? tracks2 : tracks1;
                    const thisMap = pathData.sets[0] === playlist1.name ? tracksMap1 : tracksMap2;
                    
                    tracksToShow = Object.entries(thisMap)
                        .filter(([id]) => !otherSet.has(id))
                        .map(([_, track]) => ({
                            name: track.name,
                            artists: track.artists.join(', ')
                        }))
                        .slice(0, 5);
                } else {
                    // Intersection - show shared tracks
                    tracksToShow = [...intersection]
                        .map(id => ({
                            name: tracksMap1[id].name,
                            artists: tracksMap1[id].artists.join(', ')
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
    
    }, [selectedPlaylists, playlistData]);

    return React.createElement('div', {
        style: {
            padding: '20px',
            maxWidth: '1200px',
            margin: '0 auto',
            backgroundColor: '#F2F0ED',  // Anthropic's background color
            minHeight: '100vh'  // Make sure it covers full viewport height
        }
    }, [
        React.createElement('div', {
            ref: plotRef,
            style: {
                width: '100%',
                marginBottom: '40px'
            }
        }),

        // Selection instruction
        selectedPlaylists.length < 2 && React.createElement('p', {
            style: { textAlign: 'center', marginBottom: '20px' }
        }, `Click to select ${2 - selectedPlaylists.length} more playlist${selectedPlaylists.length === 1 ? '' : 's'} to compare`),

        // Comparison section
        selectedPlaylists.length === 2 && React.createElement('div', {
            style: {
                marginTop: '40px',
                padding: '20px',
                border: '1px solid #E5E5E5',  // Lighter border
                borderRadius: '8px',
                backgroundColor: '#F2F0ED'  // Match main background
            }
        }, [
            React.createElement('h2', {
                style: { marginBottom: '20px', 
                    textAlign: 'center',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '24px'}
            }, `Comparing "${selectedPlaylists[0]}" and "${selectedPlaylists[1]}"`),
            
            React.createElement('div', {
                ref: yearHistRef,
                style: { height: '300px', marginBottom: '30px' }
            }),
            
            React.createElement('div', {
                ref: popularityHistRef,
                style: { height: '300px', marginBottom: '30px' }
            }),
    
            // Add the Venn diagram
            React.createElement('div', {
                style: { textAlign: 'center', marginBottom: '30px' }
            }, [
                React.createElement('h3', {
                    style: { marginBottom: '20px',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: '24px' }
                }, 'Track Overlap'),  // Changed from 'Artist Overlap'
                React.createElement('div', {
                    ref: vennRef,
                    style: { 
                        height: '300px',
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center'
                    }
                })
            ])
        ])
    ]);
};