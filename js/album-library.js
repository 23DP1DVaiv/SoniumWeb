// album-library.js - Core functionality for Sonium's album library using MusicBrainz API

class AlbumLibrary {
    constructor() {
        this.appName = 'Sonium';
        this.appVersion = '1.0.0';
        this.contactEmail = 'your@email.com'; // Required by MusicBrainz
        this.musicBrainzApiBase = 'https://musicbrainz.org/ws/2';
        this.coverArtApiBase = 'https://coverartarchive.org';
        this.updateInterval = 24 * 60 * 60 * 1000; // Update daily (in milliseconds)
        this.albums = [];
        this.lastUpdated = null;
        
        // Initialize library when created
        this.init();
    }
    
    async init() {
        // Load albums from local storage first for immediate display
        this.loadFromLocalStorage();
        
        // Then check for updates from API
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
            
            // Fetch new releases from MusicBrainz
            const newReleases = await this.fetchNewReleases();
            
            // Merge new releases with existing library
            await this.mergeAlbums(newReleases);
            
            // Update timestamp and save to local storage
            this.lastUpdated = now.toISOString();
            this.saveToLocalStorage();
            
            // Update the UI
            this.renderAlbums(this.albums);
            
            console.log(`Library updated: ${this.albums.length} albums available`);
        } catch (error) {
            console.error('Failed to update library:', error);
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
            const response = await fetch(`${this.coverArtApiBase}/release/${mbid}`, {
                headers: {
                    'User-Agent': `${this.appName}/${this.appVersion} (${this.contactEmail})`
                }
            });
            
            if (!response.ok) {
                // Cover art might not be available for all releases
                return null;
            }
            
            const data = await response.json();
            
            // Return front image URL if available
            if (data && data.images && data.images.length > 0) {
                const frontImage = data.images.find(img => img.front) || data.images[0];
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
        
        card.innerHTML = `
            <div class="album-cover">
                <img src="${album.cover_url}" alt="${album.title}">
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
            // Fetch detailed album information from MusicBrainz
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
        
        // Add more event listeners for filtering, sorting, etc.
    }
    
    handleSearch(query) {
        if (!query.trim()) {
            // If search is empty, show all albums
            this.renderAlbums(this.albums);
            return;
        }
        
        // First try local search
        const localResults = this.albums.filter(album => {
            const titleMatch = album.title.toLowerCase().includes(query.toLowerCase());
            const artistMatch = album.artist.toLowerCase().includes(query.toLowerCase());
            return titleMatch || artistMatch;
        });
        
        if (localResults.length > 0) {
            // Use local results if available