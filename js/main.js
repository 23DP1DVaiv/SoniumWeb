// Sonium - Main JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add color coding to ratings
    const ratingElements = document.querySelectorAll('.album-rating');
    ratingElements.forEach(rating => {
        const value = parseFloat(rating.textContent);
        if (value >= 4.5) {
            rating.style.backgroundColor = '#28a745'; // Green for high ratings
        } else if (value >= 4.0) {
            rating.style.backgroundColor = '#fd7e14'; // Orange for good ratings
        } else {
            rating.style.backgroundColor = '#6c757d'; // Gray for average ratings
        }
    });
    
    // For demo purposes, make search bar show a message
    const searchBar = document.querySelector('.search-bar input');
    searchBar.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            alert('Search functionality would connect to a database in a full implementation.');
        }
    });
    
    // Make buttons show alerts for demonstration
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.textContent === 'Log In' || this.textContent === 'Sign Up') {
                alert('Authentication system would be implemented in a full version.');
            } else if (this.textContent === 'Start Your Collection') {
                alert('This would take users to an onboarding process to select favorite genres and artists.');
            } else if (this.textContent.includes('Like') || this.textContent.includes('Comment')) {
                alert('Social interaction features would be implemented in a full version.');
            }
        });
    });

    // Additional functionality can be added here as the application grows
});