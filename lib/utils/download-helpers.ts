/**
 * Funções utilitárias puras para downloads (podem ser usadas em client components)
 * Estas funções não dependem de server-side code
 */

/**
 * Obtém o limite de downloads baseado no plano
 * 
 * @param plan - Nome do plano (free, lite, pro, plus)
 * @returns Limite de downloads por dia
 */
export function getDownloadLimitByPlan(plan: string | null | undefined): number {
  const normalizedPlan = (plan || 'free').toLowerCase()
  
  switch (normalizedPlan) {
    case 'lite':
      return 3
    case 'pro':
      return 10
    case 'plus':
      return 20
    case 'ultra':
      return 20
    case 'free':
    default:
      return 1
  }
}

/**
 * Formata o plano para exibição
 * 
 * @param plan - Nome do plano
 * @returns Nome formatado do plano
 */
export function formatPlanName(plan: string | null | undefined): string {
  const normalizedPlan = (plan || 'free').toLowerCase()
  
  const planNames: Record<string, string> = {
    free: 'Grátis',
    lite: 'Lite',
    pro: 'Pro',
    plus: 'Plus',
    ultra: 'Ultra'
  }

  return planNames[normalizedPlan] || 'Grátis'
}

