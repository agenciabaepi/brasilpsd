export default function GuidelinesPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Diretrizes de Parceiro BrasilPSD
        </h1>

        <div className="space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Qualidade e Originalidade
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Todos os recursos devem ser de alta qualidade e originais</li>
              <li>Não é permitido fazer upload de conteúdo copiado ou protegido por direitos autorais</li>
              <li>Os recursos devem ser úteis e relevantes para a comunidade de designers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Formato e Organização
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Mantenha seus arquivos organizados e bem nomeados</li>
              <li>Inclua previews e thumbnails de qualidade</li>
              <li>Use tags e categorias apropriadas para facilitar a busca</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Conteúdo Proibido
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Conteúdo ofensivo, discriminatório ou inadequado</li>
              <li>Material que viole direitos autorais ou propriedade intelectual</li>
              <li>Conteúdo que promova atividades ilegais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Comunidade e Respeito
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Mantenha um comportamento respeitoso com outros membros</li>
              <li>Responda a comentários e feedback de forma profissional</li>
              <li>Colabore de forma positiva com a comunidade</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Remuneração e Comissões
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>As comissões serão calculadas conforme o plano de assinatura do usuário</li>
              <li>Pagamentos serão processados mensalmente</li>
              <li>Mantenha seus dados bancários atualizados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Moderação
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Todos os recursos serão revisados antes da aprovação</li>
              <li>A equipe BrasilPSD se reserva o direito de remover conteúdo que viole as diretrizes</li>
              <li>Violadores recorrentes podem ter suas contas suspensas ou banidas</li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-primary-50 rounded-lg border border-primary-200">
            <p className="text-primary-800 font-medium">
              Ao se tornar um parceiro, você concorda em seguir todas as diretrizes acima. 
              O não cumprimento pode resultar na suspensão ou remoção da sua conta.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


