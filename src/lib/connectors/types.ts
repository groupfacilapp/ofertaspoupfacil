// src/lib/connectors/types.ts
// Shared types for all marketplace connectors.
// Wave 2 (amazon.ts, mercadolivre.ts, shopee.ts, aliexpress.ts) imports from here.

export interface DecryptedCredentials {
  // Amazon BR
  tag?: string;
  cookies?: string;
  // Mercado Livre
  tag_afiliado?: string;
  cookie_session?: string;
  // Shopee
  app_id?: string;
  secret?: string;
  // AliExpress
  tracking_id?: string;
  api_key?: string;
  app_secret?: string;
  // KaBuM! (Awin)
  publisher_id?: string;
  // Temu
  temu_share_id?: string;
  // Shein (via CJ Affiliate)
  cj_publisher_id?: string;
  cj_website_id?: string;
  cj_merchant_id?: string; // optional override for Shein's CJ merchant ID (default: 44161)
}

export interface NormalizedOffer {
  externalId: string;
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';
  title: string;
  currentPrice: number;     // BRL cents (integer — always Math.round(price * 100))
  originalPrice: number | null;
  discountPercent: number | null;
  imageUrl: string;
  productUrl: string;
  affiliateLink: string | null;
  condition: string | null;
  installments: string | null;
  category: string | null;
  sales: number | null;
  couponCode: string | null;
}

export interface FetchConfig {
  keywords: string[];
  categories: string[];
  minDiscount: number;
  maxPrice: number | null;
  minSales: number;
  page: number;
  credentials: DecryptedCredentials;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface MarketplaceConnector {
  readonly marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';
  fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]>;
  generateAffiliateLink(productUrl: string, credentials: DecryptedCredentials): Promise<string>;
  validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult>;
}
