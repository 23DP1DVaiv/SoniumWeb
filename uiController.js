// uiController.js - Manages UI updates and interactions
export class UIController {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('album-modal');
    }
    
    initializeUI() {
        // Any initial UI setup can go here
        console.log('UI initialized');
    }
    
    updateUserDisplay(user) {
        if (!user) return;
        
        // Update username in the header
        const usernameElement = document.getElementById('username');
        usernameElement.textContent = user.username;
        
        // Update avatar if needed
        // const avatarElement = document.querySelector('.avatar');
        // avatarElement.src = user.avatarUrl;
    }
    
    displaySearchResults(results) {
        const resultsCount = document.getElementById('results-count');
        const resultsList = document.getElementById('search-results-list');
        
        // Update results count
        resultsCount.textContent = results.length;
        
        // Clear previous results
        resultsList.innerHTML = '';
        
        if (results.length === 0) {
            resultsList.innerHTML = '<p class="no-results">No albums found. Try another search.</p>';
            return;
        }
        
        // Create result items
        results.forEach(album => {
            const albumElement = this.createAlbumListItem(album);
            resultsList.appendChild(albumElement);
        });
    }
    
    createAlbumListItem(album) {
        const albumElement = document.createElement('div');
        albumElement.className = 'album-list-item';
        albumElement.dataset.albumId = album.id;
        
        const isInCollection = this.app.currentUser ? 
            this.app.ratingService.isAlbumInUserCollection(this.app.currentUser.id, album.id) : false;
        
        albumElement.innerHTML = `
            <div class="album-list-poster">
                <img src="${album.coverUrl}" alt="${