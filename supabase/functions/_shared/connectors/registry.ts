import type { MarketplaceConnector, DecryptedCredentials, ValidationResult, FetchConfig, NormalizedOffer } from './types.ts';

class StubConnector implements MarketplaceConnector {
  constructor(public readonly marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'temu' | 'shein' | 'kabum') {}

  async fetchOffers(_config: FetchConfig): Promise<NormalizedOffer[]> {
    throw new Error(`${this.marketplace} connector not yet implemented`);
  }

  async generateAffiliateLink(_productUrl: string, _credentials: DecryptedCredentials): Promise<string> {
    throw new Error(`${this.marketplace} connector not yet implemented`);
  }

  async validateCredentials(_credentials: DecryptedCredentials): Promise<ValidationResult> {
    return { valid: false, error: `Connector ${this.marketplace} not yet implemented` };
  }
}

const connectorRegistry = new Map<string, MarketplaceConnector>();

export function registerConnector(connector: MarketplaceConnector): void {
  connectorRegistry.set(connector.marketplace, connector);
}

export function getConnector(marketplace: string): MarketplaceConnector {
  const connector = connectorRegistry.get(marketplace);
  if (connector) return connector;
  if (['amazon', 'mercadolivre', 'shopee', 'aliexpress', 'temu', 'shein', 'kabum'].includes(marketplace)) {
    return new StubConnector(marketplace as 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'temu' | 'shein' | 'kabum');
  }
  throw new Error(`Unknown marketplace: ${marketplace}`);
}
