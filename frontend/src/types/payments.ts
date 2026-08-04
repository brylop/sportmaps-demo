export type PaymentProvider = 'wompi' | 'mercadopago';

export interface CheckoutSessionResponse {
    provider: PaymentProvider;
    publicKey: string | null;
    sandbox: boolean;
    reference: string;
    amountInCents: number;
    transactionAmount: number;
    grossAmount: number;
    baseAmount?: number;
    sportmapsFee?: number;
    feePct?: number;
    token?: string;
    reused?: boolean;
}

export interface ProviderInfo {
    provider: PaymentProvider;
    publicKey: string;
    sandbox: boolean;
    isDefault: boolean;
}
