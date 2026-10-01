import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExtensionMessage,
  ExtensionMessageType,
  ProductScanResultPayload,
  NormalizedProduct,
  GenerationMode,
  UserSummary,
  TryOnJob,
  TryOnResult,
  TryOnJobStatus,
  CATEGORY_METADATA_MAP,
  ProfilePhotoType,
} from '@vton/shared';
import { apiClient } from './api/api-client.js';
import { ScanHeader } from './components/ScanHeader.js';
import { ProductCard } from './components/ProductCard.js';
import { ProductInspector } from './components/ProductInspector.js';
import { AuthModal } from './components/AuthModal.js';
import { JobProgress } from './components/JobProgress.js';
import { ResultViewer } from './components/ResultViewer.js';
import { HistoryView } from './components/HistoryView.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tryon' | 'profile' | 'wardrobe'>('tryon');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ProductScanResultPayload | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<NormalizedProduct | null>(null);
  const selectedProductRef = useRef<NormalizedProduct | null>(null);
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);

  const [scanError, setScanError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'INSPECTOR' | 'GRID'>('INSPECTOR');

  // Authentication State
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Digital Profile State
  const [profile, setProfile] = useState<any | null>(null);
  const [uploadingPhotoType, setUploadingPhotoType] = useState<string | null>(null);

  // Try-On Job & Result State
  const [activeJob, setActiveJob] = useState<TryOnJob | null>(null);
  const [activeResult, setActiveResult] = useState<TryOnResult | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  const pollingRef = useRef<number | null>(null);

  // 1. Check Authentication on Mount
  const checkAuth = useCallback(async () => {
    try {
      const stored = await apiClient.getStoredAuth();
      if (stored?.user) {
        setUser(stored.user);
        // Load user profile
        try {
          const prof = await apiClient.getProfile();
          setProfile(prof);
        } catch {
          // Profile may not exist yet or failed
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Helper to reliably find the active shopping tab
  const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) return null;

      const isWebTab = (t?: chrome.tabs.Tab) =>
        Boolean(t?.id && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));

      // 1. Try active tab in the last focused window (the window user is looking at)
      const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const focusedWebTab = focusedTabs.find(isWebTab);
      if (focusedWebTab) return focusedWebTab;

      // 2. Try active tab in the current window
      const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentWebTab = currentTabs.find(isWebTab);
      if (currentWebTab) return currentWebTab;

      // 3. Check any active tab across all windows that is an http/https shopping tab
      const allActiveTabs = await chrome.tabs.query({ active: true });
      const anyWebTab = allActiveTabs.find(isWebTab);
      if (anyWebTab) return anyWebTab;

      // Fallback: any active tab in current or focused window
      if (focusedTabs[0]?.id && !focusedTabs[0].url?.startsWith('chrome-extension://')) {
        return focusedTabs[0];
      }

      if (currentTabs[0]?.id && !currentTabs[0].url?.startsWith('chrome-extension://')) {
        return currentTabs[0];
      }

      return allActiveTabs[0] || null;
    } catch {
      return null;
    }
  };

  // 2. Trigger Webpage Product Detection Scan
  const scanActiveTab = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      setIsScanning(false);
      setScanError('Unable to identify active browser tab. Please click inside your shopping page and click Re-scan.');
      return;
    }

    const tabUrl = activeTab.url || '';
    if (
      tabUrl.startsWith('chrome://') ||
      tabUrl.startsWith('chrome-extension://') ||
      tabUrl.startsWith('edge://') ||
      tabUrl.startsWith('about:')
    ) {
      setIsScanning(false);
      setScanError(
        'You are currently on an internal browser settings page. Please open or switch to a shopping tab (e.g. Zara, Amazon, or our demo store at http://localhost:8089) and click Re-scan.'
      );
      return;
    }

    const tabId = activeTab.id;
    const sendMessageWithRetry = (retryAfterInject = true) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: ExtensionMessageType.TRIGGER_PRODUCT_DETECTION,
          payload: {},
          source: 'SIDE_PANEL',
          timestamp: Date.now(),
        } as ExtensionMessage,
        async (response) => {
          if (chrome.runtime.lastError) {
            // Attempt auto-injecting content script if page was open prior to extension reload
            if (retryAfterInject && chrome.scripting) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content-script.js'],
                });
                setTimeout(() => sendMessageWithRetry(false), 350);
                return;
              } catch (injectErr) {
                console.warn('[VTON Side Panel] Auto injection failed:', injectErr);
              }
            }

            setIsScanning(false);
            setScanError('Scanner could not connect to this webpage. Please refresh the shopping page and click Re-scan.');
            return;
          }

          setIsScanning(false);
          if (response?.success && response.data) {
            const data: ProductScanResultPayload = response.data;
            setScanResult(data);

            const currentSelected = selectedProductRef.current;
            const existingMatch = currentSelected
              ? data.products.find(
                  (p) =>
                    p.id === currentSelected.id ||
                    (p.sourceUrl && p.sourceUrl === currentSelected.sourceUrl) ||
                    (p.title && p.title === currentSelected.title)
                )
              : null;

            if (existingMatch) {
              setSelectedProduct(existingMatch);
            } else if (data.products.length === 1 || data.pageType === 'PDP') {
              setSelectedProduct(data.primaryProduct || data.products[0] || null);
              setViewMode('INSPECTOR');
            } else if (data.products.length > 1) {
              setSelectedProduct(data.primaryProduct || data.products[0] || null);
              if (!currentSelected) {
                setViewMode('GRID');
              }
            } else {
              setSelectedProduct(null);
              setViewMode('GRID');
            }
          } else {
            setScanError(response?.error || 'No products detected on this page.');
          }
        }
      );
    };

    sendMessageWithRetry();
  }, []);

  // Listen to navigation or DOM updates from content script and tab switching
  useEffect(() => {
    scanActiveTab();

    const messageListener = (message: ExtensionMessage) => {
      if (message.type === ExtensionMessageType.TAB_URL_CHANGED) {
        scanActiveTab();
      } else if (message.type === ExtensionMessageType.PRODUCT_DETECTION_RESULT) {
        const data = message.payload as ProductScanResultPayload;
        if (data && data.products) {
          setScanResult(data);
          const current = selectedProductRef.current;
          if (current) {
            const match = data.products.find(
              (p) =>
                p.id === current.id ||
                (p.sourceUrl && p.sourceUrl === current.sourceUrl) ||
                (p.title && p.title === current.title)
            );
            if (match) setSelectedProduct(match);
          }
        }
      }
    };

    const tabActivatedListener = () => {
      scanActiveTab();
    };

    if (typeof chrome !== 'undefined') {
      chrome.runtime?.onMessage.addListener(messageListener);
      chrome.tabs?.onActivated?.addListener(tabActivatedListener);
    }

    return () => {
      if (typeof chrome !== 'undefined') {
        chrome.runtime?.onMessage.removeListener(messageListener);
        chrome.tabs?.onActivated?.removeListener(tabActivatedListener);
      }
    };
  }, [scanActiveTab]);

  // Clean polling loop on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
      }
    };
  }, []);

  // 3. Polling Job Status
  const pollJobStatus = useCallback(
    (jobId: string) => {
      if (pollingRef.current) {
        window.clearTimeout(pollingRef.current);
      }

      const poll = async () => {
        try {
          const statusData = await apiClient.getTryOnJobStatus(jobId);
          setActiveJob(statusData);

          if (statusData.status === TryOnJobStatus.COMPLETED && statusData.result) {
            setActiveResult(statusData.result);
            setIsSubmittingJob(false);
            return; // Finished polling!
          }

          if (statusData.status === TryOnJobStatus.FAILED) {
            setIsSubmittingJob(false);
            setTryOnError(statusData.errorMessage || 'Virtual try-on could not be completed.');
            return;
          }

          // Continue polling every 1.8 seconds
          pollingRef.current = window.setTimeout(poll, 1800);
        } catch (err: any) {
          setIsSubmittingJob(false);
          setTryOnError(err.message || 'Error tracking try-on status.');
        }
      };

      pollingRef.current = window.setTimeout(poll, 1200);
    },
    []
  );

  // 4. Handle Try-On Submission
  const handlePrepareTryOn = async (product: NormalizedProduct, mode: GenerationMode) => {
    setTryOnError(null);

    // Guard 1: Must be authenticated
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    // Guard 2: Category readiness check
    const categoryMeta = CATEGORY_METADATA_MAP[product.category];
    const availablePhotos: ProfilePhotoType[] = profile?.images?.map((img: any) => img.photoType) || [];
    const hasRequired = availablePhotos.includes(categoryMeta.requiredProfilePhoto);
    const hasFallback = availablePhotos.includes(categoryMeta.fallbackProfilePhoto);

    if (!hasRequired && !hasFallback) {
      setTryOnError(
        `Your digital profile requires a ${categoryMeta.requiredProfilePhoto.replace(/_/g, ' ')} photo to try on ${categoryMeta.displayName}. Please add this photo in the Digital Profile tab.`
      );
      return;
    }

    const selectedImage =
      product.images.find((img) => img.id === product.selectedImageId) ||
      product.images[0];

    if (!selectedImage?.url) {
      setTryOnError('Please select a valid product image view to try on.');
      return;
    }

    setIsSubmittingJob(true);
    setActiveResult(null);

    try {
      const jobResponse = await apiClient.createTryOnJob({
        profileId: profile?.id,
        productId: product.id,
        selectedImageUrl: selectedImage.url,
        category: product.category,
        generationMode: mode,
        productTitle: product.title,
        sourceUrl: product.sourceUrl,
        sourceDomain: product.sourceDomain,
        price: product.price,
        currency: product.currency,
        brand: product.brand,
      });

      setActiveJob({
        id: jobResponse.jobId,
        userId: user.id,
        profileId: profile?.id || '',
        productId: product.id,
        category: product.category,
        status: jobResponse.status,
        generationMode: mode,
        progressPercent: 15,
        currentStage: 'QUEUED',
        createdAt: jobResponse.createdAt,
      });

      // Begin polling status
      pollJobStatus(jobResponse.jobId);
    } catch (err: any) {
      setIsSubmittingJob(false);
      setTryOnError(err.message || 'Failed to submit try-on request. Please try again.');
    }
  };

  // 5. Try On Another Product (Reuses profile without re-upload!)
  const handleTryAnotherProduct = () => {
    setActiveResult(null);
    setActiveJob(null);
    setTryOnError(null);
    if (scanResult && scanResult.products.length > 1) {
      setViewMode('GRID');
    } else {
      setViewMode('INSPECTOR');
    }
  };

  // 6. Handle Profile Photo Upload
  const handleProfilePhotoUpload = async (photoType: ProfilePhotoType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhotoType(photoType);
    try {
      await apiClient.uploadProfileAsset(photoType, file);
      // Reload updated profile
      const updated = await apiClient.getProfile();
      setProfile(updated);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingPhotoType(null);
    }
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setUser(null);
    setProfile(null);
    setActiveResult(null);
    setActiveJob(null);
  };

  // Evaluate current product category readiness
  const currentCategoryMeta = selectedProduct ? CATEGORY_METADATA_MAP[selectedProduct.category] : null;
  const availableProfilePhotos: ProfilePhotoType[] = profile?.images?.map((img: any) => img.photoType) || [];
  const isSelectedCategoryReady =
    currentCategoryMeta &&
    (availableProfilePhotos.includes(currentCategoryMeta.requiredProfilePhoto) ||
      availableProfilePhotos.includes(currentCategoryMeta.fallbackProfilePhoto));

  const displayProduct: NormalizedProduct | null =
    selectedProduct ||
    (activeResult
      ? {
          id: activeResult.jobId || 'completed-product',
          title:
            (activeResult.metadata as any)?.productTitle ||
            (activeResult.metadata as any)?.title ||
            'Tried-On Garment',
          description: '',
          price: undefined,
          currency: 'USD',
          brand: (activeResult.metadata as any)?.brand || '',
          sourceUrl: (activeResult.metadata as any)?.sourceUrl || '',
          sourceDomain: '',
          category: (activeResult.metadata as any)?.category || ('TOPS' as any),
          images: [
            {
              id: 'img-res',
              url:
                (activeResult.metadata as any)?.garmentImageUrl ||
                (activeResult.metadata as any)?.productImageUrl ||
                '',
              isPrimary: true,
              score: 1,
            },
          ],
          selectedImageId: 'img-res',
          variants: [],
          detectionConfidence: 1,
          metadata: {},
          extractedAt: new Date().toISOString(),
        }
      : null);

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '100vh' }}>
      {/* Extension Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
            AI Virtual Try-On
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Smart E-Commerce Shopping Assistant</p>
        </div>

        {/* User Auth Pill / Button */}
        <div>
          {!authLoading && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: '#c7d2fe',
                  background: 'rgba(99, 102, 241, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  maxWidth: '120px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={user.email}
              >
                {user.displayName || user.email.split('@')[0]}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '2px',
                }}
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--card-border)', paddingBottom: '6px' }}>
        <button
          onClick={() => setActiveTab('tryon')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tryon' ? '#818cf8' : 'var(--text-muted)',
            fontWeight: activeTab === 'tryon' ? '700' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
            borderBottom: activeTab === 'tryon' ? '2px solid #818cf8' : 'none',
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
            fontWeight: activeTab === 'profile' ? '700' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
            borderBottom: activeTab === 'profile' ? '2px solid #818cf8' : 'none',
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
            fontWeight: activeTab === 'wardrobe' ? '700' : '400',
            cursor: 'pointer',
            padding: '6px 10px',
            fontSize: '13px',
            borderBottom: activeTab === 'wardrobe' ? '2px solid #818cf8' : 'none',
          }}
        >
          Wardrobe
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 1. TRY-ON VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'tryon' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Scan Header with Active Domain */}
          <ScanHeader
            domain={scanResult?.sourceDomain || ''}
            pageType={scanResult?.pageType || 'UNKNOWN'}
            productCount={scanResult?.products.length || 0}
            isScanning={isScanning}
            onRescan={scanActiveTab}
          />

          {/* Active Body Profile Status Guidance */}
          <section className="glass-panel" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Reusable Profile Status
                </span>
                <p style={{ fontSize: '12px', fontWeight: '700', marginTop: '1px' }}>
                  {user ? (profile?.name || 'Default Profile') : 'No Active Profile'}
                </p>
              </div>

              {user ? (
                <span
                  style={{
                    fontSize: '10px',
                    background: isSelectedCategoryReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: isSelectedCategoryReady ? '#10b981' : '#f59e0b',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: '600',
                  }}
                >
                  {isSelectedCategoryReady ? '✓ Profile Ready (Reused)' : 'Missing Required Photo'}
                </span>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Sign in to activate
                </button>
              )}
            </div>

            {/* If missing required photo for current category, display prompt */}
            {user && selectedProduct && currentCategoryMeta && !isSelectedCategoryReady && (
              <div
                style={{
                  marginTop: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#fde68a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Requires a {currentCategoryMeta.requiredProfilePhoto.replace(/_/g, ' ')} photo.</span>
                <button
                  onClick={() => setActiveTab('profile')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#818cf8',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  Upload →
                </button>
              </div>
            )}
          </section>

          {/* Try-On Error Banner */}
          {tryOnError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 12px',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '12px',
                lineHeight: '1.4',
              }}
            >
              <strong>Notice:</strong> {tryOnError}
            </div>
          )}

          {/* Page Scanner Error State */}
          {scanError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px 14px',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ lineHeight: '1.4' }}>{scanError}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.create({ url: 'http://localhost:8089' });
                    } else {
                      window.open('http://localhost:8089', '_blank');
                    }
                  }}
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  👗 Open Demo Shop (Port 8089)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const tab = await getActiveTab();
                    if (tab?.id && typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.reload(tab.id, {}, () => {
                        setTimeout(() => scanActiveTab(), 600);
                      });
                    } else {
                      scanActiveTab();
                    }
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  ↻ Reload Page & Re-scan
                </button>
              </div>
            </div>
          )}

          {/* Active Job Progress Stepper */}
          {isSubmittingJob && activeJob && !activeResult && (
            <JobProgress
              job={activeJob}
              onRetry={selectedProduct ? () => handlePrepareTryOn(selectedProduct, GenerationMode.STANDARD) : undefined}
            />
          )}

          {/* Try-On Result Viewer */}
          {activeResult && displayProduct && !isSubmittingJob && (
            <ResultViewer
              result={activeResult}
              product={displayProduct}
              onTryAnother={handleTryAnotherProduct}
              onSaveToWardrobe={() => {
                alert('Saved to your Virtual Wardrobe! Accessible under the Wardrobe tab.');
              }}
            />
          )}

          {/* Product Inspector View */}
          {!activeResult && !isSubmittingJob && selectedProduct && viewMode === 'INSPECTOR' && (
            <ProductInspector
              product={selectedProduct}
              onBack={scanResult && scanResult.products.length > 1 ? () => setViewMode('GRID') : undefined}
              onUpdateProduct={(updated) => {
                setSelectedProduct(updated);
                if (scanResult) {
                  setScanResult({
                    ...scanResult,
                    products: scanResult.products.map((p) => (p.id === updated.id ? updated : p)),
                  });
                }
              }}
              onPrepareTryOn={handlePrepareTryOn}
              isSubmitting={isSubmittingJob}
            />
          )}

          {/* Discovered Products Grid View */}
          {!activeResult && !isSubmittingJob && scanResult && scanResult.products.length > 1 && viewMode === 'GRID' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Discovered Products ({scanResult.products.length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Select item to try on
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {scanResult.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedProduct?.id === product.id}
                    onSelect={(prod) => {
                      setSelectedProduct(prod);
                      setViewMode('INSPECTOR');
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isScanning && scanResult && scanResult.products.length === 0 && (
            <div className="glass-panel" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '6px' }}>No Products Detected</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                We couldn't detect any apparel or fashion items on this page. Try opening a product page or category catalog.
              </p>
              <button className="btn-primary" onClick={scanActiveTab} style={{ width: '100%' }}>
                Re-scan Page
              </button>
            </div>
          )}
        </main>
      )}

      {/* ========================================================================= */}
      {/* 2. DIGITAL BODY PROFILE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <section className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Reusable Digital Profile</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Upload your photos once. The system automatically reuses them for all future virtual try-ons across all supported shopping websites without repeated uploads.
            </p>
          </div>

          {!user ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Please sign in to view and manage your private body photos.
              </p>
              <button onClick={() => setIsAuthModalOpen(true)} className="btn-primary" style={{ fontSize: '12px' }}>
                Sign In / Register
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { type: 'FRONT_FULL_BODY' as ProfilePhotoType, label: 'Front Full-Body', forText: 'Dresses & Outerwear' },
                { type: 'UPPER_BODY' as ProfilePhotoType, label: 'Upper-Body', forText: 'T-Shirts & Jackets' },
                { type: 'LOWER_BODY' as ProfilePhotoType, label: 'Lower-Body', forText: 'Pants & Shorts' },
                { type: 'FEET' as ProfilePhotoType, label: 'Feet / Footwear', forText: 'Sneakers & Shoes' },
                { type: 'FACE' as ProfilePhotoType, label: 'Face / Neck', forText: 'Necklaces & Jewellery' },
              ].map((item) => {
                const existingAsset = profile?.images?.find((img: any) => img.photoType === item.type);
                const isUploading = uploadingPhotoType === item.type;

                return (
                  <div
                    key={item.type}
                    style={{
                      border: existingAsset ? '1px solid rgba(16, 185, 129, 0.4)' : '1px dashed var(--card-border)',
                      borderRadius: '8px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      background: existingAsset ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{item.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.forText}</span>

                    {existingAsset ? (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '600' }}>✓ Saved & Ready</span>
                      </div>
                    ) : (
                      <label
                        style={{
                          marginTop: '6px',
                          display: 'inline-block',
                          fontSize: '11px',
                          color: '#818cf8',
                          background: 'rgba(99, 102, 241, 0.15)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: isUploading ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        {isUploading ? 'Uploading...' : '+ Upload'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={isUploading}
                          onChange={(e) => handleProfilePhotoUpload(item.type, e)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. WARDROBE TAB */}
      {/* ========================================================================= */}
      {activeTab === 'wardrobe' && <HistoryView />}

      {/* Auth Modal Dialog */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          apiClient.getProfile().then(setProfile).catch(() => {});
        }}
      />
    </div>
  );
}
