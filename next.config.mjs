const isWindows = process.platform === "win32";

const nextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: isWindows,
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
