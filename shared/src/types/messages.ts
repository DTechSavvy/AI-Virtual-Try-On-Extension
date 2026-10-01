export enum ExtensionMessageType {
  TRIGGER_PRODUCT_DETECTION = 'TRIGGER_PRODUCT_DETECTION',
  PRODUCT_DETECTION_RESULT = 'PRODUCT_DETECTION_RESULT',
  RESCAN_PAGE = 'RESCAN_PAGE',
  SELECT_PRODUCT = 'SELECT_PRODUCT',
  TAB_URL_CHANGED = 'TAB_URL_CHANGED',
  AUTH_STATE_CHANGED = 'AUTH_STATE_CHANGED',
  START_TRY_ON = 'START_TRY_ON',
  JOB_STATUS_UPDATE = 'JOB_STATUS_UPDATE',
  GET_EXTENSION_STATUS = 'GET_EXTENSION_STATUS',
}

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload: T;
  source: 'CONTENT_SCRIPT' | 'SERVICE_WORKER' | 'SIDE_PANEL';
  timestamp: number;
}

export interface ProductScanResultPayload {
  pageType: 'PDP' | 'PLP' | 'UNKNOWN';
  pageTitle: string;
  sourceUrl: string;
  sourceDomain: string;
  primaryProduct?: import('./product.js').NormalizedProduct;
  products: import('./product.js').NormalizedProduct[];
  scannedAt: string;
}
