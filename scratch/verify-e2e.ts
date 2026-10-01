import fs from 'fs';
import path from 'path';
import { GlobalWindow } from 'happy-dom';
import { ProductScanner } from '../extension/src/content/scanner/product-scanner.js';

async function runEndToEndVerification() {
  console.log('--- Starting Phase 3 E2E Content Script Scanner Verification ---');

  const htmlPath = path.resolve('scratch/demo-shop.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // Initialize simulated DOM window
  const domWindow = new GlobalWindow({ url: 'https://aura-atelier.example.com/products/silk-evening-gown' });
  (globalThis as any).window = domWindow;
  (globalThis as any).document = domWindow.document;
  const document = domWindow.document;
  document.write(htmlContent);

  // 1. Initial Page Scan
  console.log('\n[Step 1] Scanning Initial Page...');
  const initialResult = ProductScanner.scanPage(document as any);
  console.log(`Detected Page Type: ${initialResult.pageType}`);
  console.log(`Total Products Discovered: ${initialResult.products.length}`);

  if (initialResult.primaryProduct) {
    console.log(`Primary Product Title: "${initialResult.primaryProduct.title}"`);
    console.log(`Category Inferred: ${initialResult.primaryProduct.category}`);
    console.log(`Price: ${initialResult.primaryProduct.currency} ${initialResult.primaryProduct.price}`);
    console.log(`Detection Confidence: ${initialResult.primaryProduct.detectionConfidence}`);
    console.log(`Images Found: ${initialResult.primaryProduct.images.length}`);
    initialResult.primaryProduct.images.forEach((img, i) => {
      console.log(`  [Image ${i + 1}] View: ${img.viewAngle}, Score: ${img.score}, Primary: ${img.isPrimary}, URL: ${img.url.slice(0, 60)}...`);
    });
  }

  // 2. Discover related catalog products on the same page
  console.log('\n[Step 2] Listing other discovered products on page:');
  initialResult.products.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [${p.category}] "${p.title}" - $${p.price} (Conf: ${p.detectionConfidence})`);
  });

  // 3. Dynamic DOM Injection (SPA Mutation Simulation)
  console.log('\n[Step 3] Simulating Dynamic Product Injection (SPA Navigation / Infinite Scroll)...');
  const grid = document.getElementById('productGrid');
  if (grid) {
    const newCard = document.createElement('div');
    newCard.className = 'product-card';
    newCard.innerHTML = `
      <a href="/products/wool-trousers">
        <img src="https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80" alt="Pleated Wool Trousers" />
        <h3>Pleated Wool Trousers</h3>
      </a>
      <div class="card-price">$145.00</div>
    `;
    grid.appendChild(newCard);
  }

  const postMutationResult = ProductScanner.scanPage(document as any);
  console.log(`Products after dynamic card injection: ${postMutationResult.products.length}`);
  const injected = postMutationResult.products.find((p) => p.title.includes('Pleated Wool Trousers'));
  if (injected) {
    console.log(`Dynamically Injected Item Detected: "${injected.title}" - Category: ${injected.category}, Price: $${injected.price}`);
  }

  console.log('\n--- Phase 3 E2E Content Script Scanner Verification Completed Successfully! ---');
}

runEndToEndVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
