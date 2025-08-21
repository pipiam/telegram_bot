export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { botToken, offset, limit, timeout } = req.query;

  if (!botToken) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Bot token is required' 
    });
  }

  try {
    // Use shorter timeout for Vercel
    const apiTimeout = Math.min(parseInt(timeout) || 10, 25);
    
    const telegramUrl = `https://api.telegram.org/bot${botToken}/getUpdates`;
    const params = new URLSearchParams();
    
    if (offset) params.append('offset', offset);
    if (limit) params.append('limit', limit);
    params.append('timeout', apiTimeout.toString());

    const response = await fetch(`${telegramUrl}?${params}`, {
      signal: AbortSignal.timeout(28000) // 28 second timeout
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.description || 'Telegram API error'
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Telegram API error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Server error',
      details: error.message
    });
  }
}