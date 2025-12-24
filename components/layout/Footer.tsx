import Link from 'next/link'
import { Facebook, Twitter, Instagram, Linkedin, Crown } from 'lucide-react'
import Logo from '@/components/ui/Logo'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center">
              <Logo variant="dark" />
            </Link>
            <p className="text-base text-gray-500 leading-relaxed">
              A maior comunidade de recursos criativos do Brasil. Baixe PSDs, vetores e fotos de alta qualidade para seus projetos.
            </p>
            <div className="flex space-x-4">
              <SocialLink href="#" icon={Instagram} />
              <SocialLink href="#" icon={Facebook} />
              <SocialLink href="#" icon={Twitter} />
              <SocialLink href="#" icon={Linkedin} />
            </div>
          </div>

          {/* Links */}
          <FooterSection title="Recursos">
            <FooterLink href="/explore">Todos os recursos</FooterLink>
            <FooterLink href="/categories/psd">Templates PSD</FooterLink>
            <FooterLink href="/categories/vetores">Vetores AI</FooterLink>
            <FooterLink href="/categories/fotos">Fotos Premium</FooterLink>
          </FooterSection>

          <FooterSection title="Comunidade">
            <FooterLink href="/creator">Painel do Criador</FooterLink>
            <FooterLink href="/signup">Seja um Criador</FooterLink>
            <FooterLink href="/premium">Planos Premium</FooterLink>
            <FooterLink href="/dashboard">Minha Conta</FooterLink>
          </FooterSection>

          <FooterSection title="Institucional">
            <FooterLink href="/premium">Planos e Preços</FooterLink>
            <FooterLink href="/collections">Coleções</FooterLink>
            <FooterLink href="/explore">Explorar Recursos</FooterLink>
            <FooterLink href="/dashboard">Suporte</FooterLink>
          </FooterSection>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} BrasilPSD. Todos os direitos reservados.
          </p>
          <div className="flex items-center space-x-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
            <span>Brasil</span>
            <span>Seguro</span>
            <span>100% Digital</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">{title}</h3>
      <ul className="space-y-4">
        {children}
      </ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-base text-gray-500 hover:text-secondary-500 transition-colors">
        {children}
      </Link>
    </li>
  )
}

function SocialLink({ href, icon: Icon }: { href: string, icon: any }) {
  return (
    <a href={href} className="h-9 w-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-secondary-50 hover:text-secondary-500 transition-all">
      <Icon className="h-4 w-4" />
    </a>
  )
}
