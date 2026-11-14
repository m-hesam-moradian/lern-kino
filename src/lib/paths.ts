/**
 * Resolves static asset paths with Next.js basePath support for GitHub Pages.
 *
 * In local dev: basePath is "" -> withBasePath("/media/series/Friends (German Dub)/cover.jpg")
 * On GitHub Pages: basePath is "/lern-kino"
 * Safely URL-encodes path segments (e.g. spaces and parentheses) without double-encoding.
 */
export function withBasePath(path: string | null | undefined): string {
  if (!path) return '';

  // Return external URLs, protocol-relative URLs, and data/blob URIs untouched
  if (/^(?:https?:)?\/\/|^data:|^blob:/i.test(path)) {
    return path;
  }

  const rawBase = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const basePath = rawBase.replace(/\/+$/, ''); // Remove trailing slashes

  // Normalize input path to guarantee leading slash
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Prevent double-prepending if the path already starts with basePath
  if (basePath && (cleanPath === basePath || cleanPath.startsWith(`${basePath}/`))) {
    cleanPath = cleanPath.slice(basePath.length);
    if (!cleanPath.startsWith('/')) {
      cleanPath = `/${cleanPath}`;
    }
  }

  // Safely encode each segment (prevent double encoding by decoding first)
  const encodedSegments = cleanPath
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      try {
        return encodeURIComponent(decodeURIComponent(seg))
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
      } catch {
        return encodeURIComponent(seg)
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
      }
    })
    .join('/');

  return basePath ? `${basePath}${encodedSegments}` : encodedSegments;
}
