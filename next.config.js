/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Permitir requisições de origem cruzada da rede local durante desenvolvimento
  // Isso permite acessar o servidor de desenvolvimento de outros dispositivos na mesma rede
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      '192.168.15.114',
      // Adicionar outros IPs da rede local conforme necessário
    ],
  }),
  
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
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
    // Permitir imagens da própria API
    unoptimized: false,
    // Otimizações de performance para imagens
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 dias de cache
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
      
      // Ignorar módulos que só funcionam no servidor (evita erros de build)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
      }
    }
    
    // Ignorar módulo 'psd' durante análise estática do webpack
    // O módulo só será carregado dinamicamente no servidor quando necessário
    const webpack = require('webpack')
    config.plugins = config.plugins || []
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^psd$/,
      })
    )
    
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
