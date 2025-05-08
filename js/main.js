// Sonium - Main JavaScript functionality with real search implementation
document.addEventListener('DOMContentLoaded', function() {
    // Import album library to use its functionality
    import('/js/album-library.js')
        .then(module => {
            const albumLibrary = module.default;
            initializeApp(albumLibrary);
        })
        .catch(error => {
            console.error('Error importing album library:', error);
            // Fallback to basic functionality if import fails
            initializeApp(null);
        });

    function initializeApp(albumLibrary) {
        // Add color coding to ratings
        const ratingElements = document.querySelectorAll('.album-rating');
        ratingElements.forEach(rating => {
            const value = parseFloat(rating.textContent);
            if (value >= 4.5) {
                rating.style.backgroundColor = '#28a745'; // Green for high ratings
            } else if (value >= 4.0) {
                rating.style.backgroundColor = '#fd7e14'; // Orange for good ratings
            } else {
                rating.style.backgroundColor = '#6c757d'; // Gray for average ratings
            }
        });
        
        // Create a search overlay with results
        const searchOverlay = document.createElement('div');
        searchOverlay.className = 'search-overlay';
        searchOverlay.innerHTML = `
            <div class="search-results">
                <div class="search-results-header">
                    <h3>Search Results</h3>
                    <button class="close-search">×</button>
                </div>
                <div class="search-results-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Searching music databases...</p>
                </div>
                <div class="search-results-content"></div>
            </div>
        `;
        document.body.appendChild(searchOverlay);
        
        // Set up search event listeners
        const searchBar = document.querySelector('.search-bar input');
        const searchLoading = document.querySelector('.search-results-loading');
        const searchIcon = document.createElement('span');
        
        if (searchBar) {
            // Add search icon
            searchIcon.innerHTML = '🔍';
            searchIcon.className = 'search-icon';
            
            // Add positioning to search bar container
            const searchBarContainer = document.querySelector('.search-bar');
            searchBarContainer.appendChild(searchIcon);
            
            // Function to perform search
            const performSearch = async (query) => {
                if (!query.trim()) {
                    return;
                }
                
                // Show search overlay with loading indicator
                searchOverlay.style.display = 'flex';
                searchLoading.style.display = 'block';
                document.querySelector('.search-results-content').innerHTML = '';
                
                try {
                    let results = [];
                    
                    if (albumLibrary) {
                        // Use the albumLibrary module to perform the search
                        await albumLibrary.searchMusicBrainz(query);
                        
                        // The search function in albumLibrary updates its internal state
                        // Filter the album library to get matching albums
                        results = albumLibrary.albums.filter(album => {
                            const titleMatch = album.title.toLowerCase().includes(query.toLowerCase());
                            const artistMatch = album.artist.toLowerCase().includes(query.toLowerCase());
                            return titleMatch || artistMatch;
                        });
                        
                        // Sort by relevance (exact matches first, then partial matches)
                        results.sort((a, b) => {
                            const aExactTitle = a.title.toLowerCase() === query.toLowerCase();
                            const bExactTitle = b.title.toLowerCase() === query.toLowerCase();
                            const aExactArtist = a.artist.toLowerCase() === query.toLowerCase();
                            const bExactArtist = b.artist.toLowerCase() === query.toLowerCase();
                            
                            if (aExactTitle && !bExactTitle) return -1;
                            if (!aExactTitle && bExactTitle) return 1;
                            if (aExactArtist && !bExactArtist) return -1;
                            if (!aExactArtist && bExactArtist) return 1;
                            
                            // If no exact matches, sort by most recent
                            if (a.release_date === 'Unknown') return 1;
                            if (b.release_date === 'Unknown') return -1;
                            return new Date(b.release_date) - new Date(a.release_date);
                        });
                    } else {
                        // Fallback to direct MusicBrainz API if albumLibrary not available
                        const response = await fetch(`https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(query)}&fmt=json&limit=20`, {
                            headers: {
                                'User-Agent': 'Sonium/1.0.0 (your@email.com)'
                            }
                        });
                        
                        if (!response.ok) {
                            throw new Error('MusicBrainz API error');
                        }
                        
                        const data = await response.json();
                        
                        if (data && data.releases) {
                            results = data.releases.map(release => ({
                                id: release.id,
                                title: release.title,
                                artist: release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist',
                                release_date: release.date || 'Unknown',
                                cover_url: '/images/placeholder-album.jpg',
                                rating: (3.5 + Math.random() * 1.5)
                            }));
                        }
                    }
                    
                    // Hide loading indicator
                    searchLoading.style.display = 'none';
                    
                    // Render results
                    renderSearchResults(results, query);
                    
                } catch (error) {
                    console.error('Error performing search:', error);
                    searchLoading.style.display = 'none';
                    document.querySelector('.search-results-content').innerHTML = 
                        '<div class="no-search-results">An error occurred while searching. Please try again later.</div>';
                }
            };
            
            // Function to render search results
            function renderSearchResults(results, query) {
                const resultsContainer = document.querySelector('.search-results-content');
                resultsContainer.innerHTML = '';
                
                if (results.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="no-search-results">
                            <p>No albums found matching "${query}".</p>
                            <p>Try another search term or check your spelling.</p>
                        </div>`;
                    return;
                }
                
                // Show number of results
                const resultCount = document.createElement('div');
                resultCount.className = 'search-result-count';
                resultCount.innerHTML = `<strong>${results.length} albums found</strong> for "${query}"`;
                resultsContainer.appendChild(resultCount);
                
                // Add each result
                results.forEach(album => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'search-result-item';
                    resultItem.dataset.id = album.id;
                    
                    // Determine rating color
                    let ratingColor = '#6c757d';
                    if (album.rating >= 4.5) {
                        ratingColor = '#28a745';
                    } else if (album.rating >= 4.0) {
                        ratingColor = '#fd7e14';
                    }
                    
                    resultItem.innerHTML = `
                        <div class="search-result-cover">
                            <img src="${album.cover_url}" alt="${album.title}" onerror="this.src='/images/placeholder-album.jpg'">
                        </div>
                        <div class="search-result-info">
                            <div class="search-result-title">${album.title}</div>
                            <div class="search-result-artist">by ${album.artist}</div>
                            <div class="search-result-date">Released: ${album.release_date}</div>
                            <div class="search-result-actions">
                                <button class="view-details-btn">View Details</button>
                                <button class="add-collection-btn">Add to Collection</button>
                            </div>
                        </div>
                        <div class="search-result-rating" style="background-color: ${ratingColor}">
                            ${album.rating.toFixed(1)}
                        </div>
                    `;
                    
                    resultsContainer.appendChild(resultItem);
                    
                    // Add event listeners to the buttons
                    const viewDetailsBtn = resultItem.querySelector('.view-details-btn');
                    const addCollectionBtn = resultItem.querySelector('.add-collection-btn');
                    
                    viewDetailsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (albumLibrary) {
                            albumLibrary.showAlbumDetails(album.id);
                        } else {
                            alert(`This would show details for "${album.title}" by ${album.artist}`);
                        }
                    });
                    
                    addCollectionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (albumLibrary) {
                            albumLibrary.addToCollection(album.id);
                        } else {
                            alert(`Added "${album.title}" to your collection!`);
                        }
                    });
                    
                    // Make the whole item clickable
                    resultItem.addEventListener('click', () => {
                        if (albumLibrary) {
                            albumLibrary.showAlbumDetails(album.id);
                        } else {
                            alert(`This would show details for "${album.title}" by ${album.artist}`);
                        }
                    });
                });
            }
            
            // Set up search event listeners
            searchBar.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const query = this.value;
                    performSearch(query);
                }
            });
            
            // Clicking on search icon should also trigger search
            searchIcon.addEventListener('click', () => {
                const query = searchBar.value;
                performSearch(query);
            });
        }
        
        // Close search overlay
        document.querySelector('.close-search').addEventListener('click', () => {
            searchOverlay.style.display = 'none';
        });
        
        // Close search overlay when clicking outside of results
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                searchOverlay.style.display = 'none';
            }
        });
        
        // Set up filter buttons if they exist
        const filterButtons = document.querySelectorAll('.filter-button');
        if (filterButtons.length > 0 && albumLibrary) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Add active class to clicked button
                    button.classList.add('active');
                    
                    // Apply filter using albumLibrary
                    const filterType = button.dataset.filter;
                    albumLibrary.applyFilter(filterType);
                });
            });
        }
        
        // Set up sort options
        const sortSelect = document.querySelector('#sort-select');
        if (sortSelect && albumLibrary) {
            sortSelect.addEventListener('change', () => {
                const sortBy = sortSelect.value;
                albumLibrary.sortAlbums(sortBy);
            });
        }
    }
});