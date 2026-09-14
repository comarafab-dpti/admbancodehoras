/**
 * Utilitário central de tenancy — resolução de canteiro e comparação de escopo.
 * Todas as funções client-side de filtragem por canteiro/sede devem usar estas
 * funções para garantir comportamento consistente entre telas.
 */

/**
 * Extrai o canteiro/sede de um documento, percorrendo os campos possíveis
 * em ordem de prioridade. Retorna o primeiro valor não-vazio encontrado.
 */
export function extractCanteiro(doc: any): string | null {
  if (!doc) return null;
  const raw =
    (doc.sedeCodigo || '').trim() ||
    (doc.employeeSede || '').trim() ||
    (doc.sede || '').trim() ||
    (doc.sede_atual || '').trim() ||
    (doc.sedeAtual || '').trim() ||
    (doc.secaoCanteiro || '').trim() ||
    (doc.uoExecucaoCodigo || '').trim() ||
    '';
  return raw || null;
}

/**
 * Verifica se um documento pertence ao escopo do usuário.
 *
 * - Perfis globais (SUPER_ADMIN, RH_ADMIN) veem tudo.
 * - canteiro_sede "TODAS", vazio, null ou undefined = escopo global.
 * - Documento sem canteiro = bloqueado para usuários restritos.
 * - Comparação case-insensitive e flexível (igualdade, prefixo com hífen, inclusão).
 */
export function matchesTenancy(
  userCanteiro: string | null | undefined,
  userRole: string,
  docCanteiro: string | null | undefined
): boolean {
  if (['SUPER_ADMIN', 'RH_ADMIN'].includes(userRole)) return true;

  const uc = (userCanteiro || '').trim().toUpperCase();
  if (uc === '' || uc === 'TODAS') return true;

  const dc = (docCanteiro || '').trim().toUpperCase();
  if (dc === '') {
    if (import.meta.env.DEV) {
      console.warn('[Tenancy] Doc sem canteiro bloqueado:', docCanteiro);
    }
    return false;
  }

  const result =
    uc === dc ||
    dc.startsWith(uc + '-') ||
    uc.startsWith(dc + '-') ||
    dc.includes(uc) ||
    uc.includes(dc);

  if (import.meta.env.DEV) {
    console.group('[Tenancy][DEBUG]');
    console.log('userCanteiro:', uc);
    console.log('userRole:', userRole);
    console.log('docCanteiro:', dc);
    console.log('resultado:', result);
    console.groupEnd();
  }

  return result;
}

/**
 * Log condicional de tenancy para desenvolvimento.
 * Emite aviso adicional quando o filtro resulta em zero documentos.
 */
export function logTenancy(
  label: string,
  userCanteiro: string | null | undefined,
  userRole: string,
  total: number,
  filtrado: number
): void {
  if (!import.meta.env.DEV) return;
  console.log(`[Tenancy] ${label} user=${userCanteiro}, role=${userRole}, total=${total}, filtrado=${filtrado}`);
  if (filtrado === 0 && total > 0) {
    console.warn(`[Tenancy] ATENÇÃO: usuário vê 0 de ${total} em ${label}!`);
  }
}
