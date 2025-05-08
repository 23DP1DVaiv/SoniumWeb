// ratingService.js - Handles ratings, user collections, and related functionality
export class RatingService {
    constructor() {
        this.ratings = [];
        this.collections = {};
    }
    
    async loadRatings() {
        // In a real application, this would fetch from an API
        // For now, we'll use local storage for persistence
        try {
            // Try to load from localStorage
            const savedRatings = localStorage.getItem('sonium_ratings');
            const savedCollections = localStorage.getItem('sonium_collections');
            
            if (savedRatings) {
                this.ratings = JSON.parse(savedRatings);
            }
            
            if (savedCollections) {
                this.collections = JSON.parse(savedCollections);
            }
            
            console.log('Ratings loaded:', this.ratings.length);
            return true;
        } catch (error) {
            console.error('Error loading ratings:', error);
            return false;
        }
    }
    
    saveData() {
        // Save to localStorage
        localStorage.setItem('sonium_ratings', JSON.stringify(this.ratings));
        localStorage.setItem('sonium_collections', JSON.stringify(this.collections));
    }
    
    // Rating methods
    rateAlbum(userId, albumId, rating) {
        // Check if user has already rated this album
        const existingRating = this.ratings.find(r => 
            r.userId === userId && r.albumId === albumId
        );
        
        if (existingRating) {
            // Update existing rating
            existingRating.rating = rating;
            existingRating.updatedAt = new Date().toISOString();
        } else {
            // Add new rating
            this.ratings.push({
                id: Date.now().toString(),
                userId,
                albumId,
                rating,
                listened: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Also add to user's collection
            this.addAlbumToCollection(userId, albumId);
        }
        
        this.saveData();
        return true;
    }
    
    getUserRatingForAlbum(userId, albumId) {
        const rating = this.ratings.find(r => 
            r.userId === userId && r.albumId === albumId
        );
        
        return rating ? rating.rating : null;
    }
    
    getAverageRatingForAlbum(albumId) {
        const albumRatings = this.ratings.filter(r => r.albumId === albumId);
        
        if (albumRatings.length === 0) return 0;
        
        const sum = albumRatings.reduce((total, r) => total + r.rating, 0);
        return (sum / albumRatings.length).toFixed(1);
    }
    
    getNumberOfRatingsForAlbum(albumId) {
        return this.ratings.filter(r => r.albumId === albumId).length;
    }
    
    // Collection methods
    addAlbumToCollection(userId, albumId) {
        // Initialize collection if it doesn't exist
        if (!this.collections[userId]) {
            this.collections[userId] = [];
        }
        
        // Check if album is already in collection
        const existingEntry = this.collections[userId].find(e => e.albumId === albumId);
        
        if (!existingEntry) {
            this.collections[userId].push({
                albumId,
                addedAt: new Date().toISOString()
            });
            
            this.saveData();
            return true;
        }
        
        return false;
    }
    
    removeAlbumFromCollection(userId, albumId) {
        if (!this.collections[userId]) return false;
        
        // Remove from collection
        this.collections[userId] = this.collections[userId].filter(e => 
            e.albumId !== albumId
        );
        
        // Also remove any ratings
        this.ratings = this.ratings.filter(r => 
            !(r.userId === userId && r.albumId === albumId)
        );
        
        this.saveData();
        return true;
    }
    
    getUserCollection(userId, sortOption = 'date-desc') {
        if (!this.collections[userId] || this.collections[userId].length === 0) {
            return [];
        }
        
        // Get collection with user ratings
        const collection = this.collections[userId].map(entry => {
            const rating = this.ratings.find(r => 
                r.userId === userId && r.albumId === entry.albumId
            );
            
            return {
                albumId: entry.albumId,
                addedAt: entry.addedAt,
                rating: rating ? rating.rating : null,
                listened: rating ? rating.listened : false
            };
        });
        
        // Sort the collection based on selected option
        switch (sortOption) {
            case 'date-desc':
                return collection.sort((a, b) => 
                    new Date(b.addedAt) - new Date(a.addedAt)
                );
            case 'date-asc':
                return collection.sort((a, b) => 
                    new Date(a.addedAt) - new Date(b.addedAt)
                );
            case 'rating-desc':
                return collection.sort((a, b) => 
                    (b.rating || 0) - (a.rating || 0)
                );
            case 'rating-asc':
                return collection.sort((a, b) => 
                    (a.rating || 0) - (b.rating || 0)
                );
            default:
                return collection;
        }
    }
    
    isAlbumInUserCollection(userId, albumId) {
        if (!this.collections[userId]) return false;
        
        return this.collections[userId].some(e => e.albumId === albumId);
    }
    
    toggleListenedStatus(userId, albumId) {
        const rating = this.ratings.find(r => 
            r.userId === userId && r.albumId === albumId
        );
        
        if (rating) {
            // Toggle listened status
            rating.listened = !rating.listened;
            rating.updatedAt = new Date().toISOString();
            this.saveData();
            return rating.listened;
        } else {
            // If no rating exists yet, create one with listened status
            this.ratings.push({
                id: Date.now().toString(),
                userId,
                albumId,
                rating: null, // No rating yet
                listened: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Also add to collection
            this.addAlbumToCollection(userId, albumId);
            
            this.saveData();
            return true;
        }
    }
    
    isAlbumListened(userId, albumId) {
        const rating = this.ratings.find(r => 
            r.userId === userId && r.albumId === albumId
        );
        
        return rating ? rating.listened : false;
    }
    
    // Statistics and aggregated data
    getUserStats(userId) {
        const userRatings = this.ratings.filter(r => r.userId === userId);
        
        const albumsRated = userRatings.filter(r => r.rating !== null).length;
        
        const totalRating = userRatings.reduce((sum, r) => 
            r.rating ? sum + r.rating : sum, 0
        );
        
        const averageRating = albumsRated > 0 ? 
            (totalRating / albumsRated).toFixed(1) : '0.0';
        
        const albumsListened = userRatings.filter(r => r.listened).length;
        
        return {
            albumsRated,
            averageRating,
            albumsListened
        };
    }
    
    getTopAlbums(decadeFilter = 'all', limit = 10) {
        // Group ratings by album
        const albumRatings = {};
        
        this.ratings.forEach(rating => {
            if (!rating.rating) return; // Skip entries with no rating
            
            if (!albumRatings[rating.albumId]) {
                albumRatings[rating.albumId] = {
                    albumId: rating.albumId,
                    ratings: []
                };
            }
            
            albumRatings[rating.albumId].ratings.push(rating.rating);
        });
        
        // Calculate average ratings
        const albumsWithAverages = Object.values(albumRatings).map(entry => {
            const sum = entry.ratings.reduce((total, r) => total + r, 0);
            const average = sum / entry.ratings.length;
            
            return {
                albumId: entry.albumId,
                averageRating: average,
                numRatings: entry.ratings.length
            };
        });
        
        // Sort by average rating (descending)
        const sortedAlbums = albumsWithAverages.sort((a, b) => 
            b.averageRating - a.averageRating || b.numRatings - a.numRatings
        );
        
        // Apply decade filter (needs to be linked with AlbumService)
        // This will be applied in the UI controller
        
        // Return top albums
        return sortedAlbums.slice(0, limit);
    }
}