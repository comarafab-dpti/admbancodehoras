export function normalizeMatricula(mat: string | undefined | null): string {
  if (!mat) return '';
  const clean = mat.toString().trim().toUpperCase().replace(/^0+/, '');
  return clean || '0';
}

export function formatMatriculaVisual(mat: string | undefined | null): string {
  if (!mat) return '';
  const clean = normalizeMatricula(mat);
  if (/^\d+$/.test(clean) && clean.length < 6) {
    return clean.padStart(6, '0');
  }
  return clean;
}
