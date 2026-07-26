export const RELEASE = Object.freeze({ version: '1.0.0', label: 'N1.0', edition: 'zenith', legacyEdition: 'lite', name: 'NusaMind Zenith', cli: 'Zenith Core CLI', lineage: ['R13.49.1','V13.49.2'] } as const);
export const LEGACY_RELEASE_ALIASES = Object.freeze(['R13.49.1','V13.49.2','13.49.1','13.49.2'] as const);
export type ReleaseInfo = typeof RELEASE;
