'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { Search, Filter, X, Download, Heart, Type, User, MessageSquare, Package } from 'lucide-react'
import Button from '@/components/ui/Button'
import { getS3Url } from '@/lib/aws/s3'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Image from 'next/image'
import { isSystemProfile } from '@/lib/utils/system'

interface FontsClientProps {
  initialResources: any[]
  categories: any[]
}

export default function FontsClient({ initialResources, categories }: FontsClientProps) {
  const [resources, setResources] = useState(initialResources)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [previewText, setPreviewText] = useState('')
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set())
  const [familyCounts, setFamilyCounts] = useState<{ [key: string]: number }>({})
  const supabase = createSupabaseClient()

  const filteredResources = resources.filter(resource => {
    const matchesSearch = !searchQuery || 
      resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategories = selectedCategories.length === 0 || 
      selectedCategories.includes(resource.category_id)
    
    return matchesSearch && matchesCategories
  })

  async function loadMore() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('resources')
        .select('*, creator:profiles!creator_id(*)')
        .eq('status', 'approved')
        .eq('resource_type', 'font')
        .order('download_count', { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1)

      if (data && data.length > 0) {
        setResources(prev => [...prev, ...data])
        setPage(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error loading more:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Carregar fonte no navegador para preview
  const loadFontForPreview = useCallback(async (resource: any) => {
    if (loadedFonts.has(resource.id)) return

    try {
      const fontUrl = getS3Url(resource.file_url)
      const fontName = `font-${resource.id.replace(/-/g, '')}`
      
      // Verificar se o estilo já existe
      const existingStyle = document.getElementById(`font-style-${resource.id}`)
      if (existingStyle) return
      
      // Criar @font-face dinamicamente
      const style = document.createElement('style')
      style.id = `font-style-${resource.id}`
      style.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}') format('${getFontFormat(resource.file_format)}');
          font-display: swap;
        }
      `
      document.head.appendChild(style)
      
      setLoadedFonts(prev => new Set([...prev, resource.id]))
    } catch (error) {
      console.error('Error loading font:', error)
    }
  }, [loadedFonts])

  // Intersection Observer para carregar fontes apenas quando visíveis
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const resourceId = entry.target.getAttribute('data-resource-id')
            if (resourceId) {
              const resource = resources.find(r => r.id === resourceId)
              if (resource) {
                loadFontForPreview(resource)
              }
            }
          }
        })
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    )

    // Observar todos os cards de fonte
    const fontCards = document.querySelectorAll('[data-font-card]')
    fontCards.forEach(card => observer.observe(card))

    return () => {
      fontCards.forEach(card => observer.unobserve(card))
    }
  }, [resources, loadFontForPreview])

  // Buscar contagens de famílias
  useEffect(() => {
    async function loadFamilyCounts() {
      const counts: { [key: string]: number } = {}
      
      for (const resource of filteredResources) {
        if (resource.resource_type === 'font') {
          const familyId = resource.font_family_id || resource.id
          
          if (!counts[familyId]) {
            try {
              const { count } = await supabase
                .from('resources')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .eq('resource_type', 'font')
                .or(`id.eq.${familyId},font_family_id.eq.${familyId}`)
              
              counts[familyId] = count || 1
            } catch (error) {
              console.error('Error loading family count:', error)
              counts[familyId] = 1
            }
          }
        }
      }
      
      setFamilyCounts(counts)
    }

    if (filteredResources.length > 0) {
      loadFamilyCounts()
    }
  }, [filteredResources, supabase])

  function getFontFormat(format: string): string {
    const formatMap: { [key: string]: string } = {
      'ttf': 'truetype',
      'otf': 'opentype',
      'woff': 'woff',
      'woff2': 'woff2',
      'eot': 'embedded-opentype'
    }
    return formatMap[format.toLowerCase()] || 'truetype'
  }

  function getFontName(resource: any): string {
    return `font-${resource.id.replace(/-/g, '')}`
  }


  async function handleDownload(resourceId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resource_id: resourceId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao baixar fonte')
      }

      // Baixar o arquivo
      if (data.download_url) {
        const link = document.createElement('a')
        link.href = data.download_url
        link.download = ''
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Download iniciado!')
      }
    } catch (error: any) {
      console.error('Error downloading font:', error)
      toast.error(error.message || 'Erro ao baixar fonte')
    }
  }

  async function handleDownloadFamily(resourceId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    try {
      toast.loading('Criando arquivo ZIP com a família completa...', { id: 'download-family' })

      const response = await fetch('/api/download/family', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Erro ao baixar família')
      }

      // Baixar o ZIP
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Obter nome do arquivo do header Content-Disposition
      const contentDisposition = response.headers.get('content-disposition')
      const fileName = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'font-family.zip'
        : 'font-family.zip'
      
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Família completa baixada com sucesso!', { id: 'download-family' })
    } catch (error: any) {
      console.error('Error downloading font family:', error)
      toast.error(error.message || 'Erro ao baixar família de fontes', { id: 'download-family' })
    }
  }

  // Função para verificar se a fonte tem família
  async function getFamilyCount(resource: any): Promise<number> {
    try {
      const familyId = resource.font_family_id || resource.id
      const { count } = await supabase
        .from('resources')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('resource_type', 'font')
        .or(`id.eq.${familyId},font_family_id.eq.${familyId}`)

      return count || 1
    } catch (error) {
      console.error('Error getting family count:', error)
      return 1
    }
  }

  // Buscar contadores de família para cada recurso
  useEffect(() => {
    const fetchFamilyCounts = async () => {
      const counts: { [key: string]: number } = {}
      for (const resource of resources) {
        const count = await getFamilyCount(resource)
        const familyId = resource.font_family_id || resource.id
        counts[familyId] = count
        // Também armazenar pelo ID do recurso para facilitar acesso
        counts[resource.id] = count
      }
      setFamilyCounts(counts)
    }
    
    if (resources.length > 0) {
      fetchFamilyCounts()
    }
  }, [resources])

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  // Filtrar apenas subcategorias de Fontes
  const fontCategories = (() => {
    // Encontrar a categoria principal "Fontes"
    const fontesCategory = categories.find(c => 
      !c.parent_id && (c.slug === 'fontes' || c.slug === 'fonts' || c.name.toLowerCase() === 'fontes')
    )
    
    if (!fontesCategory) {
      // Se não encontrar, retornar todas as categorias que têm parent_id (subcategorias)
      return categories.filter(c => c.parent_id)
    }
    
    // Retornar apenas as subcategorias de Fontes
    return categories.filter(c => c.parent_id === fontesCategory.id)
  })()

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Fontes</h1>
        <p className="text-gray-600">
          Explore nossa coleção de fontes gratuitas e premium
        </p>
      </div>

      {/* Campo de Preview de Texto */}
      <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Type className="h-5 w-5 text-primary-500" />
          <label className="text-sm font-semibold text-gray-700">
            Digite o texto para visualizar nas fontes:
          </label>
        </div>
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Digite seu texto aqui para ver como fica em cada fonte..."
          className="w-full h-14 px-4 bg-gray-50 border border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
        />
        <p className="mt-3 text-xs text-gray-500">
          Este texto será exibido em todas as fontes abaixo. Se deixar vazio, será exibido o nome da fonte.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-8 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar fontes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500/20 transition-all"
          />
        </div>

        {/* Categorias de Fontes */}
        {fontCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {fontCategories.map(category => (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategories.includes(category.id)
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de Fontes */}
      {filteredResources.length > 0 ? (
        <>
          <div className="space-y-0 mb-8">
            {filteredResources.map((resource) => {
              const fontName = getFontName(resource)
              const isFontLoaded = loadedFonts.has(resource.id)
              const isOfficial = resource.is_official || isSystemProfile(resource.creator_id)
              const creatorName = isOfficial 
                ? (resource.creator?.full_name || 'BrasilPSD') 
                : (resource.creator?.full_name || 'Desconhecido')
              const canLinkToProfile = !isOfficial && resource.creator_id && !isSystemProfile(resource.creator_id)
              
              // Verificar se é fonte principal de uma família
              const familyId = resource.font_family_id || resource.id
              // Uma fonte é principal se não tem font_family_id (é a primeira) OU se seu ID é igual ao font_family_id
              const isMainFont = !resource.font_family_id || resource.font_family_id === resource.id
              const familyCount = familyCounts[familyId] || familyCounts[resource.id] || 1
              const hasFamily = familyCount > 1

              return (
                <div
                  key={resource.id}
                  data-font-card
                  data-resource-id={resource.id}
                  className="bg-white border-b border-gray-200 hover:bg-gray-50/50 transition-colors"
                >
                  {/* Barra Superior com Nome e Criador */}
                  <div className="bg-primary-500 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {hasFamily && (
                        <div className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5">
                          <Package className="h-3 w-3" />
                          <span>Família ({familyCount})</span>
                        </div>
                      )}
                      <Link 
                        href={`/resources/${resource.id}`}
                        className="text-white font-semibold text-base hover:text-primary-100 transition-colors"
                      >
                        {resource.title}
                      </Link>
                      <span className="text-primary-100 text-sm">por</span>
                      {canLinkToProfile ? (
                        <Link
                          href={`/creator/${resource.creator_id}`}
                          className="text-white hover:text-primary-100 transition-colors font-medium flex items-center gap-1.5"
                        >
                          {creatorName}
                        </Link>
                      ) : (
                        <span className="text-white font-medium flex items-center gap-1.5">
                          {creatorName}
                          {isOfficial && (
                            <Image 
                              src="/images/verificado.svg" 
                              alt="Verificado" 
                              width={14} 
                              height={14} 
                              className="w-3.5 h-3.5" 
                            />
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-white/90 text-xs">
                      <span className="font-medium">
                        {formatNumber(resource.download_count || 0)} downloads
                      </span>
                      <span className="text-white/70">
                        {resource.file_format?.toUpperCase() || 'TTF'}
                      </span>
                      {resource.file_size && (
                        <span className="text-white/70">
                          {(resource.file_size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Preview da Fonte */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      {/* Preview Compacto */}
                      <div className="flex-1">
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 min-h-[70px] flex items-center">
                          <div
                            style={{
                              fontFamily: isFontLoaded ? `'${fontName}', sans-serif` : 'sans-serif',
                              fontSize: '28px',
                              lineHeight: '1.3',
                              textAlign: 'left',
                              wordBreak: 'break-word',
                            }}
                            className="text-gray-900 font-bold"
                          >
                            {previewText || resource.title}
                          </div>
                        </div>
                      </div>

                      {/* Informações e Ações Compactas */}
                      <div className="w-52 flex-shrink-0 space-y-2">
                        {/* Estatísticas Compactas */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span><strong className="text-gray-900">{formatNumber(resource.download_count || 0)}</strong> downloads</span>
                          <span><strong className="text-gray-900">{resource.file_format?.toUpperCase() || 'TTF'}</strong></span>
                          {resource.file_size && (
                            <span><strong className="text-gray-900">{(resource.file_size / 1024).toFixed(1)} KB</strong></span>
                          )}
                          <span><strong className="text-gray-900">{resource.is_premium ? 'Premium' : 'Grátis'}</strong></span>
                        </div>

                        {/* Descrição Compacta */}
                        {resource.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {resource.description}
                          </p>
                        )}

                        {/* Botões de Download Compactos */}
                        <div className="space-y-1.5">
                          {hasFamily && isMainFont && (
                            <button
                              onClick={(e) => handleDownloadFamily(resource.id, e)}
                              className="w-full px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Família ({familyCount})
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDownload(resource.id, e)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                              hasFamily && isMainFont
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                : 'bg-primary-500 hover:bg-primary-600 text-white'
                            }`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            {hasFamily && isMainFont ? 'Esta' : 'Baixar'}
                          </button>
                        </div>

                        {/* Link para Detalhes */}
                        <Link
                          href={`/resources/${resource.id}`}
                          className="block w-full text-center px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          Detalhes →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botão Carregar Mais */}
          {resources.length >= page * 50 && (
            <div className="text-center">
              <Button
                onClick={loadMore}
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Carregando...' : 'Carregar Mais'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Nenhuma fonte encontrada</p>
        </div>
      )}
    </div>
  )
}
