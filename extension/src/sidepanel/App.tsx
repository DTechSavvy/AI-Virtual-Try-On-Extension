import React, { useState } from 'react';
import { ProductCategory, GenerationMode } from '@vton/shared';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tryon' | 'profile' | 'wardrobe'>('tryon');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(ProductCategory.TOPS);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(GenerationMode.STANDARD);

  const handleScanProducts = () => {
    setIsScanning(true);
    // Placeholder trigger until full Phase 4 integration
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Extension Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>AI Virtual Try-On</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cross-Website Shopping Assistant</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>Active</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('tryon')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tryon' ? '#818cf8' : 'var(--text-muted)',
            fontWeight: activeTab === 'tryon' ? '600' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
          }}
        >
          Try On
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'profile' ? '#818cf8' : 'var(--text-muted)',
            fontWeight: activeTab === 'profile' ? '600' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
          }}
        >
          Digital Profile
        </button>
        <button
          onClick={() => setActiveTab('wardrobe')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'wardrobe' ? '#818cf8' : 'var(--text-muted)',
            fontWeight: activeTab === 'wardrobe' ? '600' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
          }}
        >
          Wardrobe
        </button>
      </nav>

      {/* Main Tab Content */}
      {activeTab === 'tryon' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Active Profile Status */}
          <section className="glass-panel" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Active Body Profile
                </span>
                <p style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>Default Profile</p>
              </div>
              <span style={{ fontSize: '12px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px' }}>
                Ready
              </span>
            </div>
          </section>

          {/* Product Detection Trigger */}
          <section className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Detect products on the current shopping webpage to begin virtual try-on.
            </p>
            <button
              className="btn-primary"
              onClick={handleScanProducts}
              disabled={isScanning}
              style={{ width: '100%' }}
            >
              {isScanning ? 'Scanning Webpage...' : 'Scan Products on Page'}
            </button>
          </section>

          {/* Category & Mode Controls */}
          <section className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Product Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value as ProductCategory)}
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

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Generation Mode
              </label>
              <select
                value={generationMode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGenerationMode(e.target.value as GenerationMode)}
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
          </section>
        </main>
      )}

      {activeTab === 'profile' && (
        <section className="glass-panel" style={{ padding: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Digital Body Profile</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Upload your photographs once. The system will reuse them for all future try-on requests without re-uploading.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['Front Full-Body', 'Upper-Body', 'Lower-Body', 'Shoes / Feet'].map((item) => (
              <div
                key={item}
                style={{
                  border: '1px dashed var(--card-border)',
                  padding: '12px 8px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'wardrobe' && (
        <section className="glass-panel" style={{ padding: '14px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Virtual Wardrobe</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Your generated try-on visualizations and outfit comparisons will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
