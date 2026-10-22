export const RELEASE = Object.freeze({ version: '1.4.1', label: 'N1.4.1', edition: 'zenith', legacyEdition: 'lite', name: 'NusaMind Zenith', cli: 'Zenith Core CLI', lineage: ['N1.0','N1.1','N1.2','N1.3','N1.4'] } as const);
export const LEGACY_RELEASE_ALIASES = Object.freeze(['R13.49.1','V13.49.2','N1.0','N1.1','N1.2','N1.3','N1.4'] as const);
export type ReleaseInfo = typeof RELEASE;
