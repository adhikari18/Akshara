/**
 * Static export for GitHub Pages.
 *
 * Project pages are served from a sub-path (https://<user>.github.io/<repo>/), so the
 * deploy workflow sets NEXT_PUBLIC_BASE_PATH=/<repo>. Locally it is empty and the app
 * runs at the root as usual.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@akshara/core', '@akshara/data'],
};

export default nextConfig;
