'use client'

import Card from '@/components/ui/Card'
import { Gift, Share2, Users, DollarSign } from 'lucide-react'

export default function AffiliatePage() {
  return (
    <div className="py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Programa de Afiliados</h1>
          <p className="text-gray-600">Ganhe comissões indicando novos usuários</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Indicações</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Comissões</p>
                <p className="text-2xl font-bold text-gray-900">R$ 0,00</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Link de Afiliado</p>
                <p className="text-xs font-mono text-gray-500 truncate max-w-[150px]">
                  https://brasilpsd.com/ref/...
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Share2 className="h-6 w-6" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-8">
          <div className="text-center">
            <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Programa em Desenvolvimento</h2>
            <p className="text-gray-600 mb-6">
              O programa de afiliados estará disponível em breve. Você poderá ganhar comissões indicando novos usuários para a plataforma.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

