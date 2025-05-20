// script.js

// Utility: Get element by ID (shorter, safer)
function $(id) {
    return document.getElementById(id);
}

// Configuration (Consider moving to a separate config file or environment variables for production)
const API_BASE_URL = 'http://127.0.0.1:5000/'; // Use '' for relative paths (same origin), or e.g., 'https://your-api-domain.com'

// Login Function
function login() {
    const email = $('login-email')?.value.trim();
    const password = $('login-password')?.value;
    if (!email || !password) {
        // TODO: Replace alert with a more user-friendly notification system
        alert('Please enter both email and password.');
        return;
    }
    fetch(`${API_BASE_URL}/login`, { // Using relative path or configured base URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(response => {
        if (response.ok) {
            window.location.href = 'dashboard.html';
        } else {
            // TODO: Replace alert with a more user-friendly notification system
            alert('Invalid credentials');
        }
    })
    .catch(error => {
        console.error('Login Error:', error);
        // TODO: Replace alert with a more user-friendly notification system
        alert('An error occurred during login. Please try again later.');
    });
}

// Theme Toggle Function
function toggleTheme() {
    const root = document.documentElement;
    root.classList.toggle('light-theme');
    localStorage.setItem('theme', root.classList.contains('light-theme') ? 'light' : 'dark');
}

// Apply saved theme on load
(function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
    } else {
        // Ensure dark theme is applied if 'light-theme' class is not present
        // This handles the case where 'theme' might be 'dark' or null/undefined initially
        document.documentElement.classList.remove('light-theme');
    }
})();

// DOMContentLoaded event for all page-specific logic
document.addEventListener('DOMContentLoaded', function() {
    // Navigation Highlight (optimized)
    const navLinks = document.querySelectorAll('nav a');
    const currentPathname = window.location.pathname;

    // Clear active class from all links first
    navLinks.forEach(nav => nav.classList.remove('active'));

    // Set active class on the current link
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        // Ensure linkHref is not null and handle relative paths correctly
        if (linkHref && (currentPathname.endsWith(linkHref) || (linkHref === './' && (currentPathname.endsWith('/index.html') || currentPathname.endsWith('/'))))) {
            link.classList.add('active');
        }
    });

    // Add click listener to update active class on navigation
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
            // Note: If the click navigates away, the DOMContentLoaded logic above will re-apply active on page load.
            // This click listener is mostly for SPA-like behavior or if navigation doesn't cause a full reload.
        });
    });

    // Smooth Scroll for Navigation Links (skip external links and ensure target exists)
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href'); // e.g., "#section1"
            if (targetId && targetId.length > 1) { // Ensure it's not just "#"
                try {
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        e.preventDefault();
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        console.warn(`Smooth scroll target '${targetId}' not found.`);
                    }
                } catch (error) {
                    console.error(`Invalid selector for smooth scroll: '${targetId}'`, error);
                }
            }
        });
    });

    // Animation on Scroll (IntersectionObserver)
    const features = document.querySelectorAll('.feature');
    if (features.length > 0) { // Only proceed if features exist
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate');
                        observer.unobserve(entry.target); // Optional: stop observing once animated
                    }
                });
            }, { threshold: 0.5 });
            features.forEach(feature => observer.observe(feature));
        } else {
            // Fallback: add animate class immediately
            features.forEach(feature => feature.classList.add('animate'));
        }
    }

    // Dashboard page logic
    if (window.location.pathname.endsWith('dashboard.html')) {
        const imageUpload = $('imageUpload');
        const previewImage = $('previewImage');
        const loadingMessage = $('loadingMessage');
        const detectionResult = $('detectionResult');
        const historyList = $('historyList'); // Ensure historyList is defined if used

        // Check if all essential dashboard elements exist
        if (imageUpload && previewImage && loadingMessage && detectionResult) {
            imageUpload.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    // Basic file type validation (optional, but good practice)
                    if (!file.type.startsWith('image/')) {
                        alert('Please upload a valid image file (e.g., JPG, PNG).');
                        imageUpload.value = ''; // Reset file input
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function(e) {
                        previewImage.src = e.target.result;
                        previewImage.style.display = 'block';
                        detectionResult.style.display = 'none'; // Hide previous result
                        loadingMessage.style.display = 'block';
                        processImage(file);
                    };
                    reader.onerror = function() {
                        console.error("FileReader error.");
                        alert("Error reading file. Please try again.");
                        loadingMessage.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                } else {
                    // No file selected, clear preview and messages
                    previewImage.style.display = 'none';
                    previewImage.src = '#';
                    loadingMessage.style.display = 'none';
                    detectionResult.style.display = 'none';
                }
            });

            function processImage(file) {
                const formData = new FormData();
                formData.append('image', file);

                fetch(`${API_BASE_URL}/analyze`, { // Using relative path or configured base URL
                    method: 'POST',
                    body: formData
                    // No 'Content-Type' header for FormData, browser sets it with boundary
                })
                .then(response => {
                    if (!response.ok) {
                        // Try to parse error from backend if available
                        return response.json().then(errData => {
                            throw new Error(errData.error || `Network response was not ok: ${response.statusText}`);
                        }).catch(() => {
                            // If parsing error JSON fails, use the original status text
                            throw new Error(`Network response was not ok: ${response.statusText}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    loadingMessage.style.display = 'none';
                    // Corrected: Use data.message (or data.prediction_label) from backend response
                    detectionResult.textContent = data.message || 'Analysis complete. No specific message.';
                    detectionResult.style.display = 'block';

                    if (historyList && (data.message || data.prediction_label)) {
                        const li = document.createElement('li');
                        // Displaying the prediction label in history might be more concise
                        const resultText = data.prediction_label || data.message;
                        li.textContent = `${new Date().toLocaleString()}: ${resultText}`;
                        historyList.prepend(li); // Add to the top of the list
                    }
                })
                .catch(error => {
                    console.error('Analysis Error:', error);
                    loadingMessage.style.display = 'none';
                    detectionResult.textContent = 'Error during analysis: ' + error.message;
                    detectionResult.style.display = 'block';
                });
            }
        } else {
            console.warn('One or more dashboard elements (imageUpload, previewImage, loadingMessage, detectionResult) not found.');
        }
    }

    // Contact form validation
    const contactForm = document.querySelector('form[aria-label="Contact form"]');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = $('name')?.value.trim();
            const emailInput = $('email'); // Assuming 'email' is the ID for the contact form email
            const email = emailInput?.value.trim();
            const message = $('message')?.value.trim();

            let isValid = true;
            let missingFields = [];

            if (!name) {
                missingFields.push('Name');
                isValid = false;
            }
            if (!email) {
                missingFields.push('Email');
                isValid = false;
            } else {
                // Basic email format validation
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(email)) {
                    // TODO: Replace alert with a more user-friendly notification system
                    alert('Please enter a valid email address.');
                    emailInput?.focus(); // Focus on the email field
                    return;
                }
            }
            if (!message) {
                missingFields.push('Message');
                isValid = false;
            }

            if (!isValid) {
                // TODO: Replace alert with a more user-friendly notification system
                alert(`Please fill out all required fields: ${missingFields.join(', ')}.`);
                return;
            }
            // TODO: Replace alert with a more user-friendly notification system
            alert('Thank you for your message! (This is a demo, form data is not sent).');
            contactForm.reset();
        });
    }
});