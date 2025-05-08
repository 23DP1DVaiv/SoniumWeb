// albumService.js - Handles album data and operations
export class AlbumService {
    constructor() {
        this.albums = [];
    }
    
    async loadAlbums() {
        // In a real application, this would fetch from an API
        // For now, we'll use some sample data
        try {
            // Simulate API call with timeout
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.albums = sampleAlbums;
            console.log('Albums loaded:', this.albums.length);
            return true;
        } catch (error) {
            console.error('Error loading albums:', error);
            return false;
        }
    }
    
    getAlbumById(id) {
        return this.albums.find(album => album.id === id) || null;
    }
    
    searchAlbums(query) {
        if (!query) return [];
        
        query = query.toLowerCase();
        return this.albums.filter(album => 
            album.title.toLowerCase().includes(query) || 
            album.artist.toLowerCase().includes(query)
        );
    }
    
    getAlbumsByDecade(decade) {
        if (decade === 'all') return this.albums;
        
        let startYear, endYear;
        
        switch (decade) {
            case '1960s':
                startYear = 1960;
                endYear = 1969;
                break;
            case '1970s':
                startYear = 1970;
                endYear = 1979;
                break;
            case '1980s':
                startYear = 1980;
                endYear = 1989;
                break;
            case '1990s':
                startYear = 1990;
                endYear = 1999;
                break;
            case '2000s':
                startYear = 2000;
                endYear = new Date().getFullYear();
                break;
            default:
                return this.albums;
        }
        
        return this.albums.filter(album => 
            album.year >= startYear && album.year <= endYear
        );
    }
}

// Sample album data
const sampleAlbums = [
    {
        id: '1',
        title: 'OK Computer',
        artist: 'Radiohead',
        year: 1997,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '2',
        title: 'The Dark Side of the Moon',
        artist: 'Pink Floyd',
        year: 1973,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '3',
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: 1969,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '4',
        title: 'Nevermind',
        artist: 'Nirvana',
        year: 1991,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '5',
        title: 'Pet Sounds',
        artist: 'The Beach Boys',
        year: 1966,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '6',
        title: 'Thriller',
        artist: 'Michael Jackson',
        year: 1982,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '7',
        title: 'The Queen Is Dead',
        artist: 'The Smiths',
        year: 1986,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '8',
        title: 'Remain in Light',
        artist: 'Talking Heads',
        year: 1980,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '9',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        year: 1959,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '10',
        title: 'London Calling',
        artist: 'The Clash',
        year: 1979,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '11',
        title: 'To Pimp a Butterfly',
        artist: 'Kendrick Lamar',
        year: 2015,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '12',
        title: 'Blonde',
        artist: 'Frank Ocean',
        year: 2016,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '13',
        title: 'Purple Rain',
        artist: 'Prince',
        year: 1984,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '14',
        title: 'The Velvet Underground & Nico',
        artist: 'The Velvet Underground',
        year: 1967,
        coverUrl: '/api/placeholder/300/300'
    },
    {
        id: '15',
        title: 'Kid A',
        artist: 'Radiohead',
        year: 2000,
        coverUrl: '/api/placeholder/300/300'
    }
];