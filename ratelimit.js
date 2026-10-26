// Small in-memory rate limiter (one server process, so no shared store is needed).
// Counts are kept per key (e.g. IP address, or IP + email) inside a fixed time window.
const buckets = new Map();

function hit(key, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return b;
}
const peek = key => { const b = buckets.get(key); return b && b.reset > Date.now() ? b : null; };
const clear = key => buckets.delete(key);

// Drop expired entries now and then so memory stays small.
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k); }, 60_000).unref();

const minutes = ms => Math.max(1, Math.ceil(ms / 60_000));

// Express middleware: allow `max` requests per `windowMs` for each key returned by `keyOf(req)`.
function limit({ name, max, windowMs, keyOf = req => req.ip, message = 'Too many requests. Please wait a moment and try again.' }) {
  return (req, res, next) => {
    const key = `${name}:${keyOf(req)}`;
    const b = hit(key, windowMs);
    if (b.count > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - Date.now()) / 1000));
      return res.status(429).json({ error: message.replace('{minutes}', minutes(b.reset - Date.now())) });
    }
    next();
  };
}

// For password checks: only failures count, and a success clears them.
const failures = {
  blocked(key, max) { const b = peek(`fail:${key}`); return b && b.count >= max ? minutes(b.reset - Date.now()) : 0; },
  record(key, windowMs) { hit(`fail:${key}`, windowMs); },
  reset(key) { clear(`fail:${key}`); },
};

module.exports = { limit, failures };
