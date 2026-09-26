export interface PaymentTransaction {
  from: string;
  to: string;
  data: string;
  value: string;
  chainId: string;
  deposit: boolean;
}

/** Immutable server quote displayed before any wallet request. All amounts are base units. */
export interface MerchantPayment {
  version: 1;
  sourceChainId: 8453;
  sourceToken: string;
  sourceAmount: string;
  sourceWallet: string;
  destinationChainId: 16661;
  recipient: string;
  minimumOutput: string;
  estimatedOutput: string;
  providerQuoteId: string;
  routeId: string;
  quotedAt: string;
  expiresAt: string;
  transactions: PaymentTransaction[];
}
