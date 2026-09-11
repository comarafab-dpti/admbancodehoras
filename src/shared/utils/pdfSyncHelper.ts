/**
 * PDF Payroll Import Helper legado, mantido apenas por compatibilidade de API.
 * A importação de contracheques não atualiza mais colaboradores.
 */

import { Employee, PaystubRecord, ConstructionSite } from '../types';
type EmployeeSyncResult = {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  employeeId: string;
  matricula: string;
  nome: string;
  message: string;
};

/**
 * Extended result of PDF import with sync details
 */
export interface PDFSyncImportResult {
  success: boolean;
  totalPaystubs: number;
  totalUnregisteredEmployees: number;
  syncResults: EmployeeSyncResult[];
  statistics: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    successful: number;
    failed: number;
  };
  unregisteredEmployees: Array<{
    matricula: string;
    nome: string;
    cargo: string;
    sede: string;
  }>;
  warnings: string[];
}

/**
 * Converte dados para compatibilidade, sem sincronizar colaboradores.
 * 
 * This function:
 * 1. Extracts employee data from PaystubRecords
 * 2. Maps the PDF "sede" field to department code for bigram matching
 * 3. A atualização de colaboradores fica fora deste fluxo descontinuado
 * 4. Preserves original Firestore IDs on updates
 * 
 * @param paystubs Array of PaystubRecord objects extracted from PDF
 * @param constructionSites Array of construction sites for bigram matching
 * @param onProgress Optional callback for progress updates
 * @returns Result with sync statistics
 * 
 * @example
 * const paystubs = await parsePaystubsFromPDF(pdfFile);
 * const result = await syncPaystubsToEmployees(
 *   paystubs.paystubs,
 *   constructionSites,
 *   (progress) => console.log(`${progress.percent}%`)
 * );
 * console.log(`Criados: ${result.statistics.created}`);
 */
export async function syncPaystubsToEmployees(
  paystubs: PaystubRecord[],
  constructionSites: ConstructionSite[],
  onProgress?: (progress: { processed: number; total: number; percent: number }) => void
): Promise<PDFSyncImportResult> {
  const warnings: string[] = [];
  const employees: Partial<Employee>[] = [];
  const departmentMap: Record<string, string | undefined> = {};
  const unregisteredEmployees: Array<{
    matricula: string;
    nome: string;
    cargo: string;
    sede: string;
  }> = [];

  try {
    // Convert PaystubRecords to Employee objects
    for (const paystub of paystubs) {
      const matricula = paystub.matricula?.trim();
      const nome = paystub.nome?.trim();
      const cargo = paystub.cargo?.trim();
      const sede = paystub.sede?.trim() || 'KO';
      const cpf = paystub.cpf?.trim();

      if (!matricula || !nome) {
        warnings.push(`Contracheque sem matrícula ou nome válidos, pulando`);
        continue;
      }

      // If CPF is missing, track as unregistered
      if (!cpf) {
        unregisteredEmployees.push({
          matricula,
          nome,
          cargo,
          sede
        });
        warnings.push(`Colaborador ${matricula} sem CPF no contracheque`);
        continue;
      }

      const employee: Partial<Employee> = {
        matricula,
        nome,
        funcao: cargo || 'Técnico de Manutenção',
        cargo: cargo || 'Técnico de Manutenção',
        cpf,
        sede: (sede as any) || 'KO',
        // Use dataAdmissao from paystub if available
        dataAdmissao: paystub.dataInicio || new Date().toISOString().split('T')[0]
      };

      employees.push(employee);

      // Map matricula to sede (department code for bigram matching)
      // The "sede" field in the paystub acts as the location/department code
      if (sede) {
        departmentMap[matricula] = sede.toUpperCase();
      }
    }

    if (employees.length === 0) {
      return {
        success: false,
        totalPaystubs: paystubs.length,
        totalUnregisteredEmployees: unregisteredEmployees.length,
        syncResults: [],
        statistics: {
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          successful: 0,
          failed: 0
        },
        unregisteredEmployees,
        warnings: ['Nenhum colaborador válido encontrado nos contracheques']
      };
    }

    return {
      success: false,
      totalPaystubs: paystubs.length,
      totalUnregisteredEmployees: unregisteredEmployees.length,
      syncResults: [],
      statistics: { total: 0, created: 0, updated: 0, skipped: 0, successful: 0, failed: employees.length },
      unregisteredEmployees,
      warnings: [...warnings, 'Sincronizacao legada de colaboradores descontinuada na Fase C.']
    };

  } catch (err: any) {
    return {
      success: false,
      totalPaystubs: paystubs.length,
      totalUnregisteredEmployees: unregisteredEmployees.length,
      syncResults: [],
      statistics: {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        successful: 0,
        failed: 0
      },
      unregisteredEmployees,
      warnings: [err.message || 'Erro ao processar contracheques']
    };
  }
}

/**
 * Usage in ImportContrachequeModal component:
 * 
 * import { parsePaystubsFromPDF } from '../utils/pdfParser';
 * import { syncPaystubsToEmployees } from '../utils/pdfSyncHelper';
 * 
 * const handleImportPDF = async (file: File) => {
 *   setIsImporting(true);
 *   try {
 *     // 1. Parse PDF
 *     const parseResult = await parsePaystubsFromPDF(file);
 * 
 *     if (parseResult.paystubs.length === 0) {
 *       setFeedback({
 *         type: 'error',
 *         message: 'Nenhum contracheque extraído do PDF'
 *       });
 *       return;
 *     }
 * 
 *     // 2. Sync paystubs to employees (creates/updates with deduplication)
 *     const syncResult = await syncPaystubsToEmployees(
 *       parseResult.paystubs,
 *       constructionSites,
 *       (progress) => {
 *         console.log(`Processando: ${progress.percent}%`);
 *       }
 *     );
 * 
 *     // 3. Save paystubs to Firestore
 *     const saveResults = await Promise.all(
 *       parseResult.paystubs.map(paystub =>
 *         dbService.savePaystubRecord(paystub)
 *       )
 *     );
 * 
 *     // 4. Display results
 *     if (syncResult.success) {
 *       setFeedback({
 *         type: 'success',
 *         message: `
 *           ✓ Contracheques: ${parseResult.paystubs.length}
 *           ✓ Colaboradores criados: ${syncResult.statistics.created}
 *           ✓ Colaboradores atualizados: ${syncResult.statistics.updated}
 *           ✗ Erros: ${syncResult.statistics.failed}
 *         `
 *       });
 * 
 *       // Reload employees
 *       const updated = await dbService.getAllEmployees();
 *       onUpdateEmployees(updated);
 *     } else {
 *       setFeedback({
 *         type: 'warning',
 *         message: syncResult.warnings.join('; ')
 *       });
 *     }
 *
 *   } catch (err: any) {
 *     setFeedback({
 *       type: 'error',
 *       message: `Erro ao importar contracheques: ${err.message}`
 *     });
 *   } finally {
 *     setIsImporting(false);
 *   }
 * };
 */
