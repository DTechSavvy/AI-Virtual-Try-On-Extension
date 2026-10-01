import { RawCandidate } from '../types.js';

export interface WebsiteAdapter {
  name: string;
  canHandle(url: URL): boolean;
  extractProducts(document: Document): RawCandidate[];
}
