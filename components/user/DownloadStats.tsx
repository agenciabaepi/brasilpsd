'use client'

import { useState, useEffect } from 'react'
import { Download, TrendingUp, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import type { DownloadStatus } from '@/lib/utils/downloads'

interface DownloadStatsProps {
  userId: string
  onUpdate?: () => void
}

export default function DownloadStats({ userId, onUpdate }: DownloadStatsProps) {
  const [status, setStatus] = useState<DownloadStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)

      // Adicionar timestamp para forçar atualização quando necessário
      const url = forceRefresh 
        ? `/api/downloads/status?t=${Date.now()}`
        : '/api/downloads/status'

      const response = await fetch(url, {
        cache: forceRefresh ? 'no-store' : 'default'
      })
      if (!response.ok) {
        throw new Error('Erro ao buscar status de downloads')
      }

      const data = await response.json()
      setStatus(data)
    } catch (err: any) {
      console.error('Error fetching download status:', err)
      setError(err.message || 'Erro ao carregar estatísticas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000)

    // Listener para eventos de atualização de downloads
    const handleDownloadUpdate = () => {
      // Pequeno delay para garantir que o banco foi atualizado
      // Forçar refresh sem cache quando recebe evento de download
      setTimeout(() => fetchStatus(true), 500)
    }

    window.addEventListener('download-completed', handleDownloadUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('download-completed', handleDownloadUpdate)
    }
  }, [userId])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </Card>
    )
  }

  if (!status) {
    return null
  }

  const percentage = status.limit > 0 ? (status.current / status.limit) * 100 : 0
  const isNearLimit = percentage >= 80
  const isAtLimit = status.remaining === 0

  // Cores baseadas no status
  const progressColor = isAtLimit
    ? 'bg-red-500'
    : isNearLimit
    ? 'bg-yellow-500'
    : 'bg-primary-500'

  const planNames: Record<string, string> = {
    free: 'Grátis',
    lite: 'Lite',
    pro: 'Pro',
    plus: 'Plus',
    ultra: 'Ultra'
  }

  const planName = planNames[status.plan] || 'Grátis'

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Download className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Downloads do Dia
              </h3>
              <p className="text-sm text-gray-500">
                Plano: <span className="font-medium text-gray-700">{planName}</span>
              </p>
            </div>
          </div>
          {status.allowed && (
            <div className="flex items-center space-x-1 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Disponível</span>
            </div>
          )}
        </div>

        {/* Contador */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {status.current}
                <span className="text-xl font-normal text-gray-500">
                  {' '}/ {status.limit}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                downloads hoje
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">
                {status.remaining}
              </p>
              <p className="text-xs text-gray-500">
                restantes
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-300 ease-out`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {percentage.toFixed(0)}% utilizado
              </span>
              {isAtLimit && (
                <span className="text-red-600 font-medium">
                  Limite atingido
                </span>
              )}
              {isNearLimit && !isAtLimit && (
                <span className="text-yellow-600 font-medium">
                  Limite próximo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mensagem de Aviso */}
        {isAtLimit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Limite de downloads atingido
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Você já fez {status.current} de {status.limit} downloads hoje. O contador será resetado à meia-noite (horário de Brasília).
                </p>
                {status.plan !== 'ultra' && (
                  <p className="text-sm text-red-600 mt-2 font-medium">
                    💡 Considere fazer upgrade do seu plano para baixar mais recursos!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isNearLimit && !isAtLimit && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  Atenção: Limite próximo
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Você está próximo do limite. Restam apenas <strong>{status.remaining} download{status.remaining !== 1 ? 's' : ''}</strong> hoje.
                </p>
                {status.plan !== 'ultra' && status.remaining <= 2 && (
                  <p className="text-sm text-yellow-600 mt-2 font-medium">
                    💡 Faça upgrade do seu plano para baixar mais recursos!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mensagem informativa quando ainda há muitos downloads */}
        {!isNearLimit && !isAtLimit && status.remaining <= 5 && status.remaining > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Você tem {status.remaining} download{status.remaining !== 1 ? 's' : ''} restante{status.remaining !== 1 ? 's' : ''} hoje.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
