import { Router } from 'express';
import axios, { AxiosError } from 'axios';

const router = Router();

// Helper function to check authentication
function checkAuthentication(req: any) {
  try {
    // Check various token locations
    const token = req.headers.authorization || 
                  req.cookies?.dsers_token || 
                  req.cookies?.auth_token ||
                  (req.session?.user?.token);
                   
    console.log('Authentication check:', {
      hasAuthHeader: !!req.headers.authorization,
      hasDsersToken: !!req.cookies?.dsers_token,
      hasAuthToken: !!req.cookies?.auth_token,
      hasSessionToken: !!(req.session?.user?.token),
      cookies: Object.keys(req.cookies || {}),
      sessionExists: !!req.session
    });

    if (!token) {
      return {
        isAuthenticated: false,
        message: 'No authentication token found in headers, cookies, or session'
      };
    }

    // Ensure token is properly formatted with Bearer prefix
    let formattedToken = token;
    if (token.startsWith('Bearer ')) {
      formattedToken = token;
    } else if (token.startsWith('"') || token.startsWith("'")) {
      // Handle quoted tokens
      const unquotedToken = token.slice(1, -1);
      formattedToken = `Bearer ${unquotedToken}`;
    } else {
      formattedToken = `Bearer ${token}`;
    }
    
    return {
      isAuthenticated: true,
      token: formattedToken
    };
  } catch (error) {
    console.error('Error during authentication check:', error);
    return {
      isAuthenticated: false,
      message: 'Error checking authentication'
    };
  }
}

// Proxy route for dsers API
router.get('/api/proxy/dsers/stores', async (req, res) => {
  try {
    const auth = checkAuthentication(req);
    
    // Log request details for debugging
    console.log('Proxying request to dsers API:', {
      origin: req.headers.origin,
      referer: req.headers.referer,
      authorization: auth.isAuthenticated ? 'present' : 'absent',
      cookies: req.headers.cookie ? 'present' : 'absent'
    });

    if (!auth.isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource',
        details: auth.message
      });
    }

    // Set CORS headers for the response
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie, Access-Control-Allow-Origin, Access-Control-Allow-Credentials');
      res.setHeader('Vary', 'Origin');
      
      // Additional security headers
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Timing-Allow-Origin', origin);
    }

    // Handle preflight requests with proper CORS headers
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      res.status(204).end();
      return;
    }

    const headers: Record<string, string> = {
      'Origin': req.headers.origin || '',
      'Referer': req.headers.referer || '',
      'User-Agent': req.headers['user-agent'] || '',
      'Accept': 'application/json',
      'Accept-Language': req.headers['accept-language'] || '',
      'Authorization': auth.token,
    };

    // Only forward cookies if they exist
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    const response = await axios.get('https://bff-api-gw.dsers.com/account-user-bff/v1/stores/user/list', {
      headers,
      validateStatus: (status) => status < 500,
      withCredentials: true
    });
    
    // Forward relevant response headers
    const allowedHeaders = [
      'content-type',
      'content-length',
      'etag',
      'date',
      'set-cookie'
    ];
    
    Object.entries(response.headers).forEach(([key, value]) => {
      if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        res.setHeader(key, value);
      }
    });

    // Handle specific error responses
    if (response.data?.code === 400 && response.data?.reason === 'TOKEN_NOT_FOUND') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Your session has expired or is invalid. Please log in again.',
        details: response.data
      });
    }

    // Send the response
    res.status(response.status).json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Proxy request failed:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      headers: axiosError.response?.headers
    });

    // Determine appropriate error response
    const status = axiosError.response?.status || 500;
    const errorResponse = {
      error: 'Failed to fetch data from dsers API',
      message: status === 401 ? 'Authentication failed' : 'An error occurred while processing your request',
      details: axiosError.response?.data || axiosError.message,
      status
    };

    res.status(status).json(errorResponse);
  }
});

export default router;
