// server.js - Express server for Sonium

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
                spotify_id VARCHAR(255),
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
                spotify_id VARCHAR(255),
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

// Spotify API integration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyToken = null;
let tokenExpiration = null;

async function getSpotifyToken() {
    // Check if token is still valid
    if (spotifyToken && tokenExpiration && Date.now() < tokenExpiration) {
        return spotifyToken;
    }
    
    try {
        // Get new token
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            params: {
                grant_type: 'client_credentials'
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
            }
        });
        
        spotifyToken = response.data.access_token;
        // Set expiration time (usually 3600 seconds)
        tokenExpiration = Date.now() + (response.data.expires_in * 1000);
        
        return spotifyToken;
    } catch (error) {
        console.error('Error getting Spotify token:', error.message);
        return null;
    }
}

// Function to fetch new releases from Spotify
async function fetchNewReleases() {
    try {
        const token = await getSpotifyToken();
        if (!token) {
            console.error('Failed to get Spotify token');
            return [];
        }
        
        const response = await axios.get('https://api.spotify.com/v1/browse/new-releases', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                limit: 50,
                country: 'US'
            }
        });
        
        return response.data.albums.items;
    } catch (error) {
        console.error('Error fetching new releases:', error.message);
        return [];
    }
}

// Function to update album library
async function updateAlbumLibrary() {
    try {
        console.log('Starting album library update...');
        const newReleases = await fetchNewReleases();
        
        if (!newReleases.length) {
            console.log('No new releases found');
            return;
        }
        
        console.log(`Found ${newReleases.length} new releases`);
        const client = await pool.connect();
        
        for (const album of newReleases) {
            // Check if artist exists
            let artistId;
            const artistResult = await client.query(
                'SELECT id FROM artists WHERE spotify_id = $1',
                [album.artists[0].id]
            );
            
            if (artistResult.rows.length) {
                artistId = artistResult.rows[0].id;
            } else {
                // Insert new artist
                const newArtist = await client.query(
                    'INSERT INTO artists (name, spotify_id, image_url) VALUES ($1, $2, $3) RETURNING id',
                    [album.artists[0].name, album.artists[0].id, ''] // Image URL would be fetched separately
                );
                artistId = newArtist.rows[0].id;
            }
            
            // Check if album exists
            const albumResult = await client.query(
                'SELECT id FROM albums WHERE spotify_id = $1',
                [album.id]
            );
            
            if (albumResult.rows.length === 0) {
                // Insert new album
                await client.query(
                    `INSERT INTO albums 
                     (title, artist_id, release_date, cover_image_url, spotify_id) 
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        album.name,
                        artistId,
                        album.release_date,
                        album.images[0]?.url || '',
                        album.id
                    ]
                );
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
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            ORDER BY a.release_date DESC
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
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist
            FROM albums a
            JOIN artists ar ON a.artist_id = ar.id
            WHERE 
                a.title ILIKE $1 OR
                ar.name ILIKE $1
            ORDER BY a.release_date DESC
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
            SELECT a.id, a.title, a.release_date, a.cover_image_url, ar.name as artist
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
            review_count: ratingResult.rows[0].review_count || 0
        };
        
        res.json(album);
    } catch (error) {
        console.error('Error fetching album details:', error);
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