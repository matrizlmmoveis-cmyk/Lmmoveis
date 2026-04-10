/**
 * NFEmail Service (Adapted from Skill)
 * 
 * Este serviço gerencia a comunicação com a API do portal NFEmail.
 * Requer configuração de CNPJ e API Key do emitente.
 */

export interface NFEmailConfig {
    cnpj: string;
    apiKey: string;
}

export interface NFEmailResponse {
    id?: string;
    nfe_id?: string;
    chave?: string;
    status?: string;
    message?: string;
    rawResponse?: string;
    [key: string]: any;
}

export const nfEmailService = {
    config: {
        cnpj: '',
        apiKey: ''
    },

    setConfig(config: NFEmailConfig) {
        this.config = config;
    },

    /**
     * Envia uma nota fiscal no formato TXT SEFAZ para o portal.
     * @param txtContent Conteúdo formatado em pipes (|) conforme padrão SEFAZ
     */
    async sendNFe(txtContent: string): Promise<NFEmailResponse> {
        if (!this.config.cnpj || !this.config.apiKey) {
            throw new Error("Credenciais do NFEmail não configuradas.");
        }

        const postData = new URLSearchParams({ "": txtContent }).toString();
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);

        try {
            const apiUrl = '/api/nfemail/ArquivoTXT/';

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": authHeader
                },
                body: postData
            });

            const responseText = await response.text();
            console.log(`NFEmail [${response.status}] Raw Response:`, responseText);

            if (!response.ok) {
                const allow = response.headers.get('Allow');
                const errorMsg = `Erro API NFEmail (${response.status}): ${responseText || 'Sem mensagem'}${allow ? ' - Métodos Permitidos: ' + allow : ''}`;
                throw new Error(errorMsg);
            }

            try {
                // Se a resposta for apenas um número (ID), retorna como objeto
                if (/^\d+$/.test(responseText.trim())) {
                    return { id: responseText.trim(), rawResponse: responseText };
                }
                const data = JSON.parse(responseText) as NFEmailResponse;
                return { ...data, rawResponse: responseText };
            } catch (e) {
                return { message: responseText, rawResponse: responseText } as NFEmailResponse;
            }
        } catch (error) {
            console.error("Erro na transmissão NFEmail:", error);
            throw error;
        }
    },

    /**
     * Consulta o status de uma nota pela chave de acesso ou ID interno.
     */
    async getNFeStatus(id: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = `/api/nfemail/NotasFiscais?id=${id}`;

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });
        return await response.text();
    },

    /**
     * Lista as notas fiscais do portal com filtros.
     */
    async listNFe(page: number = 1, limit: number = 20, filters: any = {}) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);

        let url = `/api/nfemail/NotasFiscais?page=${page}&limit=${limit}`;
        if (filters.numero) url += `&numero=${filters.numero}`;
        if (filters.status) url += `&status=${filters.status}`;

        const response = await fetch(url, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) throw new Error(`Erro ao listar notas: ${response.status}`);
        return await response.text();
    }
};
