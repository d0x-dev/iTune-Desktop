/**
 * Extract clean artist name from various YouTube Music item metadata formats
 */
export function getArtistName(input) {
  if (!input) return 'Unknown Artist';

  // 1. If input is a string directly
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed && trimmed !== 'Unknown Artist') return trimmed;
  }

  // 2. If input is an array directly
  if (Array.isArray(input)) {
    const names = input
      .map((a) => (typeof a === 'object' ? a?.name : a))
      .filter((n) => n && typeof n === 'string' && n.trim().length > 0 && n !== 'Unknown Artist');
    if (names.length > 0) return names.join(', ');
  }

  // 3. If input is a track object with .artists array
  if (input.artists && Array.isArray(input.artists) && input.artists.length > 0) {
    const names = input.artists
      .map((a) => (typeof a === 'object' ? a?.name : a))
      .filter((n) => n && typeof n === 'string' && n.trim().length > 0 && n !== 'Unknown Artist');
    if (names.length > 0) {
      return names.join(', ');
    }
  }

  // 4. Check input.artist string
  if (
    input.artist &&
    typeof input.artist === 'string' &&
    input.artist.trim() &&
    input.artist !== 'Unknown Artist'
  ) {
    return input.artist.trim();
  }

  // 5. Check input.author
  if (input.author) {
    const authName = typeof input.author === 'object' ? input.author?.name : input.author;
    if (authName && typeof authName === 'string' && authName.trim() && authName !== 'Unknown Artist') {
      return authName.trim();
    }
  }

  // 6. Check input.byline (from player state)
  if (input.byline && typeof input.byline === 'string') {
    const parts = input.byline.split('•').map((p) => p.trim());
    if (parts.length > 0 && parts[0] && parts[0] !== 'Unknown Artist') {
      return parts[0];
    }
  }

  // 7. Parse from input.subtitle (e.g. "Video • The Weeknd & Anitta • 69M views")
  if (input.subtitle && typeof input.subtitle === 'string') {
    const parts = input.subtitle.split('•').map((p) => p.trim());
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase();
      if (['song', 'video', 'track', 'album', 'single', 'ep'].includes(first)) {
        return parts[1];
      }
      return parts[0];
    } else if (parts.length === 1 && parts[0]) {
      return parts[0];
    }
  }

  return 'YouTube Music';
}

/**
 * Format seconds to mm:ss
 */
export function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
