// album-library.js - Core functionality for Sonium's album library

class AlbumLibrary {
    constructor() {
        this.apiKey = 'YOUR_API_KEY'; // Replace with your actual API key
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
            
            // In a production environment, you'd make API calls to Spotify or MusicBrainz
            // Here's a simplified example using Spotify's API
            const newReleases = await this.fetchNewReleases();
            
            // Merge new releases with existing library
            this.mergeAlbums(newReleases);
            
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
    
    async fetchNewReleases() {
        // In a real implementation, this would call the Spotify API
        // For demo purposes, we'll simulate an API response
        
        // This would be replaced with actual API call:
        // const response = await fetch('https://api.spotify.com/v1/browse/new-releases', {
        //     headers: { 'Authorization': `Bearer ${this.apiKey}` }
        // });
        // return await response.json();
        
        // Simulated response for demo
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    albums: [
                        {
                            id: 'album1',
                            title: 'The New Beginning',
                            artist: 'Future Sound',
                            cover_url: '/images/placeholder-album.jpg',
                            release_date: '2025-05-01',
                            rating: 4.7
                        },
                        {
                            id: 'album2',
                            title: 'Electric Dreams',
                            artist: 'Synth Wave',
                            cover_url: '/images/placeholder-album.jpg',
                            release_date: '2025-04-28',
                            rating: 4.2
                        }
                        // More albums would be here
                    ]
                });
            }, 300); // Simulate network delay
        });
    }
    
    mergeAlbums(newData) {
        // Add new albums to our collection, avoiding duplicates
        const newAlbums = newData.albums || [];
        
        newAlbums.forEach(newAlbum => {
            const existingIndex = this.albums.findIndex(a => a.id === newAlbum.id);
            
            if (existingIndex >= 0) {
                // Update existing album
                this.albums[existingIndex] = {...this.albums[existingIndex], ...newAlbum};
            } else {
                // Add new album
                this.albums.push(newAlbum);
            }
        });
        
        // Sort albums by release date (newest first)
        this.albums.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
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
    
    showAlbumDetails(albumId) {
        // This would navigate to the album detail page
        console.log(`Show details for album: ${albumId}`);
        // In a real app:
        // window.location.href = `/album/${albumId}`;
        
        // For demo purposes:
        alert(`Viewing album details would navigate to a dedicated page in a full implementation.`);
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
        
        // Filter albums based on search query
        const results = this.albums.filter(album => {
            const titleMatch = album.title.toLowerCase().includes(query.toLowerCase());
            const artistMatch = album.artist.toLowerCase().includes(query.toLowerCase());
            return titleMatch || artistMatch;
        });
        
        // Render the filtered results
        this.renderAlbums(results);
    }
    
    // Additional methods for filtering, sorting, etc.
    filterByGenre(genreName) {
        // Implementation depends on how genres are stored
    }
    
    filterByYear(year) {
        const filtered = this.albums.filter(album => {
            const albumYear = new Date(album.release_date).getFullYear();
            return albumYear === year;
        });
        this.renderAlbums(filtered);
    }
    
    sortByRating(ascending = false) {
        const sorted = [...this.albums].sort((a, b) => {
            return ascending ? a.rating - b.rating : b.rating - a.rating;
        });
        this.renderAlbums(sorted);
    }
}

// Initialize the library when the page loads
document.addEventListener('DOMContentLoaded', function() {
    window.albumLibrary = new AlbumLibrary();
});