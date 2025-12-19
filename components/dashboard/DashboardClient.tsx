'use client'

import Card from '@/components/ui/Card'
import { Download, Heart, TrendingUp } from 'lucide-react'
import type { Profile, Download as DownloadType, Favorite } from '@/types/database'
import Link from 'next/link'
import { getS3Url } from '@/lib/aws/s3'

interface DashboardClientProps {
  user: Profile
  downloads: DownloadType[]
  favorites: Favorite[]
  stats: {
    totalDownloads: number
    totalFavorites: number
    recentDownloads: number
  }
}

export default function DashboardClient({ user, downloads, favorites, stats }: DashboardClientProps) {
  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Olá, {user.full_name || 'Usuário'}!
            </h1>
            <p className="text-gray-600">Bem-vindo ao seu painel pessoal</p>
          </div>
          <Link href="/settings">
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
              Configurações
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total de Downloads</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDownloads}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <Download className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Favoritos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFavorites}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <Heart className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Downloads Recentes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recentDownloads}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Downloads */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Downloads Recentes</h2>
              <Link href="/downloads" className="text-sm text-primary-600 hover:text-primary-700">
                Ver todos
              </Link>
            </div>
            {downloads.length > 0 ? (
              <div className="space-y-4">
                {downloads.map((download) => (
                  <div key={download.id} className="flex items-center space-x-4">
                    {download.resource?.thumbnail_url && (
                      <img
                        src={getS3Url(download.resource.thumbnail_url)}
                        alt={download.resource.title}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {download.resource?.title || 'Recurso'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(download.downloaded_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Nenhum download ainda</p>
            )}
          </Card>

          {/* Favorites */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Favoritos</h2>
              <Link href="/favorites" className="text-sm text-primary-600 hover:text-primary-700">
                Ver todos
              </Link>
            </div>
            {favorites.length > 0 ? (
              <div className="space-y-4">
                {favorites.map((favorite) => (
                  <div key={favorite.id} className="flex items-center space-x-4">
                    {favorite.resource?.thumbnail_url && (
                      <img
                        src={getS3Url(favorite.resource.thumbnail_url)}
                        alt={favorite.resource.title}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {favorite.resource?.title || 'Recurso'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Adicionado em {new Date(favorite.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Nenhum favorito ainda</p>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        {user.is_creator && (
          <Card className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/creator/upload">
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Enviar Novo Recurso
                </button>
              </Link>
              <Link href="/creator">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Ver Painel do Criador
                </button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

