import { NextRequest, NextResponse } from 'next/server'
import dns from 'dns'
import { promisify } from 'util'

const resolveTxt = promisify(dns.resolveTxt)

export const dynamic = 'force-dynamic'

/**
 * Verifica registros DNS (SPF, DKIM, DMARC)
 * GET /api/auth/check-dns
 */
export async function GET(request: NextRequest) {
  const domain = 'brasilpsd.com.br'
  const results: Record<string, any> = {
    domain,
    timestamp: new Date().toISOString(),
    checks: {},
  }

  try {
    // Verificar SPF
    try {
      const spfRecords = await resolveTxt(domain)
      const flatRecords = spfRecords.flat()
      const spfRecord = flatRecords.find((record: string) => record.startsWith('v=spf1'))
      
      results.checks.spf = {
        found: !!spfRecord,
        record: spfRecord || null,
        allRecords: flatRecords,
      }
    } catch (error: any) {
      results.checks.spf = {
        found: false,
        error: error.message,
      }
    }

    // Verificar DMARC
    try {
      const dmarcRecords = await resolveTxt(`_dmarc.${domain}`)
      const dmarcRecord = dmarcRecords.flat().join('')
      
      results.checks.dmarc = {
        found: !!dmarcRecord,
        record: dmarcRecord || null,
      }
    } catch (error: any) {
      results.checks.dmarc = {
        found: false,
        error: error.message,
      }
    }

    // Verificar DKIM (tentar alguns nomes comuns)
    const dkimNames = [
      'default._domainkey',
      'hostinger._domainkey',
      'mail._domainkey',
      'selector1._domainkey',
      'selector2._domainkey',
    ]

    results.checks.dkim = {
      found: false,
      records: [],
    }

    for (const dkimName of dkimNames) {
      try {
        const dkimRecords = await resolveTxt(`${dkimName}.${domain}`)
        if (dkimRecords && dkimRecords.length > 0) {
          results.checks.dkim.found = true
          results.checks.dkim.records.push({
            name: dkimName,
            record: dkimRecords.flat().join(''),
          })
        }
      } catch (error: any) {
        // Ignorar erros de DNS (registro não encontrado)
      }
    }

    // Resumo
    const allConfigured = 
      results.checks.spf?.found &&
      results.checks.dmarc?.found &&
      results.checks.dkim?.found

    results.summary = {
      allConfigured,
      spfConfigured: results.checks.spf?.found || false,
      dmarcConfigured: results.checks.dmarc?.found || false,
      dkimConfigured: results.checks.dkim?.found || false,
      recommendation: allConfigured
        ? 'DNS configurado corretamente. Se emails ainda não chegam, verifique reputação do domínio.'
        : 'DNS não está completamente configurado. Configure SPF, DKIM e DMARC para melhorar entregabilidade no Gmail.',
    }

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      results,
    }, { status: 500 })
  }
}

