// music-api-integration.js - Integration with MusicBrainz API

class MusicBrainzAPI {
    constructor() {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        this.appName = 'Sonium';
        this.appVersion = '1.0.0';
        this.contactEmail = 'sonium.info@gmail.com';
    }

    // MusicBrainz API calls
    async makeRequest(endpoint, params = {}) {
        try {
            const url = new URL(`${this.baseUrl}${endpoint}`);
            
            // Add format for JSON response
            url.searchParams.append('fmt', 'json');
            
            // Add other parameters
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

            // MusicBrainz requires a user agent with app name, version and contact info
            const response = await fetch(url, {
                headers: {
                    'User-Agent': `${this.appName}/${this.appVersion} (${this.contactEmail})`
                }
            });

            return await response.json();
        } catch (error) {
            console.error('MusicBrainz API error:', error);
            return null;
        }
    }

    async search(query, type = 'release', limit = 20) {
        return this.makeRequest(`/${type}`, {
            query: query,
            limit: limit
        });
    }

    async getRelease(mbid) {
        return this.makeRequest(`/release/${mbid}`, {
            inc: 'artists+labels+recordings+release-groups+url-rels'
        });
    }
    
    async getArtist(mbid) {
        return this.makeRequest(`/artist/${mbid}`, {
            inc: 'releases+url-rels+aliases'
        });
    }
    
    async getReleaseGroup(mbid) {
        return this.makeRequest(`/release-group/${mbid}`, {
            inc: 'artists+releases+url-rels'
        });
    }
    
    // Search for albums by an artist
    async searchReleasesByArtist(artistName, limit = 20) {
        return this.search(`artist:"${artistName}"`, 'release', limit);
    }
    
    // Get recent releases based on date
    async getRecentReleases(limit = 50) {
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 6);
        
        const dateString = sixMonthsAgo.toISOString().split('T')[0];
        
        return this.search(`date:[${dateString} TO *]`, 'release', limit);
    }
    
    // Process release data into a standardized format
    processReleaseData(mbRelease) {
        if (!mbRelease) return null;
        
        // Format cover art URL based on MusicBrainz ID
        // Using Cover Art Archive which pairs with MusicBrainz
        const coverUrl = mbRelease.id ? 
            `https://coverartarchive.org/release/${mbRelease.id}/front` : 
            '';
        
        return {
            id: mbRelease.id,
            title: mbRelease.title,
            artist: mbRelease['artist-credit']?.[0]?.artist?.name || 'Unknown Artist',
            release_date: mbRelease.date || 'Unknown Date',
            cover_url: coverUrl,
            label: mbRelease.label?.[0]?.name,
            country: mbRelease.country,
            status: mbRelease.status,
            tracks: mbRelease.media?.[0]?.track?.length || 0,
            barcode: mbRelease.barcode,
        };
    }
    
    // Get trending albums
    // Since MusicBrainz doesn't have popularity data, we'll simulate this
    async getTrendingAlbums(limit = 20) {
        // Get recent releases and process them
        const recentData = await this.getRecentReleases(50);
        
        if (!recentData || !recentData.releases || !recentData.releases.length) {
            return [];
        }
        
        // Process each release
        const albums = recentData.releases
            .filter(release => release.title && release['artist-credit']?.[0]?.artist?.name)
            .map(release => {
                const processed = this.processReleaseData(release);
                
                // Add simulated rating (between 3.5 and 5.0)
                processed.rating = (Math.random() * 1.5 + 3.5).toFixed(1);
                
                return processed;
            });
        
        // Sort randomly to simulate "trending"
        return albums
            .sort(() => Math.random() - 0.5)
            .slice(0, limit);
    }
    
    // Get new releases
    async getNewReleases(limit = 20) {
        const recentData = await this.getRecentReleases(limit * 2);
        
        if (!recentData || !recentData.releases || !recentData.releases.length) {
            return [];
        }
        
        // Process and sort by release date (newest first)
        const albums = recentData.releases
            .filter(release => release.title && release['artist-credit']?.[0]?.artist?.name && release.date)
            .map(release => {
                const processed = this.processReleaseData(release);
                
                // Add simulated rating (between 3.5 and 5.0)
                processed.rating = (Math.random() * 1.5 + 3.5).toFixed(1);
                
                return processed;
            })
            .sort((a, b) => {
                // Sort by date (newest first)
                const dateA = new Date(a.release_date);
                const dateB = new Date(b.release_date);
                return dateB - dateA;
            });
        
        return albums.slice(0, limit);
    }
    
    // Get similar albums to a specified release
    async getSimilarAlbums(mbid, artistName, albumName, limit = 10) {
        // First approach: get more albums by the same artist
        const artistReleases = await this.searchReleasesByArtist(artistName, 20);
        
        if (!artistReleases || !artistReleases.releases || !artistReleases.releases.length) {
            return [];
        }
        
        // Filter out the original album
        const otherAlbumsByArtist = artistReleases.releases
            .filter(release => release.id !== mbid)
            .map(release => this.processReleaseData(release));
        
        // Second approach: try to find albums with similar titles or by similar artists
        // This is a basic approach since MusicBrainz doesn't have recommendation features
        const words = albumName.split(' ').filter(word => word.length > 3);
        const similarAlbums = [];
        
        if (words.length > 0) {
            // Use one or two keywords from the album title
            const searchTerm = words.slice(0, 2).join(' ');
            const results = await this.search(searchTerm, 'release', 15);
            
            if (results && results.releases) {
                // Add non-duplicate albums to the results
                results.releases.forEach(release => {
                    // Skip if it's by the same artist or already in our list
                    if (release['artist-credit']?.[0]?.artist?.name !== artistName && 
                        !similarAlbums.some(a => a.id === release.id)) {
                        similarAlbums.push(this.processReleaseData(release));
                    }
                });
            }
        }
        
        // Combine both lists, prioritizing albums by the same artist
        const combinedResults = [
            ...otherAlbumsByArtist.map(album => ({
                ...album,
                same_artist: true
            })),
            ...similarAlbums.map(album => ({
                ...album,
                same_artist: false
            }))
        ];
        
        // Add simulated ratings
        return combinedResults
            .map(album => ({
                ...album,
                rating: album.rating || (Math.random() * 1.5 + 3.5).toFixed(1)
            }))
            .slice(0, limit);
    }
    
    // Get enhanced album details
    async getEnhancedAlbumData(albumName, artistName) {
        // Search MusicBrainz for the album
        const searchResults = await this.search(`release:"${albumName}" AND artist:"${artistName}"`, 'release', 1);
        
        if (!searchResults || !searchResults.releases || !searchResults.releases.length) {
            return null;
        }
        
        const mbid = searchResults.releases[0].id;
        
        // Get detailed release info
        const detailedRelease = await this.getRelease(mbid);
        if (!detailedRelease) {
            return null;
        }
        
        // Process into standardized format
        const albumData = this.processReleaseData(detailedRelease);
        
        // Get additional information
        albumData.additional_info = {
            packaging: detailedRelease.packaging,
            quality: detailedRelease.quality,
            disambiguation: detailedRelease.disambiguation,
            status: detailedRelease.status,
        };
        
        // Add track listing if available
        if (detailedRelease.media && detailedRelease.media.length > 0 && 
            detailedRelease.media[0].tracks && detailedRelease.media[0].tracks.length > 0) {
            
            albumData.tracks = detailedRelease.media[0].tracks.map(track => ({
                position: track.position,
                title: track.title,
                length: track.length,
                artist: track['artist-credit']?.[0]?.artist?.name || albumData.artist
            }));
        }
        
        // Add simulated rating
        albumData.rating = (Math.random() * 1.5 + 3.5).toFixed(1);
        
        return albumData;
    }
    
    // Get user recommendations (simulated since MusicBrainz doesn't have user accounts)
    async getUserRecommendations(userId, limit = 10) {
        // In a real app, this would use the user's listening history
        // For now, just return some trending albums as recommendations
        return this.getTrendingAlbums(limit);
    }
    
    // Simulated method to track a user's listening history
    async addToUserHistory(userId, albumId, timestamp = new Date()) {
        // In a real implementation, this would save to a database
        console.log(`Adding album ${albumId} to user ${userId}'s history at ${timestamp}`);
        
        // Return simulated success response
        return {
            success: true,
            timestamp: timestamp,
            userId: userId,
            albumId: albumId
        };
    }
    
    // Simulated method to toggle an album as a favorite for a user
    async toggleFavorite(userId, albumId) {
        // In a real implementation, this would toggle in a database
        console.log(`Toggling favorite status for album ${albumId} by user ${userId}`);
        
        // Return simulated success response
        return {
            success: true,
            userId: userId,
            albumId: albumId,
            isFavorite: true // In a real implementation, this would be the new state
        };
    }
}

// Initialize and export for use in other modules
const musicBrainzAPI = new MusicBrainzAPI();
export default musicBrainzAPI;