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
        const promises = spotifyNewReleases.albums.items.map(async (