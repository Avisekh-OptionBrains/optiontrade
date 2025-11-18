const AuthToken = require('../models/AuthToken');

// Middleware to verify authentication token
const verifyAuth = async (req, res, next) => {
  try {
    // Get token from header or cookie
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (!token) {
      console.log('❌ No authentication token provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        redirectTo: '/login.html'
      });
    }

    // Find token in database
    const authToken = await AuthToken.findOne({ token: token });

    if (!authToken) {
      console.log('❌ Invalid authentication token');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authentication token',
        redirectTo: '/login.html'
      });
    }

    // Check if token is valid
    if (!authToken.isValid()) {
      console.log('❌ Authentication token expired or inactive');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token expired. Please login again.',
        redirectTo: '/login.html'
      });
    }

    // Refresh token usage
    await authToken.refreshUsage();

    // Attach user info to request
    req.user = {
      email: authToken.email,
      token: token
    };

    console.log(`✅ Authenticated user: ${authToken.email}`);
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

// Middleware to check if user is already authenticated (for login page)
const checkAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (!token) {
      return next();
    }

    const authToken = await AuthToken.findOne({ token: token });

    if (authToken && authToken.isValid()) {
      // User is already authenticated
      req.user = {
        email: authToken.email,
        token: token,
        isAuthenticated: true
      };
    }

    next();
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    next();
  }
};

// Middleware to logout
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.authToken;

    if (token) {
      // Deactivate token
      await AuthToken.findOneAndUpdate(
        { token: token },
        { isActive: false }
      );
      console.log(`✅ User logged out successfully`);
    }

    // Clear cookie
    res.clearCookie('authToken');

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Logout failed' 
    });
  }
};

module.exports = {
  verifyAuth,
  checkAuth,
  logout
};

