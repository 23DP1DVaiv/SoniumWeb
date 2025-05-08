// server.js - Express server for Sonium, using MusicBrainz API

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sonium',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// MusicBrainz API configuration
const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ART_ARCHIVE_API = 'https://coverartarchive.org';
const USER_AGENT = 'Sonium/1.0.0 (sonium.info@gmail.com)'; // Required by MusicBrainz

// Database initialization
async function initDatabase() {
    try {
        const client = await pool.connect();
        
        // Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS artists (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                bio TEXT,
                image_url TEXT,
                mbid VARCHAR(36) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS genres (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS albums (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist_id INTEGER REFERENCES artists(id),
                release_date DATE,
                cover_image_url TEXT,
                mbid VARCHAR(36) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS album_genres (
                album_id INTEGER REFERENCES albums(id),
                genre_id INTEGER REFERENCES genres(id),
                PRIMARY KEY (album_id, genre_id)
            );
            
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                profile_image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                album_id INTEGER REFERENCES albums(id),
                rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
                review_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        client.release();
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// MusicBrainz API helper functions
async function musicBrainzRequest(endpoint, params = {}) {
    const url = new URL(`${MUSICBRAINZ_API_BASE}${endpoint}`);
    
    // Add format for JSON response
    url.searchParams.append('fmt', 'json');
    
    // Add other parameters
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    try {
        // MusicBrainz requires a user agent
        const response = await axios.get(url.toString(), {
            headers: {
                'User-Agent': USER_AGENT
            }
        });
        
        return response.data;
    } catch (error) {
        console.error('MusicBrainz API error:', error.message);
        return null;
    }
}

async function getCoverArtForRelease(mbid) {
    try {
        const response = await axios.get(`${COVER_ART_ARCHIVE_API}/release/${mbid}`, {
            headers: {
                'User-Agent': USER_AGENT
            }
        });
        
        // Return front image URL if available
        if (response.data && response.data.images && response.data.images.length > 0) {
            const frontImage = response.data.images.find(img => img.front) || response.data.images[0];
            return frontImage.image;
        }
        
        return null;
    } catch (error) {
        // Cover art might not be available for all releases
        console.log(`No cover art for release ${mbid}`);
        return null;
    }
}

// Function to fetch recent releases from MusicBrainz
async function fetchRecentReleases(limit = 50) {
    try {
        // Get releases from the past 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const dateStr = threeMonthsAgo.toISOString().split('T')[0];
        
        // MusicBrainz query for recent releases
        const query = `date:[${dateStr} TO *] AND status:official AND type:album`;
        
        const data = await musicBrainzRequest('/release', {
            query: query,
            limit: limit,
            offset: 0
        });
        
        if (!data || !data.releases) {
            console.error('Failed to get releases from MusicBrainz');
            return [];
        }
        
        // Process the releases
        return data.releases;
    } catch (error) {
        console.error('Error fetching recent releases:', error.message);
        return [];
    }
}

// Function to update album library
async function updateAlbumLibrary() {
    try {
        console.log('Starting album library update...');
        const newReleases = await fetchRecentReleases();
        
        if (!newReleases.length) {
            console.log('No new releases found');
            return;
        }
        
        console.log(`Found ${newReleases.length} new releases`);
        const client = await pool.connect();
        
        for (const release of newReleases) {
            try {
                // Get artist information
                let artistId;
                if (release['artist-credit'] && release['artist-credit'].length > 0) {
                    const artist = release['artist-credit'][0].artist;
                    
                    // Check if artist exists
                    const artistResult = await client.query(
                        'SELECT id FROM artists WHERE mbid = $1',
                        [artist.id]
                    );
                    
                    if (artistResult.rows.length) {
                        artistId = artistResult.rows[0].id;
                    } else {
                        // Insert new artist
                        const newArtist = await client.query(
                            'INSERT INTO artists (name, mbid) VALUES ($1, $2) RETURNING id',
                            [artist.name, artist.id]
                        );
                        artistId = newArtist.rows[0].id;
                    }
                } else {
                    console.log(`Skipping release ${release.id} - no artist information`);
                    continue;
                }
                
                // Check if album exists
                const albumResult = await client.query(
                    'SELECT id FROM albums WHERE mbid = $1',
                    [release.id]
                );
                
                if (albumResult.rows.length === 0) {
                    // Get cover image URL
                    const coverImageUrl = await getCoverArtForRelease(release.id) || '';
                    
                    // Parse release date - MusicBrainz gives dates in various formats
                    let releaseDate = null;
                    if (release.date) {
                        // Handle various date formats (YYYY, YYYY-MM, YYYY-MM-DD)
                        const parts = release.date.split('-');
                        if (parts.length === 1) {
                            releaseDate = `${parts[0]}-01-01`; // Default to Jan 1
                        } else if (parts.length === 2) {
                            releaseDate = `${parts[0]}-${parts[1]}-01`; // Default to 1st of month
                        } else {
                            releaseDate = release.date;
                        }
                    }
                    
                    // Insert new album
                    await client.query(
                        `INSERT INTO albums 
                         (title, artist_id, release_date, cover_image_url, mbid) 
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            release.title,
                            artistId,
                            releaseDate,
                            coverImageUrl,
                            release.id
                        ]
                    );
                    
                    // Add genres if available
                    if (release.tags && release.tags.length > 0) {
                        for (const tag of release.tags) {
                            // Get or create genre
                            let genreId;
                            const genreResult = await client.query(
                                'SELECT id FROM genres WHERE name = $1',
                                [tag.name.toLowerCase()]
                            );
                            
                            if (genreResult.rows.length) {
                                genreId = genreResult.rows[0].id;
                            } else {
                                const newGenre = await client.query(
                                    'INSERT INTO genres (name) VALUES ($1) RETURNING id',
                                    [tag.name.toLowerCase()]
                                );
                                genreId = newGenre.rows[0].id;
                            }
                            
                            // Link album to genre
                            await client.query(
                                'INSERT INTO album_genres (album_id, genre_id) VALUES ((SELECT id FROM albums WHERE mbid = $1), $2)',
                                [release.id, genreId]
                            );
                        }
                    }
                }
            } catch (releaseError) {
                console.error(`Error processing release ${release.id}:`, releaseError);
                // Continue with the next release
                continue;
            }
        }
        
        client.release();
        console.log('Album library updated successfully');
    } catch (error) {
        console.error('Error updating album library:', error);
    }
}

// API Routes

// Get recent albums
app.get('/api/albums/recent', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist, a.mbid
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            ORDER BY a.release_date DESC NULLS LAST
            LIMIT 20
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Error fetching recent albums:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search albums
app.get('/api/albums/search', async (req, res) => {
    const { query } = req.query;
    
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
        const { rows } = await pool.query(`
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist, a.mbid
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            WHERE 
                a.title ILIKE $1 OR
                ar.name ILIKE $1
            ORDER BY a.release_date DESC NULLS LAST
            LIMIT 50
        `, [`%${query}%`]);
        
        res.json(rows);
    } catch (error) {
        console.error('Error searching albums:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get album details
app.get('/api/albums/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get album details
        const albumResult = await pool.query(`
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist, a.mbid, ar.mbid as artist_mbid
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            WHERE a.id = $1
        `, [id]);
        
        if (albumResult.rows.length === 0) {
            return res.status(404).json({ error: 'Album not found' });
        }
        
        // Get genres
        const genresResult = await pool.query(`
            SELECT g.name
            FROM genres g
            JOIN album_genres ag ON g.id = ag.genre_id
            WHERE ag.album_id = $1
        `, [id]);
        
        // Get average rating
        const ratingResult = await pool.query(`
            SELECT AVG(rating) as average_rating, COUNT(*) as review_count
            FROM reviews
            WHERE album_id = $1
        `, [id]);
        
        const album = {
            ...albumResult.rows[0],
            genres: genresResult.rows.map(g => g.name),
            average_rating: ratingResult.rows[0].average_rating || 0,
            review_count: parseInt(ratingResult.rows[0].review_count) || 0
        };
        
        // Try to get additional details from MusicBrainz API
        if (album.mbid) {
            try {
                const mbRelease = await musicBrainzRequest(`/release/${album.mbid}`, {
                    inc: 'recordings+artists+labels+url-rels'
                });
                
                if (mbRelease) {
                    // Add track listing
                    if (mbRelease.media && mbRelease.media.length > 0) {
                        album.tracks = mbRelease.media.flatMap(medium => 
                            medium.tracks ? medium.tracks.map(track => ({
                                position: track.position,
                                title: track.title,
                                length: track.length, // in milliseconds
                                disc: medium.position
                            })) : []
                        );
                    }
                    
                    // Add label info
                    if (mbRelease['label-info'] && mbRelease['label-info'].length > 0) {
                        const labelInfo = mbRelease['label-info'][0];
                        if (labelInfo.label) {
                            album.label = labelInfo.label.name;
                        }
                        album.catalog_number = labelInfo['catalog-number'] || '';
                    }
                    
                    // Add country and barcode
                    album.country = mbRelease.country || '';
                    album.barcode = mbRelease.barcode || '';
                }
            } catch (mbError) {
                console.error('Error fetching additional MusicBrainz data:', mbError);
                // Continue with the basic album info
            }
        }
        
        res.json(album);
    } catch (error) {
        console.error('Error fetching album details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search MusicBrainz directly
app.get('/api/musicbrainz/search', async (req, res) => {
    const { query, type = 'release' } = req.query;
    
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
        const data = await musicBrainzRequest(`/${type}`, {
            query: query,
            limit: 20
        });
        
        if (!data) {
            return res.status(500).json({ error: 'MusicBrainz API error' });
        }
        
        // Process the results based on the type
        let results = [];
        
        if (type === 'release') {
            results = await Promise.all(data.releases.map(async (release) => {
                // Try to get cover art
                let coverUrl = '';
                try {
                    coverUrl = await getCoverArtForRelease(release.id) || '';
                } catch (err) {
                    // Ignore cover art errors
                }
                
                return {
                    id: release.id,
                    title: release.title,
                    artist: release['artist-credit']?.[0]?.artist?.name || 'Unknown Artist',
                    release_date: release.date || '',
                    cover_image_url: coverUrl
                };
            }));
        } else if (type === 'artist') {
            results = data.artists.map(artist => ({
                id: artist.id,
                name: artist.name,
                country: artist.country || '',
                type: artist.type || ''
            }));
        }
        
        res.json(results);
    } catch (error) {
        console.error('Error searching MusicBrainz:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Schedule library updates (daily at midnight)
cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled album library update');
    await updateAlbumLibrary();
});

// Initialize application
async function initApp() {
    await initDatabase();
    
    // Run initial update if database is empty
    const { rows } = await pool.query('SELECT COUNT(*) FROM albums');
    if (parseInt(rows[0].count) === 0) {
        console.log('Empty database detected, performing initial album library update');
        await updateAlbumLibrary();
    }
    
    app.listen(PORT, () => {
        console.log(`Sonium server running on port ${PORT}`);
    });
}

initApp().catch(err => {
    console.error('Failed to initialize application:', err);
});