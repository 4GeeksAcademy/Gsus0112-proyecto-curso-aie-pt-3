import type { Carrier, ReturnItem } from '../types/models.js';
export declare const findCarrierByIdLinear: (carriers: Carrier[], targetId: string) => Carrier | null;
/**
 * Busca el indice de un retorno por ID en un arreglo ordenado.
 */
export declare const findReturnIndexBinary: (sortedReturns: ReturnItem[], targetId: string) => number;
/**
 * Compatibilidad con llamadas existentes: retorna el indice o -1.
 */
export declare const findReturnByIdBinary: (sortedReturns: ReturnItem[], targetId: string) => number;
//# sourceMappingURL=search.d.ts.map