// Main app.js - Entry point
import { AlbumService } from './services/albumService.js';
import { RatingService } from './services/ratingService.js';
import { UserService } from './services/userService.js';
import { UIController } from './uiController.js/uiController.js';
import { Router } from './router.js';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

class App {
    constructor() {
        // Initialize services
        this.albumService = new AlbumService();
        this.ratingService = new RatingService();
        this.userService = new UserService();
        
        // Initialize UI controller
        this.ui = new UIController(this);
        
        // Current user
        this.currentUser = null;
        
        // Current selected album
        this.currentAlbum = null;
        
        // Router for navigation
        this.router = new Router();
    }
    
    async init() {
        // Load data
        await this.albumService.loadAlbums();
        await this.ratingService.loadRatings();
        
        // Check if user is logged in from local storage
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.ui.updateUserDisplay(this.currentUser);
            this.router.navigateTo('search');
        }
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.ui.initializeUI();
    }
    
    setupEventListeners() {
        // Login form submission
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username-input').value.trim();
            if (username) {
                this.handleLogin(username);
            }
        });
        
        // Navigation links
        document.getElementById('nav-home').addEventListener('click', (e) => {
            e.preventDefault();
            this.router.navigateTo('welcome');
        });
        
        document.getElementById('nav-search').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                this.router.navigateTo('search');
            } else {
                alert('Please log in first');
            }
        });
        
        document.getElementById('nav-collection').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                this.router.navigateTo('collection');
                this.loadUserCollection();
            } else {
                alert('Please log in first');
            }
        });
        
        document.getElementById('nav-top').addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                this.router.navigateTo('top');
                this.loadTopAlbums();
            } else {
                alert('Please log in first');
            }
        });
        
        // Search functionality
        document.getElementById('search-btn').addEventListener('click', () => {
            const query = document.getElementById('search-input').value.trim();
            if (query) {
                this.searchAlbums(query);
            }
        });
        
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = document.getElementById('search-input').value.trim();
                if (query) {
                    this.searchAlbums(query);
                }
            }
        });
        
        // Collection sort change
        document.getElementById('sort-select').addEventListener('change', () => {
            this.loadUserCollection();
        });
        
        // Decade filter for top albums
        document.getElementById('decade-select').addEventListener('change', () => {
            this.loadTopAlbums();
        });
        
        // Modal close button
        document.querySelector('.close-btn').addEventListener('click', () => {
            this.ui.closeAlbumModal();
        });
        
        // Mark as listened button
        document.getElementById('mark-listened-btn').addEventListener('click', () => {
            if (!this.currentAlbum) return;
            
            const albumId = this.currentAlbum.id;
            const isListened = this.ratingService.toggleListenedStatus(this.currentUser.id, albumId);
            
            // Update UI
            this.ui.updateListenedButton(isListened);
            this.loadUserCollection(); // Refresh collection stats
        });
        
        // Remove album button
        document.getElementById('remove-album-btn').addEventListener('click', () => {
            if (!this.currentAlbum) return;
            
            const albumId = this.currentAlbum.id;
            this.ratingService.removeAlbumFromCollection(this.currentUser.id, albumId);
            
            // Update UI
            this.ui.closeAlbumModal();
            this.loadUserCollection(); // Refresh collection
        });
        
        // Star rating functionality
        document.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', () => {
                if (!this.currentAlbum || !this.currentUser) return;
                
                const rating = parseInt(star.getAttribute('data-value'));
                this.ratingService.rateAlbum(this.currentUser.id, this.currentAlbum.id, rating);
                
                // Update UI
                this.ui.updateStarRating(rating);
                this.loadUserCollection(); // Refresh collection stats
            });
        });
    }
    
    handleLogin(username) {
        // Create user if doesn't exist
        const user = this.userService.getOrCreateUser(username);
        this.currentUser = user;
        
        // Save to local storage
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Update UI
        this.ui.updateUserDisplay(user);
        
        // Navigate to search page
        this.router.navigateTo('search');
    }
    
    searchAlbums(query) {
        const results = this.albumService.searchAlbums(query);
        this.ui.displaySearchResults(results);
    }
    
    loadUserCollection() {
        if (!this.currentUser) return;
        
        const sortOption = document.getElementById('sort-select').value;
        const collection = this.ratingService.getUserCollection(this.currentUser.id, sortOption);
        const stats = this.ratingService.getUserStats(this.currentUser.id);
        
        this.ui.displayUserCollection(collection, stats);
    }
    
    loadTopAlbums() {
        const decadeFilter = document.getElementById('decade-select').value;
        const topAlbums = this.ratingService.getTopAlbums(decadeFilter);
        
        this.ui.displayTopAlbums(topAlbums);
    }
    
    viewAlbumDetails(albumId) {
        const album = this.albumService.getAlbumById(albumId);
        if (!album) return;
        
        this.currentAlbum = album;
        
        const userRating = this.currentUser ? 
            this.ratingService.getUserRatingForAlbum(this.currentUser.id, albumId) : null;
        
        const isInCollection = this.currentUser ? 
            this.ratingService.isAlbumInUserCollection(this.currentUser.id, albumId) : false;
            
        const isListened = this.currentUser ?
            this.ratingService.isAlbumListened(this.currentUser.id, albumId) : false;
            
        const avgRating = this.ratingService.getAverageRatingForAlbum(albumId);
        const numRatings = this.ratingService.getNumberOfRatingsForAlbum(albumId);
        
        this.ui.openAlbumModal(album, userRating, isInCollection, isListened, avgRating, numRatings);
    }
    
    addAlbumToCollection(albumId) {
        if (!this.currentUser) return false;
        
        const success = this.ratingService.addAlbumToCollection(this.currentUser.id, albumId);
        if (success) {
            this.loadUserCollection(); // Refresh collection
        }
        return success;
    }
}