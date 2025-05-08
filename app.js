// Main app.js - Entry point
import { AlbumService } from './services/albumService.js';
import { RatingService } from './services/ratingService.js';
import { UserService } from './services/userService.js';
import { UIController } from './ui/uiController.js';
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