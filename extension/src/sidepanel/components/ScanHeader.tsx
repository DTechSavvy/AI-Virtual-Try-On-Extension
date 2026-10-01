import React from 'react';

interface ScanHeaderProps {
  domain: string;
  pageType: 'PDP' | 'PLP' | 'UNKNOWN';
  productCount: number;
  isScanning: boolean;
  onRescan: () => void;
}

export const ScanHeader: React.FC<ScanHeaderProps> = ({
  domain,
  pageType,
  productCount,
  isScanning,
  onRescan,
}) => {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>
            {domain || 'Active Shopping Tab'}
          </span>
          {pageType !== 'UNKNOWN' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: '600',
                background: pageType === 'PDP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: pageType === 'PDP' ? '#10b981' : '#818cf8',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {pageType === 'PDP' ? 'Product Page' : 'Catalog / Grid'}
            </span>
          )}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {isScanning
            ? 'Scanning page...'
            : productCount > 0
            ? `${productCount} item${productCount > 1 ? 's' : ''} detected`
            : 'No products detected'}
        </p>
      </div>

      <button
        onClick={onRescan}
        disabled={isScanning}
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
          fontSize: '11px',
          fontWeight: '500',
          padding: '6px 10px',
          borderRadius: '6px',
          cursor: isScanning ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {isScanning ? 'Scanning...' : '↻ Re-scan'}
      </button>
    </div>
  );
};
