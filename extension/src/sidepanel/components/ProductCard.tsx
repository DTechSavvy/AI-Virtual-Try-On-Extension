import React from 'react';
import { NormalizedProduct } from '@vton/shared';

interface ProductCardProps {
  product: NormalizedProduct;
  isSelected: boolean;
  onSelect: (product: NormalizedProduct) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onSelect,
}) => {
  const primaryImage =
    product.images.find((img) => img.id === product.selectedImageId) ||
    product.images[0];

  const formattedPrice =
    product.price !== undefined
      ? `${product.currency || '$'}${product.price.toFixed(2)}`
      : undefined;

  return (
    <div
      onClick={() => onSelect(product)}
      style={{
        cursor: 'pointer',
        border: isSelected
          ? '2px solid #6366f1'
          : '1px solid var(--card-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        background: isSelected
          ? 'rgba(99, 102, 241, 0.15)'
          : 'rgba(30, 41, 59, 0.5)',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Product Thumbnail */}
      <div
        style={{
          width: '100%',
          height: '140px',
          background: '#0b0f19',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {primaryImage?.url ? (
          <img
            src={primaryImage.url}
            alt={product.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
            onError={(e) => {
              // Hide broken image placeholder
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            No image
          </div>
        )}

        {/* Confidence Badge */}
        <span
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            color: '#10b981',
            fontSize: '10px',
            fontWeight: '600',
            padding: '2px 6px',
            borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {Math.round(product.detectionConfidence * 100)}%
        </span>

        {/* Category Pill */}
        <span
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '6px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            color: '#818cf8',
            fontSize: '10px',
            fontWeight: '500',
            padding: '2px 6px',
            borderRadius: '6px',
          }}
        >
          {product.category}
        </span>
      </div>

      {/* Info Container */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-main)',
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={product.title}
        >
          {product.title}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          {formattedPrice && (
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>
              {formattedPrice}
            </span>
          )}
          {product.images.length > 1 && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {product.images.length} views
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
