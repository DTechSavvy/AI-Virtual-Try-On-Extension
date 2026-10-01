import React, { useState } from 'react';
import { TryOnResult, NormalizedProduct } from '@vton/shared';

interface ResultViewerProps {
  result: TryOnResult;
  product: NormalizedProduct;
  onTryAnother: () => void;
  onSaveToWardrobe?: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  result,
  product,
  onTryAnother,
  onSaveToWardrobe,
}) => {
  const [viewOriginal, setViewOriginal] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const selectedImage =
    product?.images?.find((img) => img.id === product?.selectedImageId) ||
    product?.images?.[0] ||
    ({ url: (product as any)?.imageUrl || '' } as any);

  const handleSave = () => {
    setSaved(true);
    if (onSaveToWardrobe) onSaveToWardrobe();
  };

  const currentDisplayUrl = viewOriginal ? selectedImage?.url : result.imageUrl;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    setImageLoading(true);
    setImageError(false);

    if (!currentDisplayUrl) {
      setImageLoading(false);
      return;
    }

    if (currentDisplayUrl.startsWith('data:') || currentDisplayUrl.startsWith('blob:')) {
      setBlobUrl(currentDisplayUrl);
      setImageLoading(false);
      return;
    }

    // Convert to local blob URL to bypass Chrome extension CSP and mixed-content blocking
    fetch(currentDisplayUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
          });
          setImageError(false);
          setImageLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[ResultViewer] Blob conversion failed, falling back to direct URL:', err);
        if (isMounted) {
          setBlobUrl(currentDisplayUrl);
          setImageError(false);
          setImageLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentDisplayUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10b981', fontWeight: '700', letterSpacing: '0.05em' }}>
            ✓ Try-On Complete
          </span>
          <h2 style={{ fontSize: '14px', fontWeight: '700', marginTop: '1px' }}>Your Personalized Fit</h2>
        </div>
        <button
          onClick={() => setIsZoomOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '11px', padding: '4px 8px' }}
          title="Zoom to high resolution"
        >
          🔍 Zoom
        </button>
      </div>

      {/* Main Image Showcase with Before/After Toggle */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          height: '280px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
        }}
      >
        {imageLoading && (
          <div style={{ position: 'absolute', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="animate-spin">⏳</span> Loading visualization...
          </div>
        )}

        {imageError ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#f87171', fontSize: '12px' }}>
            <p style={{ fontWeight: '600', marginBottom: '8px' }}>Preview loading failed</p>
            <button
              onClick={() => {
                setImageError(false);
                setImageLoading(true);
                if (currentDisplayUrl) {
                  fetch(currentDisplayUrl)
                    .then((res) => res.blob())
                    .then((b) => {
                      setBlobUrl(URL.createObjectURL(b));
                      setImageLoading(false);
                    })
                    .catch(() => {
                      setBlobUrl(currentDisplayUrl);
                      setImageLoading(false);
                    });
                }
              }}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              ↻ Retry Load
            </button>
          </div>
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={product.title}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transition: 'opacity 0.2s ease',
              opacity: imageLoading ? 0 : 1,
            }}
          />
        ) : null}

        {/* View State Pill */}
        <span
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            color: viewOriginal ? '#38bdf8' : '#a855f7',
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {viewOriginal ? 'Original Product View' : 'AI Try-On Visualization'}
        </span>

        {/* Category Pill */}
        <span
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            color: '#10b981',
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '12px',
          }}
        >
          {product.category}
        </span>
      </div>

      {/* Before / After Toggle Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={() => setViewOriginal(false)}
          style={{
            padding: '8px',
            background: !viewOriginal ? '#6366f1' : 'rgba(30, 41, 59, 0.6)',
            color: '#fff',
            border: !viewOriginal ? '1px solid #818cf8' : '1px solid var(--card-border)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          ✨ Try-On Look
        </button>
        <button
          onClick={() => setViewOriginal(true)}
          style={{
            padding: '8px',
            background: viewOriginal ? '#38bdf8' : 'rgba(30, 41, 59, 0.6)',
            color: viewOriginal ? '#0f172a' : '#fff',
            border: viewOriginal ? '1px solid #38bdf8' : '1px solid var(--card-border)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          🛍️ Garment Only
        </button>
      </div>

      {/* Product Summary */}
      <section className="glass-panel" style={{ padding: '12px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '700', lineHeight: '1.4' }}>{product.title}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          {product.price !== undefined && (
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>
              {product.currency || '$'}{product.price.toFixed(2)}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Domain: <strong>{product.sourceDomain}</strong>
          </span>
        </div>
      </section>

      {/* Action Buttons: Try Another Product (reusing profile) & Save */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          className="btn-primary"
          onClick={onTryAnother}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <span>↻</span> Try On Another Product
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={saved}
            className="btn-secondary"
            style={{ width: '100%', fontSize: '12px' }}
          >
            {saved ? '✓ Saved to Wardrobe' : '🔖 Save to Wardrobe'}
          </button>
          <a
            href={result.imageUrl}
            target="_blank"
            rel="noreferrer"
            download="try_on_look.webp"
            className="btn-secondary"
            style={{ width: '100%', textAlign: 'center', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ⬇ Download
          </a>
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            onClick={() => setIsZoomOpen(false)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Close ✕
          </button>
          <img
            src={blobUrl || result.imageUrl}
            alt={product.title}
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
          />
        </div>
      )}
    </div>
  );
};
