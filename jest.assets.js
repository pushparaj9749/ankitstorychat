/**
 * Jest shim for binary imports (cover art) so tests can load the REAL
 * bundled-story registry (src/content/bundled.ts) instead of a hand-kept
 * copy that would silently drift from the APK contents.
 */
module.exports = 'test-file-stub';
