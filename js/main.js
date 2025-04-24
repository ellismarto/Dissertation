document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    mobileMenu?.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });

    // Show details functionality
    document.querySelectorAll('.show-details-btn').forEach(button => {
        button.addEventListener('click', () => {
            const workInfo = button.closest('.work-info');
            const isShown = workInfo.classList.contains('details-shown');
            
            workInfo.classList.toggle('details-shown');
            button.textContent = isShown ? 'Show Details' : 'Hide Details';
        });
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href'))?.scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
}); 