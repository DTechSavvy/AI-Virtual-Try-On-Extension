import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/api-client.js';
import { TryOnResult } from '@vton/shared';

interface HistoryViewProps {
  onSelectResult?: (result: TryOnResult) => void;
}

const BlobThumbnail: React.FC<{ src: string; alt: string; style?: React.CSSProperties }> = ({ src, alt, style }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!src) return;
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setBlobUrl(src);
      return;
    }
    fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        if (isMounted) {
          setBlobUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        if (isMounted) setBlobUrl(src);
      });
    return () => {
      isMounted = false;
    };
  }, [src]);

  if (error || !blobUrl) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: 'var(--text-muted)',
          fontSize: '10px',
        }}
      >
        {error ? 'Image unavailable' : 'Loading...'}
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} style={style} onError={() => setError(true)} />;
};

export const HistoryView: React.FC<HistoryViewProps> = () => {
  const [results, setResults] = useState<TryOnResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<TryOnResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getHistory(1, 20);
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load wardrobe history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this virtual try-on result?')) return;

    setDeletingId(id);
    try {
      await apiClient.deleteResult(id);
      setResults((prev) => prev.filter((r) => r.id !== id));
      if (selectedResult?.id === id) {
        setSelectedResult(null);
      }
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Virtual Wardrobe</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Your generated try-on visualizations ({results.length})
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="btn-secondary"
          style={{ fontSize: '11px', padding: '4px 8px' }}
        >
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '10px 12px',
            borderRadius: '8px',
            color: '#fca5a5',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {loading && results.length === 0 && (
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              margin: '0 auto 10px',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading wardrobe collection...</p>
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="glass-panel" style={{ padding: '24px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>No Saved Looks Yet</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            When you complete virtual try-ons on supported shopping sites, your visual fits will appear here.
          </p>
        </div>
      )}

      {/* Grid of Results */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedResult(item)}
              className="glass-panel"
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '140px',
                  background: '#090d16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <BlobThumbnail
                  src={item.imageUrl}
                  alt={item.productTitle || 'Generated try-on'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ padding: '8px' }}>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={item.productTitle}
                >
                  {item.productTitle || 'Virtual Look'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#818cf8', fontWeight: '600' }}>
                    {item.category || 'Apparel'}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Delete look"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal Preview */}
      {selectedResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 150,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '340px',
              padding: '16px',
              position: 'relative',
              background: '#0f172a',
            }}
          >
            <button
              onClick={() => setSelectedResult(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', paddingRight: '20px' }}>
              {selectedResult.productTitle || 'Virtual Try-On Look'}
            </h3>

            <div
              style={{
                width: '100%',
                height: '280px',
                background: '#090d16',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}
            >
              <BlobThumbnail
                src={selectedResult.imageUrl}
                alt="Selected look"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={selectedResult.imageUrl}
                target="_blank"
                rel="noreferrer"
                download="virtual_look.webp"
                className="btn-primary"
                style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: '11px', padding: '8px' }}
              >
                ⬇ Download Look
              </a>
              <button
                onClick={(e) => handleDelete(e, selectedResult.id)}
                className="btn-secondary"
                style={{ color: '#f87171', fontSize: '11px', padding: '8px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
