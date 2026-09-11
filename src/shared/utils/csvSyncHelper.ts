/**
 * CSV Import Helper legado, mantido apenas por compatibilidade de API.
 * O fluxo ativo é importacaoColaboradores.ts + classificacaoInterativa.ts.
 */

import { Employee, ConstructionSite } from '../types';
import { getRowValue, parseDateCell } from './csvHandler';
type EmployeeSyncResult = {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  employeeId: string;
  matricula: string;
  nome: string;
  message: string;
};

/**
 * Extended result of CSV import with sync details
 */
export interface CSVSyncImportResult {
  success: boolean;
  totalRows: number;
  syncResults: EmployeeSyncResult[];
  statistics: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    successful: number;
    failed: number;
  };
  warnings: string[];
}

/**
 * Mantido somente para compatibilidade; não sincroniza colaboradores.
 * 
 * Expected CSV columns:
 * - Matricula / Matrícula / Employee ID
 * - Nome / Name
 * - Funcao / Função / Cargo / Job
 * - CPF
 * - Departamento / Departamento / Localização / Location
 * - DataAdmissao / Data Admissão / Hire Date
 * - Sede / Branch (KO, BE, MN, SP, RJ)
 * 
 * @param csvText The CSV content as string
 * @param constructionSites Array of construction sites for bigram matching
 * @param onProgress Optional callback for progress updates
 * @returns Result with sync statistics
 * 
 * @example
 * const file = document.getElementById('csv-file').files[0];
 * const text = await file.text();
 * const result = await parseAndSyncEmployeesFromCSV(text, sites);
 * console.log(`Created: ${result.statistics.created}, Updated: ${result.statistics.updated}`);
 */
export async function parseAndSyncEmployeesFromCSV(
  csvText: string,
  constructionSites: ConstructionSite[],
  onProgress?: (progress: { processed: number; total: number; percent: number }) => void
): Promise<CSVSyncImportResult> {
  const warnings: string[] = [];
  const employees: Partial<Employee>[] = [];
  const departmentMap: Record<string, string | undefined> = {};

  try {
    // Parse CSV using Papa Parse (you'll need to import Papa from 'papaparse')
    // For this example, we assume the CSV is already parsed into rows
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return {
        success: false,
        totalRows: 0,
        syncResults: [],
        statistics: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          successful: 0,
          failed: 0
        },
        warnings: ['CSV vazio ou sem dados']
      };
    }

    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

    // Find column indices
    const matriculaIndex = headers.findIndex(h => 
      h.includes('matricula') || h.includes('matrícula') || h.includes('employee') || h.includes('id')
    );
    const nomeIndex = headers.findIndex(h => 
      h.includes('nome') || h.includes('name')
    );
    const funcaoIndex = headers.findIndex(h => 
      h.includes('funcao') || h.includes('função') || h.includes('cargo') || h.includes('job')
    );
    const cpfIndex = headers.findIndex(h => h.includes('cpf'));
    const departamentoIndex = headers.findIndex(h => 
      h.includes('departamento') || h.includes('localização') || h.includes('location')
    );
    const dataAdmissaoIndex = headers.findIndex(h => 
      h.includes('data') && h.includes('admissao')
    );
    const sedeIndex = headers.findIndex(h => 
      h.includes('sede') || h.includes('branch')
    );

    if (matriculaIndex === -1 || nomeIndex === -1) {
      return {
        success: false,
        totalRows: 0,
        syncResults: [],
        statistics: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          successful: 0,
          failed: 0
        },
        warnings: ['Não encontrados headers obrigatórios: Matrícula, Nome']
      };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

      const matricula = parts[matriculaIndex]?.trim() || '';
      const nome = parts[nomeIndex]?.trim() || '';
      const funcao = parts[funcaoIndex]?.trim() || '';
      const cpf = parts[cpfIndex]?.trim() || '';
      const departamento = parts[departamentoIndex]?.trim() || '';
      const dataAdmissao = parts[dataAdmissaoIndex]?.trim() || new Date().toISOString().split('T')[0];
      const sede = parts[sedeIndex]?.trim() || 'KO';

      if (!matricula || !nome) {
        warnings.push(`Linha ${i + 1}: Matrícula ou Nome ausente, pulando linha`);
        continue;
      }

      const employee: Partial<Employee> = {
        matricula,
        nome,
        funcao,
        cpf,
        dataAdmissao: parseDateCell(dataAdmissao),
        sede: (sede as any) || 'KO'
      };

      employees.push(employee);

      if (departamento) {
        departmentMap[matricula] = departamento.toUpperCase();
      }
    }

    if (employees.length === 0) {
      return {
        success: false,
        totalRows: lines.length - 1,
        syncResults: [],
        statistics: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          successful: 0,
          failed: 0
        },
        warnings: ['Nenhum colaborador válido encontrado no CSV']
      };
    }

    return {
      success: false,
      totalRows: employees.length,
      syncResults: [],
      statistics: { total: 0, created: 0, updated: 0, skipped: 0, successful: 0, failed: employees.length },
      warnings: [...warnings, 'Fluxo legado descontinuado na Fase C. Use importacaoColaboradores.ts + classificacaoInterativa.ts.']
    };

  } catch (err: any) {
    return {
      success: false,
      totalRows: 0,
      syncResults: [],
      statistics: {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        successful: 0,
        failed: 0
      },
      warnings: [err.message || 'Erro ao processar CSV']
    };
  }
}

/**
 * Usage in EmployeeManagement component:
 * 
 * const handleImportCSV = async (file: File) => {
 *   setIsImporting(true);
 *   try {
 *     const csvText = await file.text();
 *     const result = await parseAndSyncEmployeesFromCSV(
 *       csvText,
 *       constructionSites,
 *       (progress) => {
 *         console.log(`${progress.processed}/${progress.total}`);
 *       }
 *     );
 * 
 *     if (result.success) {
 *       setImportFeedback({
 *         success: true,
 *         message: `✓ ${result.statistics.created} criados, ${result.statistics.updated} atualizados`
 *       });
 *       // Reload employees from Firestore
 *       const updated = await dbService.getAllEmployees();
 *       onUpdateEmployees(updated);
 *     } else {
 *       setImportFeedback({
 *         success: false,
 *         message: result.warnings.join('; ')
 *       });
 *     }
 *   } catch (err) {
 *     setImportFeedback({
 *       success: false,
 *       message: 'Erro ao importar CSV'
 *     });
 *   } finally {
 *     setIsImporting(false);
 *   }
 * };
 */
