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
        nfeSeries: number = 1
    ): string {
        const lines: string[] = [];

        // Cabeçalho
        lines.push('NOTAFISCAL|1');
        lines.push(`A|4.00||`);

        // B - Identificação
        const dhEmi = new Date().toISOString().split('.')[0] + '-03:00';
        lines.push(`B|33|${String(nfeNumber).padStart(8, '0')}|VENDA|55|${nfeSeries}|${nfeNumber}|${dhEmi}||1|1|${issuer.ibge}|1|1|0|1|1|1|1|0|0|INTEGRADOR_v1.0|||`);

        // C - Emitente
        lines.push(`C|${this.formatField(issuer.name, 60)}|${this.formatField(issuer.name, 60)}|||||1|`);
        lines.push(`C02|${this.cleanString(issuer.cnpj)}|`);
        lines.push(`C05|${issuer.street}|${issuer.number}||${issuer.neighborhood}|${issuer.ibge}|${issuer.city}|${issuer.state}|${issuer.cep}|1058|BRASIL||`);

        // E - Destinatário
        lines.push(`E|${this.formatField(dest.name, 60)}|9||||${this.formatField(dest.email, 60)}|`);
        const docLine = dest.type === 'CNPJ' ? 'E02' : 'E03';
        lines.push(`${docLine}|${this.cleanString(dest.document)}|`);
        lines.push(`E05|${this.formatField(dest.street, 60)}|${dest.number}||${dest.neighborhood}|${dest.ibge}|${dest.city}|${dest.state}|${dest.cep}|1058|BRASIL||`);

        // H - Itens
        items.forEach((item, index) => {
            const nItem = index + 1;
            lines.push(`H|${nItem}||`);
            // I - Detalhes do Produto (Exemplo simplificado)
            lines.push(`I|${nItem}|SEM GTIN||${this.formatField(item.description, 120)}|${item.ncm}||${item.cfop}|${item.unit}|${this.formatField(item.qty, undefined, 4)}|${this.formatField(item.unitValue, undefined, 10)}|${this.formatField(item.totalValue)}|SEM GTIN||${item.unit}|${this.formatField(item.qty, undefined, 4)}|${this.formatField(item.unitValue, undefined, 10)}|||||1|||||||`);

            // Impostos básicos (Simples Nacional 102)
            lines.push(`M||`);
            lines.push(`N|`);
            lines.push(`N10d|0|102|`);
            lines.push(`Q|`);
            lines.push(`Q04|07|`);
            lines.push(`S|`);
            lines.push(`S04|07|`);
        });

        // W - Totais
        const total = items.reduce((acc, it) => acc + it.totalValue, 0);
        lines.push(`W|`);
        lines.push(`W02|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${this.formatField(total)}|0.00|`);

        // YA - Pagamento (Sem Pagamento)
        lines.push(`YA|`);
        lines.push(`YA01a|1|90|0.00|||`);

        return lines.join('\n');
    }
}
