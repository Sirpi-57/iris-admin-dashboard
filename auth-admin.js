// auth-admin.js
import { auth } from './firebase-config.js'; // Assuming firebase-config.js is in the same folder

// Get references to the HTML elements involved in authentication
const adminLoginView = document.getElementById('admin-login-view');
const adminDashboardView = document.getElementById('admin-dashboard-view');
const adminLoginForm = document.getElementById('admin-login-form');
const adminSignOutButton = document.getElementById('admin-sign-out-button');
const adminUserInfo = document.getElementById('admin-user-info');
const adminLoginError = document.getElementById('admin-login-error'); // Get the error message element

/**
 * Handles changes in the Firebase authentication state.
 * Checks if the logged-in user has the 'isAdmin' custom claim.
 */
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in, verify they are an admin
        try {
            const idTokenResult = await user.getIdTokenResult(true); // Force refresh token
            console.log('User Claims:', idTokenResult.claims); // Log claims for debugging

            if (idTokenResult.claims.isAdmin === true) {
                // User is an admin
                console.log("Admin user authenticated:", user.email);
                showAdminDashboard(user); // Show the main dashboard content
            } else {
                // User is logged in but lacks admin privileges
                console.warn("User signed in, but is NOT an admin:", user.email);
                await auth.signOut(); // Sign them out immediately
                showAdminLogin("Access Denied: You do not have admin privileges.");
            }
        } catch (error) {
            // Error fetching token or claims
            console.error("Error checking admin status:", error);
            await auth.signOut(); // Sign out on error
            showAdminLogin("Error verifying your credentials. Please try again.");
        }
    } else {
        // User is signed out
        console.log("Admin user signed out.");
        showAdminLogin(); // Show the login form
    }
});

/**
 * Attaches event listener to the admin login form.
 */
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Clear previous errors
        if (adminLoginError) adminLoginError.textContent = '';
        // Disable button to prevent multiple submissions (optional)
        const loginButton = adminLoginForm.querySelector('button[type="submit"]');
        if (loginButton) loginButton.disabled = true;


        const email = adminLoginForm.email.value;
        const password = adminLoginForm.password.value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login successful - onAuthStateChanged will handle showing the dashboard
                console.log('Admin login successful for:', userCredential.user.email);
                // No need to manually show dashboard here, listener will do it.
            })
            .catch(error => {
                console.error("Admin login error:", error);
                // Display specific error message to the user
                let message = "Login Failed. Please check your credentials.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    message = "Invalid email or password.";
                } else if (error.code === 'auth/invalid-email') {
                     message = "Please enter a valid email address.";
                }
                 // Add more specific error codes if needed
                if (adminLoginError) adminLoginError.textContent = message;
            })
            .finally(() => {
                 // Re-enable button
                 if (loginButton) loginButton.disabled = false;
            });
    });
} else {
    console.error("Admin login form not found in the DOM.");
}

/**
 * Attaches event listener to the sign-out button.
 */
if (adminSignOutButton) {
    adminSignOutButton.addEventListener('click', () => {
        auth.signOut().catch(error => {
             console.error("Error signing out:", error);
             alert("Error signing out. Please try again.");
        });
    });
} else {
    console.error("Admin sign out button not found in the DOM.");
}

/**
 * Shows the admin login view and hides the dashboard.
 * @param {string|null} errorMessage Optional error message to display.
 */
function showAdminLogin(errorMessage = null) {
    if (adminLoginView) adminLoginView.style.display = 'block';
    if (adminDashboardView) adminDashboardView.style.display = 'none';

    // Display error message if provided
    if (adminLoginError) {
        adminLoginError.textContent = errorMessage || '';
        adminLoginError.style.display = errorMessage ? 'block' : 'none';
    }
    // Clear sensitive fields on logout/error
    if(adminLoginForm) {
        adminLoginForm.password.value = '';
    }
}

/**
 * Shows the admin dashboard view and hides the login form.
 * Updates the user info display.
 * Calls the function to load job listings.
 * @param {firebase.User} user The authenticated admin user object.
 */
function showAdminDashboard(user) {
    if (adminLoginView) adminLoginView.style.display = 'none';
    if (adminDashboardView) adminDashboardView.style.display = 'block';

    // Display logged-in user's email
    if (adminUserInfo) {
        adminUserInfo.textContent = `Logged in as: ${user.email}`;
    }

    // Load the job listings - checks if the function exists before calling
    // This function will be defined in app-admin.js
    if (typeof window.loadJobsForAdmin === 'function') {
        window.loadJobsForAdmin();
    } else {
        console.warn("loadJobsForAdmin function not found yet. Jobs will load when app-admin.js runs.");
        // Maybe display a temporary loading state in the job list container
         const jobListContainer = document.getElementById('jobListingsContainerAdmin');
         if(jobListContainer) {
            jobListContainer.innerHTML = '<div class="text-center p-5"><div class="loading-spinner"></div><p>Initializing dashboard...</p></div>';
         }
    }
}