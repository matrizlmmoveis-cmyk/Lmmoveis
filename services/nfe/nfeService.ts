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
    async sendNFe(txtContent: string) {
        if (!this.config.cnpj || !this.config.apiKey) {
            throw new Error("Credenciais do NFEmail não configuradas.");
        }

        const postData = "=" + encodeURIComponent(txtContent);
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);

        try {
            // Recomenda-se o uso de um Proxy para evitar erros de CORS no browser
            // Em ambiente de desenvolvimento Vite, deve-se configurar o dev server proxy
            const apiUrl = '/api/nfemail/NotasFiscais';

            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": authHeader
                },
                body: postData
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Erro API NFEmail (${response.status}): ${responseText}`);
            }

            return responseText;
        } catch (error) {
            console.error("Erro na transmissão NFEmail:", error);
            throw error;
        }
    },

    /**
     * Consulta o status de uma nota pela chave de acesso ou ID interno.
     */
    async getNFeStatus(keyOrId: string) {
        const authHeader = 'Basic ' + btoa(`${this.config.cnpj}:${this.config.apiKey}`);
        const apiUrl = `/api/nfemail/NotasFiscais/${keyOrId}`;

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
