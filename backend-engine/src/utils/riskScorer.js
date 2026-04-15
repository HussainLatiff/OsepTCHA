/**
 * Risk Scorer Utility
 * 
 * Analyzes request details and client-side signals to determine the likelihood
 * of a request coming from a bot.
 */

const net = require('net');

// =============================================================================
// Datacenter IP Ranges
// =============================================================================

const DATACENTER_CIDRS = [
  // AWS
  '3.0.0.0/8', '13.0.0.0/8', '18.0.0.0/8', '34.0.0.0/8', '35.0.0.0/8',
  '52.0.0.0/8', '54.0.0.0/8', '99.0.0.0/8',
  // Google Cloud
  '34.64.0.0/10', '35.184.0.0/13', '104.154.0.0/15', '104.196.0.0/14',
  // Azure
  '13.64.0.0/11', '20.0.0.0/8', '40.64.0.0/10', '52.224.0.0/11',
  // DigitalOcean
  '64.225.0.0/16', '68.183.0.0/16', '104.131.0.0/16', '134.209.0.0/16',
  '138.68.0.0/16', '139.59.0.0/16', '142.93.0.0/16', '157.245.0.0/16',
  // Linode
  '45.33.0.0/16', '45.56.0.0/16', '45.79.0.0/16', '139.162.0.0/16',
  // Vultr
  '45.32.0.0/16', '45.63.0.0/16', '45.76.0.0/16', '108.61.0.0/16',
  // Hetzner
  '5.9.0.0/16', '46.4.0.0/14', '78.46.0.0/15', '88.99.0.0/16',
  '95.216.0.0/14', '135.181.0.0/16',
  // OVH
  '51.38.0.0/16', '51.68.0.0/16', '51.75.0.0/16', '137.74.0.0/16',
  '139.99.0.0/16', '144.217.0.0/16', '149.56.0.0/16',
];

function ipToLong(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function cidrContains(cidr, ip) {
  const [range, bits] = cidr.split('/');
  const mask = ~((1 << (32 - parseInt(bits))) - 1) >>> 0;
  const rangeStart = ipToLong(range) & mask;
  const ipLong = ipToLong(ip);
  return (ipLong & mask) === rangeStart;
}

function isDatacenterIP(ip) {
  // Extract IPv4 if it's an IPv4-mapped IPv6 address
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  if (!ip || !net.isIPv4(ip)) return false;
  return DATACENTER_CIDRS.some(cidr => cidrContains(cidr, ip));
}

// =============================================================================
// HTTP Header Analysis
// =============================================================================

const SUSPICIOUS_HEADERS = new Set([
  'x-requested-with', 'x-forwarded-for', 'x-real-ip', 'via',
  'forwarded', 'x-originating-ip', 'cf-connecting-ip',
  'true-client-ip', 'x-cluster-client-ip'
]);

const EXPECTED_BROWSER_HEADERS = new Set([
  'accept', 'accept-language', 'accept-encoding', 'user-agent'
]);

function analyzeHeaders(headers) {
  if (!headers) return [];
  const detections = [];
  const headersLower = {};
  for (const [key, value] of Object.entries(headers)) {
    headersLower[key.toLowerCase()] = value;
  }

  // Check for missing expected headers
  let missingCount = 0;
  for (const header of EXPECTED_BROWSER_HEADERS) {
    if (!(header in headersLower)) {
      missingCount++;
    }
  }
  if (missingCount > 1) {
    detections.push({
      category: 'bot',
      score: 0.4,
      confidence: 0.5,
      reason: `Missing ${missingCount} expected browser headers`
    });
  }

  // Check for suspicious headers
  for (const header of Object.keys(headersLower)) {
    if (SUSPICIOUS_HEADERS.has(header)) {
      detections.push({
        category: 'bot',
        score: 0.3,
        confidence: 0.4,
        reason: `Suspicious header present: ${header}`
      });
    }
  }

  // Check Accept-Language
  const acceptLang = headersLower['accept-language'] || '';
  if (acceptLang === '' || acceptLang === '*') {
    detections.push({
      category: 'bot',
      score: 0.3,
      confidence: 0.4,
      reason: 'Invalid Accept-Language header'
    });
  }

  // Check Accept-Encoding
  const acceptEnc = headersLower['accept-encoding'] || '';
  if (acceptEnc && !acceptEnc.includes('gzip') && !acceptEnc.includes('deflate')) {
    detections.push({
      category: 'bot',
      score: 0.2,
      confidence: 0.3,
      reason: 'Unusual Accept-Encoding'
    });
  }

  return detections;
}

// =============================================================================
// Browser Consistency Checks
// =============================================================================

const BOT_UA_PATTERNS = [
  /bot/i, /spider/i, /crawler/i, /scraper/i, /curl/i, /wget/i,
  /python/i, /java\//i, /httpie/i, /postman/i, /insomnia/i,
  /axios/i, /node-fetch/i, /go-http/i, /okhttp/i
];

function parseUserAgent(ua) {
  const info = { browser: null, os: null, isMobile: false, isBot: false, botName: null };
  if (!ua) return info;

  // Check for bots
  for (const pattern of BOT_UA_PATTERNS) {
    const match = ua.match(pattern);
    if (match) {
      info.isBot = true;
      info.botName = match[0];
      return info;
    }
  }

  // Detect browser
  if (ua.includes('Edg/')) info.browser = 'Edge';
  else if (ua.includes('Chrome/')) info.browser = 'Chrome';
  else if (ua.includes('Firefox/')) info.browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) info.browser = 'Safari';

  // Detect OS
  if (ua.includes('Windows')) info.os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) info.os = 'macOS';
  else if (ua.includes('Linux')) info.os = 'Linux';
  else if (ua.includes('Android')) { info.os = 'Android'; info.isMobile = true; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { info.os = 'iOS'; info.isMobile = true; }

  if (ua.includes('Mobile')) info.isMobile = true;

  return info;
}

function checkBrowserConsistency(ua, signals) {
  if (!ua) return [];
  const detections = [];
  const uaInfo = parseUserAgent(ua);

  // If UA is a known bot
  if (uaInfo.isBot) {
    detections.push({
      category: 'bot',
      score: 0.9,
      confidence: 0.95,
      reason: `User-Agent indicates bot: ${uaInfo.botName}`
    });
    return detections;
  }

  const env = (signals && signals.environmental) || {};
  const nav = env.navigator || {};
  const automation = env.automationFlags || {};
  const platform = nav.platform || automation.platform || '';

  // Check platform consistency
  if (uaInfo.os === 'Windows' && !platform.includes('Win')) {
    detections.push({
      category: 'bot',
      score: 0.6,
      confidence: 0.7,
      reason: `UA/platform mismatch: UA claims Windows, platform=${platform}`
    });
  }

  if (uaInfo.os === 'macOS' && !platform.includes('Mac')) {
    detections.push({
      category: 'bot',
      score: 0.6,
      confidence: 0.7,
      reason: `UA/platform mismatch: UA claims macOS, platform=${platform}`
    });
  }

  if (uaInfo.os === 'Linux' && !platform.includes('Linux')) {
    detections.push({
      category: 'bot',
      score: 0.6,
      confidence: 0.7,
      reason: `UA/platform mismatch: UA claims Linux, platform=${platform}`
    });
  }

  // Check mobile consistency
  const maxTouch = nav.maxTouchPoints || automation.maxTouchPoints || 0;
  if (uaInfo.isMobile && maxTouch === 0) {
    detections.push({
      category: 'bot',
      score: 0.5,
      confidence: 0.6,
      reason: 'UA claims mobile but no touch support'
    });
  }

  // Check Chrome-specific properties
  if (uaInfo.browser === 'Chrome' && !automation.chrome) {
    detections.push({
      category: 'bot',
      score: 0.7,
      confidence: 0.8,
      reason: 'UA claims Chrome but window.chrome missing'
    });
  }

  return detections;
}

// =============================================================================
// Risk Scoring
// =============================================================================

/**
 * Calculates a risk score based on HTTP request characteristics and client signals.
 * Returns a value between 0.0 (Human) and 1.0 (Bot).
 * 
 * Weights:
 * - 0.5 for navigator.webdriver being true
 * - 0.3 for Datacenter IP ranges
 * - 0.2 for suspicious headers like x-requested-with
 * 
 * @param {Object} req - Express request object
 * @param {Object} signals - Decrypted client payload signals
 * @returns {number} The risk score
 */
function calculateRiskScore(req, signals) {
  let score = 0.0;
  
  // 1. Check navigator.webdriver (Weight: 0.5)
  const env = (signals && signals.environmental) || {};
  const nav = env.navigator || {};
  if (nav.webdriver === true) {
    score += 0.5;
  }

  // 2. Check Datacenter IP ranges (Weight: 0.3)
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
  if (isDatacenterIP(ip)) {
    score += 0.3;
  }

  // 3. Check suspicious headers like x-requested-with (Weight: 0.2)
  const headers = req.headers || {};
  let hasSuspiciousHeader = false;
  
  // Convert headers to lowercase for case-insensitive check
  const headersLower = {};
  for (const [key, value] of Object.entries(headers)) {
    headersLower[key.toLowerCase()] = value;
  }
  
  // Specific check for x-requested-with as requested, but also other suspicious headers
  if (headersLower['x-requested-with']) {
    hasSuspiciousHeader = true;
  } else {
    for (const header of SUSPICIOUS_HEADERS) {
      if (header in headersLower) {
        hasSuspiciousHeader = true;
        break;
      }
    }
  }

  if (hasSuspiciousHeader) {
    score += 0.2;
  }

  // Cap score at 1.0
  return Math.min(score, 1.0);
}

module.exports = {
  isDatacenterIP,
  analyzeHeaders,
  parseUserAgent,
  checkBrowserConsistency,
  calculateRiskScore
};
