/* ── Script errors, to the server's log ──────────────────────────────
   A script error in production used to vanish: nobody saw it until
   somebody complained. Each one now goes to POST /api/client-errors
   (routes/clientErrors.js), which writes a line to the host's log.

   Only what finds the bug: the message, the file without its query, the
   line and column, the page's path and a short stack. Nothing about the
   person. A given error is sent once per page, and at most ten a page,
   so a loop that throws cannot flood anything. Loaded first by boot.js,
   so it hears errors in the modules after it. */

'use strict';

const seen = new Set();
let sent = 0;

function report(message, source, line, col, stack) {
  if (sent >= 10) return;
  const key = message + '|' + source + '|' + line;
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({
    message: String(message).slice(0, 300),
    source: String(source || '').split(/[?#]/)[0].slice(0, 200),
    line: line | 0, col: col | 0,
    page: location.pathname,
    stack: String(stack || '').slice(0, 1200)
  });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (e) { /* reporting must never become the error */ }
}

window.addEventListener('error', e => {
  // No message: a failed image or script load, not a script error.
  // "Script error." is another site's script, which the browser hides.
  if (!e.message || e.message === 'Script error.') return;
  report(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack);
});

window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  report('Unhandled rejection: ' + ((r && r.message) || String(r)), '', 0, 0, r && r.stack);
});
