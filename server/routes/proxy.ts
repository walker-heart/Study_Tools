import { Router } from 'express';
import axios, { AxiosError } from 'axios';

const router = Router();

// Proxy route for dsers API
router.get('/api/proxy/dsers/stores', async (req, res) => {
  try {
    // Log request details for debugging
    console.log('Proxying request to dsers API:', {
      origin: req.headers.origin,
      referer: req.headers.referer,
      authorization: req.headers.authorization ? 'present' : 'absent',
      cookies: req.headers.cookie ? 'present' : 'absent'
    });

    // Set CORS headers for the response
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Vary', 'Origin');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const response = await axios.get('https://bff-api-gw.dsers.com/account-user-bff/v1/stores/user/list', {
      headers: {
        'Origin': req.headers.origin || '',
        'Referer': req.headers.referer || '',
        'User-Agent': req.headers['user-agent'] || '',
        'Accept': 'application/json',
        'Accept-Language': req.headers['accept-language'] || '',
        'Cookie': req.headers.cookie || '',
        ...req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}
      },
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

    // Send error response
    res.status(axiosError.response?.status || 500).json({
      error: 'Failed to fetch data from dsers API',
      details: axiosError.response?.data || axiosError.message,
      status: axiosError.response?.status
    });
  }
});

export default router;
