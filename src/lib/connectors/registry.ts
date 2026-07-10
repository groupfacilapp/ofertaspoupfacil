// src/lib/connectors/registry.ts
import type { MarketplaceConnector, DecryptedCredentials, ValidationResult, FetchConfig, NormalizedOffer } from './types';

// Stub used before real connectors are implemented in Wave 2.
// validateCredentials() on stubs returns valid: false with a clear message.
class StubConnector implements MarketplaceConnector {
  constructor(public readonly marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'temu' | 'shein') {}

  async fetchOffers(_config: FetchConfig): Promise<NormalizedOffer[]> {
    throw new Error(`${this.marketplace} connector not yet implemented`);
  }

  async generateAffiliateLink(_productUrl: string, _credentials: DecryptedCredentials): Promise<string> {
    throw new Error(`${this.marketplace} connector not yet implemented`);
  }

  async validateCredentials(_credentials: DecryptedCredentials): Promise<ValidationResult> {
    // Stubs always return invalid — Wave 2 replaces these with real connectors.
    return { valid: false, error: `Connector ${this.marketplace} not yet implemented` };
  }
}

// Registry is populated lazily. Wave 2 plans call registerConnector() with real implementations.
const connectorRegistry = new Map<string, MarketplaceConnector>();

export function registerConnector(connector: MarketplaceConnector): void {
  connectorRegistry.set(connector.marketplace, connector);
}

export function getConnector(marketplace: string): MarketplaceConnector {
  const connector = connectorRegistry.get(marketplace);
  if (connector) return connector;
  // Fall back to stub if real connector not registered yet
  if (['amazon', 'mercadolivre', 'shopee', 'aliexpress', 'temu', 'shein'].includes(marketplace)) {
    return new StubConnector(marketplace as 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'temu' | 'shein');
  }
  throw new Error(`Unknown marketplace: ${marketplace}`);
}
