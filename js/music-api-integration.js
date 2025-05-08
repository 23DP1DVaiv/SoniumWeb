// music-api-integration.js - Integration with multiple music APIs

class MusicAPIManager {
    constructor() {
        this.apis = {
            spotify: {
                baseUrl: 'https://api.spotify.com/v1',
                clientId: 'YOUR_SPOTIFY_CLIENT_ID',
                clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET',
                token: null,
                tokenExpiry: null
            },
            musicbrainz: {
                baseUrl: 'https://musicbrainz.org/ws/2',
                appName: 'Sonium',
                appVersion: '1.0.0',
                contactEmail: 'your@email.com'
            },
            lastfm: {
                baseUrl: 'https://ws.audioscrobbler.com/2.0',
                apiKey: 'YOUR_LASTFM_API_KEY'
            }
        };
    }

    // Spotify Authentication
    async getSpotifyToken() {
        // Check if token is still valid
        if (this.apis.spotify.token && this.apis.spotify.tokenExpiry > Date.now()) {
            return this.apis.spotify.token;
        }

        // Request new token
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(`${this.apis.spotify.clientId}:${this.apis.spotify.clientSecret}`)}`
                },
                body: 'grant_type=client_credentials'
            });

            const data = await response.json();
            
            if (data.access_token) {
                this.apis.spotify.token = data.access_token;
                this.apis.spotify.tokenExpiry = Date.now() + (data.expires_in * 1000);
                return data.access_token;
            } else {
                throw new Error('Failed to get token');
            }
        } catch (error) {
            console.error('Spotify authentication error:', error);
            return null;
        }
    }

    // Spotify API calls
    async spotifyRequest(endpoint, params = {}) {
        try {
            const token = await this.getSpotifyToken();
            if (!token) throw new Error('No valid Spotify token');

            const url = new URL(`${this.apis.spotify.baseUrl}${endpoint}`);
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return await response.json();
        } catch (error) {
            console.error('Spotify API error:', error);
            return null;
        }
    }

    async getSpotifyNewReleases(limit = 50) {
        return this.spotifyRequest('/browse/new-releases', {
            limit: limit,
            country: 'US'
        });
    }

    async getSpotifyAlbumDetails(albumId) {
        return this.spotifyRequest(`/albums/${albumId}`);
    }

    async searchSpotify(query, type = 'album', limit = 20) {
        return this.spotifyRequest('/search', {
            q: query,
            type: type,
            limit: limit
        });
    }

    // MusicBrainz API calls
    async musicbrainzRequest(endpoint, params = {}) {
        try {
            const url = new URL(`${this.apis.musicbrainz.baseUrl}${endpoint}`);
            
            // Add format for JSON response
            url.searchParams.append('fmt', 'json');
            
            // Add other parameters
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

            // MusicBrainz requires a user agent with app name, version and contact info
            const response = await fetch(url, {
                headers: {
                    'User-Agent': `${this.apis.musicbrainz.appName}/${this.apis.musicbrainz.appVersion} (${this.apis.musicbrainz.contactEmail})`
                }
            });

            return await response.json();
        } catch (error) {
            console.error('MusicBrainz API error:', error);
            return null;
        }
    }

    async searchMusicBrainz(query, type = 'release', limit = 20) {
        return this.musicbrainzRequest(`/${type}`, {
            query: query,
            limit: limit
        });
    }

    async getMusicBrainzRelease(mbid) {
        return this.musicbrainzRequest(`/release/${mbid}`, {
            inc: 'artists+labels+recordings+release-groups+url-rels'
        });
    }

    // Last.fm API calls
    async lastfmRequest(method, params = {}) {
        try {
            const url = new URL(this.apis.lastfm.baseUrl);
            
            // Add common parameters
            url.searchParams.append('api_key', this.apis.lastfm.apiKey);
            url.searchParams.append('method', method);
            url.searchParams.append('format', 'json');
            
            // Add other parameters
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Last.fm API error:', error);
            return null;
        }
    }

    async getLastfmAlbumInfo(artist, album) {
        return this.lastfmRequest('album.getinfo', {
            artist: artist,
            album: album
        });
    }

    async searchLastfm(album, limit = 20) {
        return this.lastfmRequest('album.search', {
            album: album,
            limit: limit
        });
    }

    // Cross-API methods for enhanced data
    async getEnhancedAlbumData(albumName, artistName) {
        // First search Spotify for basic info
        const spotifyResults = await this.searchSpotify(`album:${albumName} artist:${artistName}`);
        
        if (!spotifyResults || !spotifyResults.albums || !spotifyResults.albums.items.length) {
            return null;
        }
        
        const spotifyAlbum = spotifyResults.albums.items[0];
        const albumData = {
            title: spotifyAlbum.name,
            artist: spotifyAlbum.artists[0].name,
            release_date: spotifyAlbum.release_date,
            cover_image_url: spotifyAlbum.images[0]?.url,
            spotify_id: spotifyAlbum.id,
            spotify_url: spotifyAlbum.external_urls.spotify,
            tracks: spotifyAlbum.total_tracks,
            // These will be filled in from other sources
            musicbrainz_id: null,
            lastfm_tags: [],
            additional_info: {}
        };
        
        // Try to get MusicBrainz data
        const mbResults = await this.searchMusicBrainz(`release:${albumName} AND artist:${artistName}`);
        if (mbResults && mbResults.releases && mbResults.releases.length) {
            const mbRelease = mbResults.releases[0];
            albumData.musicbrainz_id = mbRelease.id;
            
            // Get detailed release info
            const detailedRelease = await this.getMusicBrainzRelease(mbRelease.id);
            if (detailedRelease) {
                albumData.additional_info.label = detailedRelease.label && detailedRelease.label.name;
                albumData.additional_info.barcode = detailedRelease.barcode;
                albumData.additional_info.country = detailedRelease.country;
            }
        }
        
        // Get Last.fm tags and info
        const lastfmInfo = await this.getLastfmAlbumInfo(artistName, albumName);
        if (lastfmInfo && lastfmInfo.album) {
            if (lastfmInfo.album.tags && lastfmInfo.album.tags.tag) {
                albumData.lastfm_tags = lastfmInfo.album.tags.tag.map(tag => tag.name);
            }
            
            if (lastfmInfo.album.wiki) {
                albumData.additional_info.summary = lastfmInfo.album.wiki.summary;
                albumData.additional_info.content = lastfmInfo.album.wiki.content;
            }
            
            albumData.additional_info.listeners = lastfmInfo.album.listeners;
            albumData.additional_info.playcount = lastfmInfo.album.playcount;
        }
        
        return albumData;
    }

    // Method to fetch and process recent releases from all APIs
    async getRecentReleases() {
        // Start with Spotify as it has the most reliable new releases endpoint
        const spotifyNewReleases = await this.getSpotifyNewReleases(50);
        
        if (!spotifyNewReleases || !spotifyNewReleases.albums || !spotifyNewReleases.albums.items) {
            console.error('Failed to get new releases from Spotify');
            return [];
        }
        
        // Process each album with enhanced data
        const processedAlbums = [];
        
        // Use Promise.all for parallel processing
        const promises = spotifyNewReleases.albums.items.map(async (album) => {
            try {
                // Get basic information from the Spotify release
                const basicData = {
                    id: album.id,
                    title: album.name,
                    artist: album.artists[0].name,
                    cover_url: album.images[0]?.url || '',
                    release_date: album.release_date,
                    rating: 0 // Will be calculated from Last.fm data
                };
                
                // Try to get Last.fm data for popularity/rating
                const lastfmData = await this.getLastfmAlbumInfo(album.artists[0].name, album.name);
                if (lastfmData && lastfmData.album) {
                    // Calculate a rating based on Last.fm popularity (playcount and listeners)
                    const playcount = parseInt(lastfmData.album.playcount) || 0;
                    const listeners = parseInt(lastfmData.album.listeners) || 0;
                    
                    // Simple rating algorithm - can be adjusted as needed
                    // Scale from 0-5 stars based on listener count
                    const maxListeners = 1000000; // Arbitrary benchmark for a very popular album
                    const rating = Math.min(5, (listeners / maxListeners) * 5);
                    basicData.rating = Math.max(3, rating); // Set minimum rating to 3.0 for new releases
                    
                    // Add Last.fm tags
                    if (lastfmData.album.tags && lastfmData.album.tags.tag) {
                        basicData.tags = lastfmData.album.tags.tag.slice(0, 5).map(tag => tag.name);
                    }
                } else {
                    // Default rating for new albums with no Last.fm data
                    basicData.rating = 4.0;
                }
                
                return basicData;
            } catch (error) {
                console.error(`Error processing album ${album.name}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        
        // Filter out any failed results and return the processed albums
        return results.filter(album => album !== null);
    }
    
    // Method to get similar albums based on an album ID
    async getSimilarAlbums(albumId, artistName, albumName) {
        // Try to find similar albums by the same artist first
        const artistAlbums = await this.searchSpotify(`artist:"${artistName}"`, 'album', 10);
        const sameArtistAlbums = artistAlbums?.albums?.items || [];
        
        // Filter out the original album
        const otherAlbumsByArtist = sameArtistAlbums.filter(album => album.id !== albumId);
        
        // Get genre information from Last.fm
        const lastfmInfo = await this.getLastfmAlbumInfo(artistName, albumName);
        let tags = [];
        if (lastfmInfo && lastfmInfo.album && lastfmInfo.album.tags) {
            tags = lastfmInfo.album.tags.tag.map(tag => tag.name);
        }
        
        // Use the first 3 tags to find similar albums
        const similarAlbums = [];
        if (tags.length > 0) {
            // Try to get albums with similar tags from Spotify
            const tagQueries = tags.slice(0, 3).map(tag => `genre:"${tag}"`);
            
            for (const query of tagQueries) {
                const results = await this.searchSpotify(query, 'album', 5);
                if (results?.albums?.items) {
                    // Add non-duplicate albums to the results
                    results.albums.items.forEach(album => {
                        // Skip if it's by the same artist or already in our list
                        if (album.artists[0].name !== artistName && 
                            !similarAlbums.some(a => a.id === album.id)) {
                            similarAlbums.push({
                                id: album.id,
                                title: album.name,
                                artist: album.artists[0].name,
                                cover_url: album.images[0]?.url || '',
                                release_date: album.release_date
                            });
                        }
                    });
                }
                
                // Stop once we have enough similar albums
                if (similarAlbums.length >= 10) break;
            }
        }
        
        // Combine both lists, prioritizing albums by the same artist
        const combinedResults = [
            ...otherAlbumsByArtist.map(album => ({
                id: album.id,
                title: album.name,
                artist: album.artists[0].name,
                cover_url: album.images[0]?.url || '',
                release_date: album.release_date,
                same_artist: true
            })),
            ...similarAlbums.map(album => ({
                ...album,
                same_artist: false
            }))
        ];
        
        return combinedResults.slice(0, 10); // Return at most 10 recommendations
    }
    
    // Method to get user reviews from Last.fm (shoutbox comments)
    async getAlbumReviews(artistName, albumName) {
        const lastfmInfo = await this.getLastfmAlbumInfo(artistName, albumName);
        
        if (!lastfmInfo || !lastfmInfo.album || !lastfmInfo.album.shoutbox) {
            return [];
        }
        
        // Process Last.fm shoutbox comments as reviews
        return lastfmInfo.album.shoutbox.shout.map(shout => ({
            user: shout.author,
            date: shout.date,
            content: shout.body,
            // We don't have ratings in shoutbox, so use a default or random value
            rating: (Math.random() * 2 + 3).toFixed(1) // Random rating between 3.0-5.0
        }));
    }
    
    // Method to track listening history (would connect to user accounts)
    async addToUserHistory(userId, albumId, timestamp = new Date()) {
        // In a real implementation, this would save to a database
        console.log(`Adding album ${albumId} to user ${userId}'s history at ${timestamp}`);
        
        // For now just return a simulated success
        return {
            success: true,
            timestamp: timestamp,
            userId: userId,
            albumId: albumId
        };
    }
    
    // Method to mark an album as a favorite for a user
    async toggleFavorite(userId, albumId) {
        // In a real implementation, this would toggle in a database
        console.log(`Toggling favorite status for album ${albumId} by user ${userId}`);
        
        // For now just return a simulated response
        return {
            success: true,
            userId: userId,
            albumId: albumId,
            isFavorite: true // In real implementation, this would be the new state
        };
    }
    
    // Method to get trending albums based on recent popularity
    async getTrendingAlbums() {
        // In a real implementation, this would use API data + user activity
        
        // For now, just get new releases and sort randomly to simulate trending
        const newReleases = await this.getRecentReleases();
        
        // Add fake trending score
        const trending = newReleases.map(album => ({
            ...album,
            trend_score: Math.random() * 100 // Random trend score for demo
        }));
        
        // Sort by trend score
        trending.sort((a, b) => b.trend_score - a.trend_score);
        
        return trending.slice(0, 20); // Return top 20 trending albums
    }
    
    // Method to get user recommendations based on listening history
    async getUserRecommendations(userId, limit = 10) {
        // In a real implementation, this would use the user's listening history
        // and preferences to generate personalized recommendations
        
        // For demo purposes, just return some new releases
        const newReleases = await this.getRecentReleases();
        return newReleases.slice(0, limit);
    }
}

// Initialize and export for use in other modules
const musicAPIManager = new MusicAPIManager();
export default musicAPIManager;