// album-library.js - Core functionality for Sonium's album library using MusicBrainz API

class AlbumLibrary {
    constructor() {
        this.appName = 'Sonium';
        this.appVersion = '1.0.0';
        this.contactEmail = 'your@email.com'; // Required by MusicBrainz
        this.musicBrainzApiBase = 'https://musicbrainz.org/ws/2';
        this.coverArtApiBase = 'https://coverartarchive.org';
        this.apiBase = '/api'; // Base URL for our own server API
        this.updateInterval = 24 * 60 * 60 * 1000; // Update daily (in milliseconds)
        this.albums = [];
        this.lastUpdated = null;
        
        // Initialize library when created
        this.init();
    }
    
    async init() {
        // Load albums from local storage first for immediate display
        this.loadFromLocalStorage();
        
        // Then check for updates from our own API which accesses the database
        await this.updateLibrary();
        
        // Set up automatic updates
        setInterval(() => this.updateLibrary(), this.updateInterval);
        
        // Set up event listeners for search and filters
        this.setupEventListeners();
    }
    
    loadFromLocalStorage() {
        const savedData = localStorage.getItem('sonium_album_library');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.albums = data.albums || [];
            this.lastUpdated = data.lastUpdated || null;
            
            // Render the albums immediately if we have them
            if (this.albums.length > 0) {
                this.renderAlbums(this.albums);
            }
        }
    }
    
    saveToLocalStorage() {
        const data = {
            albums: this.albums,
            lastUpdated: this.lastUpdated
        };
        localStorage.setItem('sonium_album_library', JSON.stringify(data));
    }
    
    async updateLibrary() {
        try {
            // Check if we need to update (based on last update time)
            const now = new Date();
            if (this.lastUpdated && (now - new Date(this.lastUpdated) < this.updateInterval)) {
                console.log('Library is up to date, skipping refresh');
                return;
            }
            
            console.log('Updating album library...');
            
            // Fetch new releases from our own API which accesses the database
            const newReleases = await this.fetchAlbumsFromDatabase();
            
            if (newReleases.length > 0) {
                // Replace the albums array with data from our database
                this.albums = newReleases;
                
                // Update timestamp and save to local storage
                this.lastUpdated = now.toISOString();
                this.saveToLocalStorage();
                
                // Update the UI
                this.renderAlbums(this.albums);
                
                console.log(`Library updated: ${this.albums.length} albums available`);
            } else {
                // If we couldn't get albums from our database, fall back to MusicBrainz
                const musicBrainzReleases = await this.fetchNewReleases();
                
                // Merge new releases with existing library
                await this.mergeAlbums(musicBrainzReleases);
                
                // Update timestamp and save to local storage
                this.lastUpdated = now.toISOString();
                this.saveToLocalStorage();
                
                // Update the UI
                this.renderAlbums(this.albums);
                
                console.log(`Library updated from MusicBrainz: ${this.albums.length} albums available`);
            }
        } catch (error) {
            console.error('Failed to update library:', error);
        }
    }
    
    async fetchAlbumsFromDatabase() {
        try {
            // Fetch albums from our server API which queries the database
            const response = await fetch(`${this.apiBase}/albums/recent`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const albums = await response.json();
            
            // Process albums to match our album structure
            return albums.map(album => ({
                id: album.mbid, // Use MusicBrainz ID for consistency
                title: album.title,
                artist: album.artist,
                artist_id: album.artist_mbid,
                cover_url: album.cover_image_url || '/images/placeholder-album.jpg',
                release_date: album.release_date || 'Unknown',
                rating: album.average_rating || (3.5 + Math.random() * 1.5), // Use rating from DB if available or generate
                db_id: album.id // Store the database ID as well
            }));
        } catch (error) {
            console.error('Error fetching albums from database:', error);
            return [];
        }
    }
    
    async musicBrainzRequest(endpoint, params = {}) {
        try {
            const url = new URL(`${this.musicBrainzApiBase}${endpoint}`);
            
            // Add format for JSON response
            url.searchParams.append('fmt', 'json');
            
            // Add other parameters
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': `${this.appName}/${this.appVersion} (${this.contactEmail})`
                }
            });
            
            if (!response.ok) {
                throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('MusicBrainz API error:', error);
            return null;
        }
    }
    
    async getCoverArtForRelease(mbid) {
        try {
            // First check if we have this cover in our database
            const response = await fetch(`${this.apiBase}/albums/cover/${mbid}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.cover_image_url) {
                    return data.cover_image_url;
                }
            }
            
            // If not in our database, try to get it from Cover Art Archive
            const coverResponse = await fetch(`${this.coverArtApiBase}/release/${mbid}`, {
                headers: {
                    'User-Agent': `${this.appName}/${this.appVersion} (${this.contactEmail})`
                }
            });
            
            if (!coverResponse.ok) {
                // Cover art might not be available for all releases
                return null;
            }
            
            const coverData = await coverResponse.json();
            
            // Return front image URL if available
            if (coverData && coverData.images && coverData.images.length > 0) {
                const frontImage = coverData.images.find(img => img.front) || coverData.images[0];
                return frontImage.image;
            }
            
            return null;
        } catch (error) {
            // Don't log error - many albums don't have cover art
            return null;
        }
    }
    
    async fetchNewReleases() {
        try {
            // Get releases from the past 3 months
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const dateStr = threeMonthsAgo.toISOString().split('T')[0];
            
            // MusicBrainz query for recent releases
            const query = `date:[${dateStr} TO *] AND status:official AND type:album`;
            
            const data = await this.musicBrainzRequest('/release', {
                query: query,
                limit: 50,
                offset: 0
            });
            
            if (!data || !data.releases) {
                console.error('Failed to get releases from MusicBrainz');
                return [];
            }
            
            // Process releases to match our album structure
            const processedReleases = await Promise.all(data.releases.map(async (release) => {
                // Get artist info
                const artistName = release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist';
                const artistId = release['artist-credit']?.[0]?.artist?.id;
                
                // Get cover art
                let coverUrl = await this.getCoverArtForRelease(release.id) || '/images/placeholder-album.jpg';
                
                // Generate a rating based on score (MusicBrainz doesn't have ratings)
                // So we'll generate something between 3.5 and 5.0
                const rating = (3.5 + Math.random() * 1.5);
                
                return {
                    id: release.id, // Use MusicBrainz ID
                    title: release.title,
                    artist: artistName,
                    artist_id: artistId,
                    cover_url: coverUrl,
                    release_date: release.date || 'Unknown',
                    rating: rating
                };
            }));
            
            return processedReleases;
        } catch (error) {
            console.error('Error fetching new releases:', error);
            return [];
        }
    }
    
    async mergeAlbums(newAlbums) {
        // Add new albums to our collection, avoiding duplicates
        for (const newAlbum of newAlbums) {
            const existingIndex = this.albums.findIndex(a => a.id === newAlbum.id);
            
            if (existingIndex >= 0) {
                // Update existing album
                this.albums[existingIndex] = {...this.albums[existingIndex], ...newAlbum};
            } else {
                // Add new album
                this.albums.push(newAlbum);
            }
        }
        
        // Sort albums by release date (newest first)
        this.albums.sort((a, b) => {
            // Handle 'Unknown' dates
            if (a.release_date === 'Unknown') return 1;
            if (b.release_date === 'Unknown') return -1;
            
            return new Date(b.release_date) - new Date(a.release_date);
        });
    }
    
    renderAlbums(albumsToRender) {
        const container = document.querySelector('.albums-grid');
        if (!container) return;
        
        // Clear the container first
        container.innerHTML = '';
        
        // Add each album to the grid
        albumsToRender.forEach(album => {
            const albumCard = this.createAlbumCard(album);
            container.appendChild(albumCard);
        });
    }
    
    createAlbumCard(album) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.dataset.id = album.id;
        
        // Handle cover image loading
        const coverUrl = album.cover_url || '/images/placeholder-album.jpg';
        
        card.innerHTML = `
            <div class="album-cover">
                <img src="${coverUrl}" alt="${album.title}" onerror="this.src='/images/placeholder-album.jpg'">
                <div class="album-rating">${album.rating.toFixed(1)}</div>
            </div>
            <div class="album-info">
                <div class="album-title">${album.title}</div>
                <div class="album-artist">${album.artist}</div>
            </div>
        `;
        
        // Add event listener to open album details
        card.addEventListener('click', () => this.showAlbumDetails(album.id));
        
        return card;
    }
    
    async showAlbumDetails(albumId) {
        console.log(`Show details for album: ${albumId}`);
        
        try {
            // First try to get album details from our own API/database
            const response = await fetch(`${this.apiBase}/albums/details/${albumId}`);
            
            if (response.ok) {
                const albumDetails = await response.json();
                
                // Display album details from our database
                this.displayAlbumDetails(albumDetails);
                return;
            }
            
            // If not in our database, fall back to MusicBrainz
            const albumDetails = await this.musicBrainzRequest(`/release/${albumId}`, {
                inc: 'recordings+artists+labels+url-rels+tags'
            });
            
            if (!albumDetails) {
                alert('Could not fetch album details from MusicBrainz.');
                return;
            }
            
            // In a real app, we would navigate to a detail page:
            // window.location.href = `/album/${albumId}`;
            
            // For demo purposes, show a dialog with album info
            const artistName = albumDetails['artist-credit']?.[0]?.artist?.name || 'Unknown Artist';
            const releaseDate = albumDetails.date || 'Unknown date';
            const label = albumDetails['label-info']?.[0]?.label?.name || 'Unknown label';
            
            // Get cover art URL (might be already cached in our list)
            const album = this.albums.find(a => a.id === albumId);
            const coverUrl = album?.cover_url || '/images/placeholder-album.jpg';
            
            // Get tags if available
            let tagsText = 'No tags available';
            if (albumDetails.tags && albumDetails.tags.length > 0) {
                tagsText = albumDetails.tags.map(tag => tag.name).join(', ');
            }
            
            // Get track listing
            let tracksText = 'No tracks available';
            if (albumDetails.media && albumDetails.media.length > 0) {
                const tracks = albumDetails.media.flatMap(medium => 
                    medium.tracks ? medium.tracks.map(track => `${track.position}. ${track.title}`) : []
                );
                
                if (tracks.length > 0) {
                    tracksText = tracks.join('\n');
                }
            }
            
            alert(`Album: ${albumDetails.title}\nArtist: ${artistName}\nRelease Date: ${releaseDate}\nLabel: ${label}\n\nTags: ${tagsText}\n\nTrack Listing:\n${tracksText}`);
            
        } catch (error) {
            console.error('Error fetching album details:', error);
            alert('Error loading album details. Please try again later.');
        }
    }
    
    displayAlbumDetails(albumDetails) {
        // Create a better formatted display for album details
        // This could be replaced with a modal or a dedicated page in a real app
        
        // Format tracks if available
        let tracksHtml = '<p>No tracks available</p>';
        if (albumDetails.tracks && albumDetails.tracks.length > 0) {
            tracksHtml = '<ol class="album-tracks">';
            albumDetails.tracks.forEach(track => {
                tracksHtml += `<li>${track.title}</li>`;
            });
            tracksHtml += '</ol>';
        }
        
        // Format genres if available
        const genresText = albumDetails.genres && albumDetails.genres.length > 0 
            ? albumDetails.genres.join(', ') 
            : 'No genres available';
        
        // Create modal content
        const modalHtml = `
            <div class="album-detail-modal">
                <div class="album-detail-header">
                    <img src="${albumDetails.cover_image_url || '/images/placeholder-album.jpg'}" 
                         alt="${albumDetails.title}" 
                         onerror="this.src='/images/placeholder-album.jpg'">
                    <div class="album-detail-info">
                        <h2>${albumDetails.title}</h2>
                        <h3>by ${albumDetails.artist}</h3>
                        <p>Released: ${albumDetails.release_date || 'Unknown'}</p>
                        <p>Label: ${albumDetails.label || 'Unknown'}</p>
                        <p>Genres: ${genresText}</p>
                        <div class="album-rating large">
                            ${(albumDetails.average_rating || 0).toFixed(1)}
                        </div>
                    </div>
                </div>
                <div class="album-detail-tracks">
                    <h3>Tracks</h3>
                    ${tracksHtml}
                </div>
            </div>
        `;
        
        // For now, just use an alert for simplicity
        // In a real app, this would be a modal or a new page
        alert(`Album: ${albumDetails.title}\nArtist: ${albumDetails.artist}\nRelease Date: ${albumDetails.release_date || 'Unknown'}\nLabel: ${albumDetails.label || 'Unknown'}\n\nGenres: ${genresText}\n\nRating: ${(albumDetails.average_rating || 0).toFixed(1)}/5.0`);
    }
    
    setupEventListeners() {
        // Set up search functionality
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent the default "demo" alert
                    this.handleSearch(e.target.value);
                }
            });
        }
        
        // Set up filter buttons if they exist
        const filterButtons = document.querySelectorAll('.filter-button');
        if (filterButtons.length > 0) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Add active class to clicked button
                    button.classList.add('active');
                    
                    // Apply filter
                    const filterType = button.dataset.filter;
                    this.applyFilter(filterType);
                });
            });
        }
        
        // Set up sort options
        const sortSelect = document.querySelector('#sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const sortBy = sortSelect.value;
                this.sortAlbums(sortBy);
            });
        }
    }
    
    handleSearch(query) {
        if (!query.trim()) {
            // If search is empty, show all albums
            this.renderAlbums(this.albums);
            return;
        }
        
        // First try to search our local album collection
        const localResults = this.albums.filter(album => {
            const titleMatch = album.title.toLowerCase().includes(query.toLowerCase());
            const artistMatch = album.artist.toLowerCase().includes(query.toLowerCase());
            return titleMatch || artistMatch;
        });
        
        if (localResults.length > 0) {
            // Use local results if available
            this.renderAlbums(localResults);
            return;
        }
        
        // If no local results, try to search via our own API
        this.searchAlbums(query);
    }
    
    async searchAlbums(query) {
        try {
            console.log(`Searching albums for: ${query}`);
            
            // Show loading state
            const container = document.querySelector('.albums-grid');
            if (container) {
                container.innerHTML = '<div class="loading">Searching for albums...</div>';
            }
            
            // First try our own database
            const response = await fetch(`${this.apiBase}/albums/search?query=${encodeURIComponent(query)}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data && data.length > 0) {
                    // Process the results
                    const searchResults = data.map(album => ({
                        id: album.mbid,
                        title: album.title,
                        artist: album.artist,
                        artist_id: album.artist_mbid,
                        cover_url: album.cover_image_url || '/images/placeholder-album.jpg',
                        release_date: album.release_date || 'Unknown',
                        rating: album.average_rating || (3.5 + Math.random() * 1.5),
                        db_id: album.id
                    }));
                    
                    // Display search results
                    this.renderAlbums(searchResults);
                    
                    // Add these albums to our library for local caching
                    await this.mergeAlbums(searchResults);
                    this.saveToLocalStorage();
                    
                    return;
                }
            }
            
            // If no results or API error, fall back to MusicBrainz
            await this.searchMusicBrainz(query);
            
        } catch (error) {
            console.error('Error searching albums:', error);
            
            // Fall back to MusicBrainz search
            await this.searchMusicBrainz(query);
        }
    }
    
    async searchMusicBrainz(query) {
        try {
            console.log(`Searching MusicBrainz for: ${query}`);
            
            // Show loading state
            const container = document.querySelector('.albums-grid');
            if (container) {
                container.innerHTML = '<div class="loading">Searching for albums...</div>';
            }
            
            // Perform search
            const data = await this.musicBrainzRequest('/release', {
                query: query,
                limit: 20
            });
            
            if (!data || !data.releases || data.releases.length === 0) {
                if (container) {
                    container.innerHTML = '<div class="no-results">No albums found. Try a different search.</div>';
                }
                return;
            }
            
            // Process search results
            const searchResults = await Promise.all(data.releases.map(async (release) => {
                // Get artist info
                const artistName = release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist';
                const artistId = release['artist-credit']?.[0]?.artist?.id;
                
                // Get cover art
                let coverUrl = await this.getCoverArtForRelease(release.id) || '/images/placeholder-album.jpg';
                
                // Generate a random rating (since MusicBrainz doesn't have ratings)
                const rating = (3.5 + Math.random() * 1.5);
                
                return {
                    id: release.id,
                    title: release.title,
                    artist: artistName,
                    artist_id: artistId,
                    cover_url: coverUrl,
                    release_date: release.date || 'Unknown',
                    rating: rating
                };
            }));
            
            // Display search results
            this.renderAlbums(searchResults);
            
            // Add these albums to our library
            await this.mergeAlbums(searchResults);
            this.saveToLocalStorage();
            
        } catch (error) {
            console.error('Error searching MusicBrainz:', error);
            
            const container = document.querySelector('.albums-grid');
            if (container) {
                container.innerHTML = '<div class="error">Error searching for albums. Please try again later.</div>';
            }
        }
    }
    
    applyFilter(filterType) {
        let filteredAlbums = [];
        
        switch (filterType) {
            case 'recent':
                // Show albums from the last month
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                
                filteredAlbums = this.albums.filter(album => {
                    if (album.release_date === 'Unknown') return false;
                    return new Date(album.release_date) >= oneMonthAgo;
                });
                break;
                
            case 'top-rated':
                // Show albums with rating >= 4.0
                filteredAlbums = this.albums.filter(album => album.rating >= 4.0);
                break;
                
            case 'favorites':
                // In a real app, this would check user's favorites
                // For demo, just show some random albums as favorites
                filteredAlbums = this.albums.filter(() => Math.random() > 0.7);
                break;
                
            default:
                // Default to all albums
                filteredAlbums = this.albums;
        }
        
        this.renderAlbums(filteredAlbums);
    }
    
    sortAlbums(sortBy) {
        let sortedAlbums = [...this.albums]; // Create a copy to sort
        
        switch (sortBy) {
            case 'date-desc':
                // Newest first
                sortedAlbums.sort((a, b) => {
                    if (a.release_date === 'Unknown') return 1;
                    if (b.release_date === 'Unknown') return -1;
                    return new Date(b.release_date) - new Date(a.release_date);
                });
                break;
                
            case 'date-asc':
                // Oldest first
                sortedAlbums.sort((a, b) => {
                    if (a.release_date === 'Unknown') return 1;
                    if (b.release_date === 'Unknown') return -1;
                    return new Date(a.release_date) - new Date(b.release_date);
                });
                break;
                
            case 'title':
                // Alphabetical by title
                sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
                break;
                
            case 'artist':
                // Alphabetical by artist
                sortedAlbums.sort((a, b) => a.artist.localeCompare(b.artist));
                break;
                
            case 'rating-desc':
                // Highest rated first
                sortedAlbums.sort((a, b) => b.rating - a.rating);
                break;
        }
        
        this.renderAlbums(sortedAlbums);
    }
    
    // Add album to user's collection
    addToCollection(albumId) {
        // In a real app, this would add to user's database
        // For demo purposes, just mark the album card
        const albumCard = document.querySelector(`.album-card[data-id="${albumId}"]`);
        if (albumCard) {
            albumCard.classList.add('in-collection');
            
            // Show feedback to user
            alert('Album added to your collection!');
        }
    }
    
    // Remove album from user's collection
    removeFromCollection(albumId) {
        // In a real app, this would remove from user's database
        const albumCard = document.querySelector(`.album-card[data-id="${albumId}"]`);
        if (albumCard) {
            albumCard.classList.remove('in-collection');
            
            // Show feedback to user
            alert('Album removed from your collection.');
        }
    }
    
    // Rate an album
    rateAlbum(albumId, rating) {
        // Find the album in our collection
        const albumIndex = this.albums.findIndex(a => a.id === albumId);
        if (albumIndex >= 0) {
            // Update the rating
            this.albums[albumIndex].rating = rating;
            
            // Update in local storage
            this.saveToLocalStorage();
            
            // Update the UI
            const ratingElement = document.querySelector(`.album-card[data-id="${albumId}"] .album-rating`);
            if (ratingElement) {
                ratingElement.textContent = rating.toFixed(1);
                
                // Update color based on rating
                if (rating >= 4.5) {
                    ratingElement.style.backgroundColor = '#28a745'; // Green for high ratings
                } else if (rating >= 4.0) {
                    ratingElement.style.backgroundColor = '#fd7e14'; // Orange for good ratings
                } else {
                    ratingElement.style.backgroundColor = '#6c757d'; // Gray for average ratings
                }
            }
        }
    }
}

// Initialize the album library when the script loads
const albumLibrary = new AlbumLibrary();

// Export for use in other modules
export default albumLibrary;