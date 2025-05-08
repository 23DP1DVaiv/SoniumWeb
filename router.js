// router.js - Simple router for navigation
export class Router {
    constructor() {
        this.pages = {
            'welcome': document.getElementById('welcome-section'),
            'search': document.getElementById('search-section'),
            'collection': document.getElementById('collection-section'),
            'top': document.getElementById('top-section')
        };
        
        this.activeNav = {
            'welcome': document.getElementById('nav-home'),
            'search': document.getElementById('nav-search'),
            'collection': document.getElementById('nav-collection'),
            'top': document.getElementById('nav-top')
        };
        
        this.currentPage = 'welcome';
    }
    
    navigateTo(pageName) {
        if (!this.pages[pageName]) {
            console.error('Page not found:', pageName);
            return false;
        }
        
        // Hide all pages
        Object.values(this.pages).forEach(page => {
            page.classList.remove('active');
        });
        
        // Show the requested page
        this.pages[pageName].classList.add('active');
        
        // Update navigation highlights
        Object.values(this.activeNav).forEach(nav => {
            nav.classList.remove('active');
        });
        
        if (this.activeNav[pageName]) {
            this.activeNav[pageName].classList.add('active');
        }
        
        this.currentPage = pageName;
        return true;
    }
    
    getCurrentPage() {
        return this.currentPage;
    }
}