// Sonium - Main JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Search functionality implementation
    const searchBar = document.querySelector('.search-bar input');
    const albumCards = document.querySelectorAll('.album-card');
    const noResultsMessage = document.createElement('div');
    noResultsMessage.className = 'no-results';
    noResultsMessage.textContent = 'No albums found matching your search.';
    noResultsMessage.style.display = 'none';
    noResultsMessage.style.textAlign = 'center';
    noResultsMessage.style.padding = '20px';
    noResultsMessage.style.width = '100%';
    document.querySelector('.albums-grid').after(noResultsMessage);
    
    // Create a search overlay with results
    const searchOverlay = document.createElement('div');
    searchOverlay.className = 'search-overlay';
    searchOverlay.innerHTML = `
        <div class="search-results">
            <div class="search-results-header">
                <h3>Search Results</h3>
                <button class="close-search">×</button>
            </div>
            <div class="search-results-content"></div>
        </div>
    `;
    document.body.appendChild(searchOverlay);
    
    // Add styles for search overlay
    const style = document.createElement('style');
    style.textContent = `
        .search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
            z-index: 1000;
            display: none;
            justify-content: center;
            align-items: flex-start;
            padding-top: 80px;
            overflow-y: auto;
        }
        .search-results {
            background: white;
            width: 80%;
            max-width: 800px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            max-height: 80vh;
            overflow-y: auto;
        }
        .search-results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
        }
        .search-results-header h3 {
            margin: 0;
        }
        .close-search {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #333;
        }
        .search-results-content {
            padding: 20px;
        }
        .search-result-item {
            display: flex;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        .search-result-item:last-child {
            border-bottom: none;
        }
        .search-result-cover {
            width: 80px;
            height: 80px;
            margin-right: 15px;
        }
        .search-result-cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .search-result-info {
            flex-grow: 1;
        }
        .search-result-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .search-result-artist {
            color: #666;
            font-size: 14px;
        }
        .search-result-rating {
            min-width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            color: white;
            font-weight: bold;
        }
        .no-search-results {
            text-align: center;
            padding: 30px;
            color: #666;
        }
    `;
    document.head.appendChild(style);
    
    // Sample album database (in a real app, this would come from a server)
    const albumsDatabase = [
        {
            title: "Dawn FM",
            artist: "The Weeknd",
            rating: 4.5,
            cover: "/api/placeholder/350/350",
            genre: "R&B, Pop"
        },
        {
            title: "Blue",
            artist: "Joni Mitchell",
            rating: 4.8,
            cover: "/api/placeholder/350/350",
            genre: "Folk, Jazz"
        },
        {
            title: "The Dark Side of the Moon",
            artist: "Pink Floyd",
            rating: 4.3,
            cover: "/api/placeholder/350/350",
            genre: "Progressive Rock"
        },
        {
            title: "To Pimp a Butterfly",
            artist: "Kendrick Lamar",
            rating: 4.6,
            cover: "/api/placeholder/350/350",
            genre: "Hip-Hop, Jazz Rap"
        },
        {
            title: "Future Nostalgia",
            artist: "Dua Lipa",
            rating: 4.4,
            cover: "/api/placeholder/350/350",
            genre: "Pop, Disco"
        },
        {
            title: "Rumours",
            artist: "Fleetwood Mac",
            rating: 4.7,
            cover: "/api/placeholder/350/350",
            genre: "Rock, Pop Rock"
        },
        {
            title: "Utopia",
            artist: "Travis Scott",
            rating: 4.2,
            cover: "/api/placeholder/350/350",
            genre: "Hip-Hop, Trap"
        },
        {
            title: "The Rise and Fall",
            artist: "Zara Larsson",
            rating: 4.9,
            cover: "/api/placeholder/350/350",
            genre: "Pop"
        },
        {
            title: "Subtract",
            artist: "Ed Sheeran",
            rating: 4.1,
            cover: "/api/placeholder/350/350",
            genre: "Pop, Folk"
        },
        {
            title: "But Here We Are",
            artist: "Foo Fighters",
            rating: 4.3,
            cover: "/api/placeholder/350/350",
            genre: "Rock, Alternative"
        },
        {
            title: "Radical Optimism",
            artist: "Dua Lipa",
            rating: 4.0,
            cover: "/api/placeholder/350/350",
            genre: "Pop, Dance"
        },
        {
            title: "Hit Me Hard and Soft",
            artist: "Billie Eilish",
            rating: 4.5,
            cover: "/api/placeholder/350/350",
            genre: "Pop, Alternative"
        },
        {
            title: "The Slow Rush",
            artist: "Tame Impala",
            rating: 4.5,
            cover: "/api/placeholder/100/100",
            genre: "Psychedelic Pop, Alternative"
        },
        {
            title: "Renaissance",
            artist: "Beyoncé",
            rating: 5.0,
            cover: "/api/placeholder/100/100",
            genre: "R&B, Dance, Pop"
        },
        {
            title: "Kind of Blue",
            artist: "Miles Davis",
            rating: 4.9,
            cover: "/api/placeholder/100/100",
            genre: "Jazz"
        },
        {
            title: "Blonde",
            artist: "Frank Ocean",
            rating: 5.0,
            cover: "/api/placeholder/100/100",
            genre: "R&B, Alternative"
        },
        {
            title: "Symphony No. 9",
            artist: "Beethoven",
            rating: 4.8,
            cover: "/api/placeholder/100/100",
            genre: "Classical"
        }
    ];
    
    // Search function
    function performSearch(query) {
        if (!query.trim()) {
            return [];
        }
        
        query = query.toLowerCase().trim();
        return albumsDatabase.filter(album => {
            return album.title.toLowerCase().includes(query) || 
                   album.artist.toLowerCase().includes(query) ||
                   album.genre.toLowerCase().includes(query);
        });
    }
    
    // Render search results
    function renderSearchResults(results) {
        const resultsContainer = document.querySelector('.search-results-content');
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-search-results">No albums found matching your search.</div>';
            return;
        }
        
        results.forEach(album => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            // Determine rating color
            let ratingColor = '#6c757d';
            if (album.rating >= 4.5) {
                ratingColor = '#28a745';
            } else if (album.rating >= 4.0) {
                ratingColor = '#fd7e14';
            }
            
            resultItem.innerHTML = `
                <div class="search-result-cover">
                    <img src="${album.cover}" alt="${album.title}">
                </div>
                <div class="search-result-info">
                    <div class="search-result-title">${album.title}</div>
                    <div class="search-result-artist">${album.artist}</div>
                    <div class="search-result-genre">${album.genre}</div>
                </div>
                <div class="search-result-rating" style="background-color: ${ratingColor}">
                    ${album.rating}
                </div>
            `;
            
            resultsContainer.appendChild(resultItem);
            
            // Make the result item clickable
            resultItem.style.cursor = 'pointer';
            resultItem.addEventListener('click', () => {
                alert(`You selected "${album.title}" by ${album.artist}. In a full implementation, this would take you to the album page.`);
            });
        });
    }
    
    // Set up search event listeners
    searchBar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value;
            const results = performSearch(query);
            renderSearchResults(results);
            searchOverlay.style.display = 'flex';
        }
    });
    
    // Clicking on search icon should also trigger search
    const searchIcon = document.createElement('span');
    searchIcon.innerHTML = '🔍';
    searchIcon.style.position = 'absolute';
    searchIcon.style.right = '10px';
    searchIcon.style.top = '50%';
    searchIcon.style.transform = 'translateY(-50%)';
    searchIcon.style.cursor = 'pointer';
    
    // Add positioning to search bar container
    const searchBarContainer = document.querySelector('.search-bar');
    searchBarContainer.style.position = 'relative';
    searchBarContainer.appendChild(searchIcon);
    
    searchIcon.addEventListener('click', () => {
        const query = searchBar.value;
        const results = performSearch(query);
        renderSearchResults(results);
        searchOverlay.style.display = 'flex';
    });
    
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
    
    // Make buttons show alerts for demonstration (keep original functionality)
    const buttons = document.querySelectorAll('button:not(.close-search)');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.textContent === 'Log In' || this.textContent === 'Sign Up') {
                alert('Authentication system would be implemented in a full version.');
            } else if (this.textContent === 'Start Your Collection') {
                alert('This would take users to an onboarding process to select favorite genres and artists.');
            } else if (this.textContent.includes('Like') || this.textContent.includes('Comment')) {
                alert('Social interaction features would be implemented in a full version.');
            }
        });
    });

    // Additional functionality can be added here as the application grows
});