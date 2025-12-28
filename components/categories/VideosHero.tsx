'use client'

export default function VideosHero() {
  return (
    <section className="relative w-full bg-gradient-to-br from-gray-50 via-white to-gray-50/50 border-b border-gray-100 overflow-hidden">
      {/* Linha verde no topo */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500 z-10" />
      
      <div className="relative flex lg:flex-row flex-col min-h-[280px] lg:min-h-[320px]">
        {/* Conteúdo à esquerda */}
        <div className="lg:w-1/2 px-4 lg:px-8 xl:px-12 py-4 lg:py-6 flex items-center relative z-10">
          <div className="w-full max-w-2xl mx-auto lg:mx-0 space-y-2 lg:space-y-3">
            {/* Título */}
            <div className="space-y-1 lg:space-y-1.5">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                <span className="text-primary-500">Vídeos</span> e Clipes{' '}
                <span className="block">Isentos de Royalties</span>
              </h1>
              
              {/* Descrição */}
              <p className="text-sm lg:text-base text-gray-700 leading-relaxed max-w-2xl">
                Crie projetos de vídeo de nível profissional a partir de milhões de vídeos de estoque de alta qualidade filmados por cinegrafistas de todo o mundo.
              </p>
            </div>
          </div>
        </div>

        {/* Vídeo à direita - Ocupa metade direita e se estende até as bordas */}
        <div className="lg:w-1/2 relative aspect-[4/3] lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[50vw] overflow-hidden">
          {/* Gradiente de sobreposição no lado esquerdo para transição suave com o fundo */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 via-gray-50/30 to-transparent z-10 pointer-events-none lg:hidden" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent z-10 pointer-events-none hidden lg:block" />
          
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          >
            <source src="/images/video.webm" type="video/webm" />
            Seu navegador não suporta o elemento de vídeo.
          </video>
        </div>
      </div>
    </section>
  )
}
