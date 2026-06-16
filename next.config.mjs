const nextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: process.platform === "win32",
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
  }
};

export default nextConfig;
