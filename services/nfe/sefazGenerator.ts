/**
 * SEFAZ TXT Generator (Adapted from Skill)
 * 
 * Gera o conteúdo no formato TXT Padrão SEFAZ para emissão de NF-e 4.0.
 */

import { NFeIssuer, NFeDest, NFeItem } from './types';

export class SEFAZTxtGenerator {

    private static formatField(value: any, maxLength?: number, decimals: number = 2): string {
        if (value === null || value === undefined) return '';
        let strValue = typeof value === 'number' ? value.toFixed(decimals) : String(value).trim();
        strValue = strValue.replace(/\|/g, ''); // Remove delimitadores
        if (maxLength && strValue.length > maxLength) strValue = strValue.substring(0, maxLength);
        return strValue;
    }

    private static cleanString(str: string): string {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "");
    }

    /**
     * Gera o arquivo TXT baseado nos dados da nota.
     */
    public static generate(
        issuer: NFeIssuer,
        dest: NFeDest,
        items: NFeItem[],
        nfeNumber: number = 1,
        nfeSeries: number = 1,
        environment: number = 2, // 1-Prod, 2-Homol
        taxRegime: number = 3    // 1-Simples, 3-Lucro Real
    ): string {
        const lines: string[] = [];

        // Cabeçalho
        lines.push('NOTAFISCAL|1');
        lines.push(`A|4.00||`);

        // B - Identificação
        const dhEmi = new Date().toISOString().split('.')[0] + '-03:00';
        lines.push(`B|33|${String(nfeNumber).padStart(8, '0')}|VENDA|55|${nfeSeries}|${nfeNumber}|${dhEmi}||1|1|${issuer.ibge}|1|1|0|${environment}|1|1|1|1|0|0|INTEGRADOR_v1.0|||`);

        // C - Emitente
        lines.push(`C|${this.formatField(issuer.name, 60)}|${this.formatField(issuer.name, 60)}|||||${taxRegime}|`);
        lines.push(`C02|${this.cleanString(issuer.cnpj)}|`);
        lines.push(`C05|${issuer.street}|${issuer.number}||${issuer.neighborhood}|${issuer.ibge}|${issuer.city}|${issuer.state}|${issuer.cep}|1058|BRASIL||`);

        // E - Destinatário
        lines.push(`E|${this.formatField(dest.name, 60)}|9||||${this.formatField(dest.email, 60)}|`);
        const docLine = dest.type === 'CNPJ' ? 'E02' : 'E03';
        lines.push(`${docLine}|${this.cleanString(dest.document)}|`);
        lines.push(`E05|${this.formatField(dest.street, 60)}|${dest.number}||${dest.neighborhood}|${dest.ibge}|${dest.city}|${dest.state}|${dest.cep}|1058|BRASIL||`);

        let totalVBC = 0;
        let totalVICMS = 0;
        let totalVPIS = 0;
        let totalVCOFINS = 0;

        // H - Itens
        items.forEach((item, index) => {
            const nItem = index + 1;
            const totalItem = item.totalValue;
            
            lines.push(`H|${nItem}||`);
            // I - Detalhes do Produto
            lines.push(`I|${nItem}|${item.code || 'SEM GTIN'}|SEM GTIN|${this.formatField(item.description, 120)}|${item.ncm}||${item.cfop}|${item.unit}|${this.formatField(item.qty, undefined, 4)}|${this.formatField(item.unitValue, undefined, 10)}|${this.formatField(totalItem)}|SEM GTIN||${item.unit}|${this.formatField(item.qty, undefined, 4)}|${this.formatField(item.unitValue, undefined, 10)}|||||1|||||||`);

            lines.push(`M||`);
            
            if (taxRegime === 1) {
                // Simples Nacional 102
                lines.push(`N|`);
                lines.push(`N10d|0|102|`);
                lines.push(`Q|`);
                lines.push(`Q04|07|`);
                lines.push(`S|`);
                lines.push(`S04|07|`);
            } else {
                // Lucro Real - CST 00 (ICMS), 01 (PIS/COFINS)
                const aliqICMS = 20.00; // RJ (18% + 2% FECP)
                const vICMS = Number((totalItem * (aliqICMS / 100)).toFixed(2));
                const aliqPIS = 1.65;
                const vPIS = Number((totalItem * (aliqPIS / 100)).toFixed(2));
                const aliqCOFINS = 7.60;
                const vCOFINS = Number((totalItem * (aliqCOFINS / 100)).toFixed(2));

                totalVBC += totalItem;
                totalVICMS += vICMS;
                totalVPIS += vPIS;
                totalVCOFINS += vCOFINS;

                lines.push(`N|`);
                lines.push(`N02|0|00|3|${this.formatField(totalItem)}|${this.formatField(aliqICMS)}|${this.formatField(vICMS)}|`);
                
                lines.push(`Q|`);
                lines.push(`Q02|01|${this.formatField(totalItem)}|${this.formatField(aliqPIS)}|${this.formatField(vPIS)}|`);
                
                lines.push(`S|`);
                lines.push(`S02|01|${this.formatField(totalItem)}|${this.formatField(aliqCOFINS)}|${this.formatField(vCOFINS)}|`);
            }
        });

        // W - Totais
        const total = items.reduce((acc, it) => acc + it.totalValue, 0);
        lines.push(`W|`);
        if (taxRegime === 1) {
            lines.push(`W02|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|`);
        } else {
            lines.push(`W02|${this.formatField(totalVBC)}|${this.formatField(totalVICMS)}|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|0.00|0.00|${this.formatField(totalVPIS)}|${this.formatField(totalVCOFINS)}|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|`);
        }

        // YA - Pagamento (Sem Pagamento)
        lines.push(`YA|`);
        lines.push(`YA01a|1|90|0.00|||`);

        return lines.join('\n');
    }
}
