import React, { useState } from 'react';
import {
  NormalizedProduct,
  ProductCategory,
  GenerationMode,
  CATEGORY_METADATA_MAP,
} from '@vton/shared';

interface ProductInspectorProps {
  product: NormalizedProduct;
  onBack?: () => void;
  onUpdateProduct: (updated: NormalizedProduct) => void;
  onPrepareTryOn: (product: NormalizedProduct, mode: GenerationMode) => void;
  isSubmitting?: boolean;
}

export const ProductInspector: React.FC<ProductInspectorProps> = ({
  product,
  onBack,
  onUpdateProduct,
  onPrepareTryOn,
  isSubmitting = false,
}) => {
  const [generationMode, setGenerationMode] = useState<GenerationMode>(GenerationMode.STANDARD);

  const selectedImage =
    product.images.find((img) => img.id === product.selectedImageId) ||
    product.images[0];

  const categoryMeta =
    CATEGORY_METADATA_MAP[product.category] ||
    CATEGORY_METADATA_MAP[ProductCategory.CUSTOM];

  const handleSelectImage = (imageId: string) => {
    onUpdateProduct({
      ...product,
      selectedImageId: imageId,
    });
  };

  const handleCategoryChange = (newCat: ProductCategory) => {
    onUpdateProduct({
      ...product,
      category: newCat,
      userOverriddenCategory: newCat,
    });
  };

  const handlePrepareClick = () => {
    onPrepareTryOn(product, generationMode);
  };

  const formattedPrice =
    product.price !== undefined
      ? `${product.currency || '$'}${product.price.toFixed(2)}`
      : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Bar / Navigation */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#818cf8',
            fontSize: '12px',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '500',
          }}
        >
          ← Back to discovered products
        </button>
      )}

      {/* Main Selected Image Showcase */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          height: '240px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
        }}
      >
        {selectedImage?.url ? (
          <img
            src={selectedImage.url}
            alt={product.title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            No image available
          </div>
        )}

        {/* View Angle Pill */}
        {selectedImage?.viewAngle && selectedImage.viewAngle !== 'UNKNOWN' && (
          <span
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(4px)',
              color: '#38bdf8',
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '6px',
            }}
          >
            {selectedImage.viewAngle} VIEW
          </span>
        )}

        {/* Confidence Badge */}
        <span
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            color: '#10b981',
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {Math.round(product.detectionConfidence * 100)}% Confidence
        </span>
      </div>

      {/* Multiple Image Reel (if product has >1 view) */}
      {product.images.length > 1 && (
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Available Views (Select for Try-On)
          </label>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {product.images.map((img) => (
              <div
                key={img.id}
                onClick={() => handleSelectImage(img.id)}
                style={{
                  width: '56px',
                  height: '56px',
                  flexShrink: 0,
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border:
                    img.id === product.selectedImageId
                      ? '2px solid #6366f1'
                      : '1px solid var(--card-border)',
                  background: '#090d16',
                  opacity: img.id === product.selectedImageId ? 1 : 0.65,
                  transition: 'all 0.15s ease',
                }}
              >
                <img
                  src={img.url}
                  alt={img.altText || 'Product view'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Title & Metadata */}
      <section className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.4' }}>
          {product.title}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {formattedPrice && (
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
              {formattedPrice}
            </span>
          )}
          {product.brand && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Brand: <strong style={{ color: 'var(--text-main)' }}>{product.brand}</strong>
            </span>
          )}
        </div>
      </section>

      {/* Category & Try-On Target Guidance */}
      <section className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Product Category (Auto-Detected)
          </label>
          <select
            value={product.category}
            onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
            style={{
              width: '100%',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid var(--card-border)',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            {Object.values(ProductCategory).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Anatomical Target Guidance */}
        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px 10px', borderRadius: '6px' }}>
          <p style={{ fontSize: '11px', color: '#c7d2fe', lineHeight: '1.4' }}>
            <strong>Target Anatomical View:</strong> {categoryMeta.targetBodyRegion.replace('_', ' ')}
            <br />
            <strong>Required Profile Photo:</strong> {categoryMeta.requiredProfilePhoto.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Generation Mode Selector */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Generation Mode
          </label>
          <select
            value={generationMode}
            onChange={(e) => setGenerationMode(e.target.value as GenerationMode)}
            style={{
              width: '100%',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid var(--card-border)',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            {Object.values(GenerationMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button
          className="btn-primary"
          onClick={handlePrepareClick}
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: '4px' }}
        >
          {isSubmitting ? 'Creating Try-On Job...' : '✨ Try On This Product'}
        </button>
      </section>
    </div>
  );
};
