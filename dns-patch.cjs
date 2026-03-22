// Node 24 uses undici for global fetch - need to intercept at a different level
// Patch dns module AND intercept URL resolution
const dns = require('dns');
const net = require('net');
const tls = require('tls');

// Patch dns.lookup
const origLookup = dns.lookup.bind(dns);
dns.lookup = function(hostname, options, callback) {
  if (hostname === 'api.vercel.com') {
    const cb = typeof options === 'function' ? options : callback;
    cb(null, '76.76.21.112', 4);
    return;
  }
  return origLookup(hostname, options, callback);
};

// Patch dns.resolve4
const origResolve4 = dns.resolve4.bind(dns);
dns.resolve4 = function(hostname, options, callback) {
  if (hostname === 'api.vercel.com') {
    const cb = typeof options === 'function' ? options : callback;
    cb(null, ['76.76.21.112']);
    return;
  }
  return origResolve4(hostname, options, callback);
};

// Patch global fetch to replace api.vercel.com with IP + Host header
const origFetch = globalThis.fetch;
if (origFetch) {
  globalThis.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.includes('api.vercel.com')) {
      const newUrl = url.replace('api.vercel.com', '76.76.21.112');
      options.headers = options.headers || {};
      if (typeof options.headers === 'object') {
        options.headers['host'] = 'api.vercel.com';
      }
      return origFetch(newUrl, options);
    }
    return origFetch(url, options);
  };
}
