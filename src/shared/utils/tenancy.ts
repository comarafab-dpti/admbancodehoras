/**
 * Utilitário central de tenancy — resolução de canteiro e comparação de escopo.
 * Todas as funções client-side de filtragem por canteiro/sede devem usar estas
 * funções para garantir comportamento consistente entre telas.
 */

/**
 * Extrai o canteiro/sede de um documento, percorrendo os campos possíveis
 * em ordem de prioridade. Retorna o primeiro valor truthy encontrado.
 */
export function extractCanteiro(doc: any): string | null {
  if (!doc) return null;
  return (
    doc.sedeCodigo ||
    doc.employeeSede ||
    doc.sede ||
    doc.sede_atual ||
    doc.secaoCanteiro ||
    null
  );
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
  if (!userCanteiro || userCanteiro === 'TODAS' || userCanteiro === '') return true;
  if (!docCanteiro) return false;

  const uc = userCanteiro.toUpperCase();
  const dc = docCanteiro.toUpperCase();

  return (
    uc === dc ||
    dc.startsWith(uc + '-') ||
    uc.startsWith(dc + '-') ||
    dc.includes(uc) ||
    uc.includes(dc)
  );
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
