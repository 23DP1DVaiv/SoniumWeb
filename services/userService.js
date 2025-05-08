// userService.js - Handles user management
export class UserService {
    constructor() {
        this.users = [];
        this.loadUsers();
    }
    
    loadUsers() {
        try {
            const savedUsers = localStorage.getItem('sonium_users');
            if (savedUsers) {
                this.users = JSON.parse(savedUsers);
            }
            console.log('Users loaded:', this.users.length);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    saveUsers() {
        localStorage.setItem('sonium_users', JSON.stringify(this.users));
    }
    
    getOrCreateUser(username) {
        // Check if user exists
        let user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            // Create new user
            user = {
                id: Date.now().toString(),
                username: username,
                avatarUrl: '/api/placeholder/32/32', // Default avatar
                createdAt: new Date().toISOString()
            };
            
            this.users.push(user);
            this.saveUsers();
        }
        
        return user;
    }
    
    getUserById(userId) {
        return this.users.find(u => u.id === userId);
    }
    
    updateUser(userId, updates) {
        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex === -1) return false;
        
        this.users[userIndex] = {
            ...this.users[userIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveUsers();
        return true;
    }
}