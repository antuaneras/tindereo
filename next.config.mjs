/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    cpus: 1,
    workerThreads: false,
    webpackBuildWorker: false
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true
  },
  ...(basePath ? { basePath } : {})
};

export default nextConfig;
