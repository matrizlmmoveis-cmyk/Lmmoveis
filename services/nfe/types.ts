
export interface NFeIssuer {
    name: string;
    cnpj: string;
    state: string;
    ibge: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    cep: string;
}

export interface NFeDest {
    name: string;
    document: string;
    type: 'CPF' | 'CNPJ';
    email: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    ibge: string;
}

export interface NFeItem {
    description: string;
    ncm: string;
    cfop: string;
    unit: string;
    qty: number;
    unitValue: number;
    totalValue: number;
    code?: string;
}
