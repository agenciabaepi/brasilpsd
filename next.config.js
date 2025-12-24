/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Otimizações do webpack para reduzir avisos de cache
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Otimizar cache do webpack para reduzir avisos de serialização
      config.cache = {
        ...config.cache,
        compression: 'gzip',
        maxMemoryGenerations: 1,
      }
    }
    return config
  },
  
  // Configurações de cache otimizadas
  onDemandEntries: {
    // período em ms de quanto tempo manter as páginas em cache
    maxInactiveAge: 60 * 1000, // 1 minuto
    // número de páginas que devem ser mantidas simultaneamente
    pagesBufferLength: 5,
  },
}

module.exports = nextConfig
