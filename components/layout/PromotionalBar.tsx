'use client'

import { Ticket, Clock, Gem, Files } from 'lucide-react'

const promotionalMessages = [
  {
    icon: Ticket,
    text: 'Vários formatos: PSD / Canva / Figma e Mockups'
  },
  {
    icon: Clock,
    text: 'Edite e publique em minutos!'
  },
  {
    icon: Gem,
    text: 'Foco no Brasil: Sazonal e Segmentos Locais'
  },
  {
    icon: Files,
    text: 'Biblioteca com novos arquivos todos os dias!'
  }
]

export default function PromotionalBar() {
  // Criar múltiplas cópias para garantir um loop infinito suave
  const messagesForLoop = [...promotionalMessages, ...promotionalMessages, ...promotionalMessages]

  return (
    <div className="relative w-full bg-black text-white overflow-hidden py-2.5">
      <div className="flex animate-scroll-infinite whitespace-nowrap">
        {messagesForLoop.map((message, index) => {
          const Icon = message.icon
          return (
            <div
              key={index}
              className="flex items-center gap-2 px-8 shrink-0"
            >
              <Icon className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">{message.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

