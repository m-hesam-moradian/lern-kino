/** @type {import('next').NextConfig} */

// Extract optional basePath (e.g. "/lern-kino" for GitHub Pages or "" for local dev)
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const basePath = rawBasePath
  ? (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`).replace(/\/+$/, '')
  : '';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
};

export default nextConfig;
