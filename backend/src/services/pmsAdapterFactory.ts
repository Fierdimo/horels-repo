import MewsAdapter from './adapters/mewsAdapter';
// Import other adapters here as needed (e.g., CloudbedsAdapter, ResNexusAdapter)

export type SupportedPMS = 'mews' | 'cloudbeds' | 'resnexus';

export function pmsAdapterFactory(provider: SupportedPMS): any {
  switch (provider) {
    case 'mews':
      return new MewsAdapter();
    // case 'cloudbeds':
    //   return new CloudbedsAdapter();
    // case 'resnexus':
    //   return new ResNexusAdapter();
    default:
      throw new Error(`Unsupported PMS provider: ${provider}`);
  }
}
