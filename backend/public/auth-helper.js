// Helper function for logout that can be used in admin.html or admin.js

async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Logout successful');
      // Redirect to login page
      window.location.href = '/login';
    } else {
      console.error('Logout failed:', result.error);
      alert('Logout failed: ' + result.error);
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('An error occurred during logout');
  }
}

// Check if user is authenticated
async function checkAuthentication() {
  try {
    const response = await fetch('/api/auth/check');
    const result = await response.json();
    
    return {
      authenticated: result.authenticated,
      user: result.user
    };
  } catch (error) {
    console.error('Error checking authentication:', error);
    return { authenticated: false, user: null };
  }
}

// Get current user info
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    
    if (response.status === 401) {
      // Not authenticated, redirect to login
      window.location.href = '/login';
      return null;
    }

    const result = await response.json();
    
    if (result.success) {
      return result.user;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// You can add this HTML button to your admin page to enable logout
// <button onclick="logout()" class="btn btn-logout">Logout</button>
