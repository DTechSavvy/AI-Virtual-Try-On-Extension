import { ImageViewAngle } from '@vton/shared';
import { RawCandidateImage } from '../types.js';

const NOISE_TOKENS = [
  'logo',
  'icon',
  'sprite',
  'banner',
  'badge',
  'avatar',
  'social',
  'payment',
  'paypal',
  'visa',
  'mastercard',
  'rating',
  'star',
  'arrow',
  'loader',
  'spinner',
  'advertisement',
  'sponsored',
  'tracking',
  'pixel',
  'placeholder',
  'blank.gif',
  '1x1',
  'favicon',
];

export class ImageExtractor {
  /**
   * Harvest and filter potential product images from an element or document.
   */
  static extractImages(root: Element | Document): RawCandidateImage[] {
    const candidates: RawCandidateImage[] = [];
    const seenUrls = new Set<string>();

    const imgElements = root.querySelectorAll('img');

    imgElements.forEach((img) => {
      const rawUrl = this.resolveHighestResUrl(img);
      if (!rawUrl) return;

      const cleanUrl = this.cleanImageUrl(rawUrl);
      if (!cleanUrl || seenUrls.has(cleanUrl)) return;

      // Filter out non-product noise
      if (this.isNoise(img, cleanUrl)) return;

      const { width, height } = this.getImageDimensions(img);

      // Filter out images that are clearly too small
      if ((width && width < 120) || (height && height < 120)) {
        return;
      }

      // Check aspect ratio
      if (width && height) {
        const aspect = width / height;
        if (aspect < 0.25 || aspect > 3.0) return;
      }

      seenUrls.add(cleanUrl);
      candidates.push({
        url: cleanUrl,
        width,
        height,
        altText: img.alt?.trim() || undefined,
        sourceElement: img,
        viewAngle: this.detectViewAngle(cleanUrl, img.alt || ''),
      });
    });

    return candidates;
  }

  /**
   * Determine the highest-resolution URL available for an <img> element.
   */
  static resolveHighestResUrl(img: HTMLImageElement): string | null {
    // 1. Check parent <picture> element for <source srcset="...">
    if (img.parentElement && img.parentElement.tagName === 'PICTURE') {
      const source = img.parentElement.querySelector('source[srcset], source[data-srcset]');
      if (source) {
        const sourceSrcset = source.getAttribute('srcset') || source.getAttribute('data-srcset');
        if (sourceSrcset) {
          const parsed = this.parseSrcset(sourceSrcset);
          if (parsed) return parsed;
        }
      }
    }

    // 2. Check data-zoom or data-large attributes (common on PDPs)
    const zoomUrl =
      img.getAttribute('data-zoom-image') ||
      img.getAttribute('data-large-image') ||
      img.getAttribute('data-large') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-high-res') ||
      img.getAttribute('data-full-url') ||
      img.getAttribute('data-zoom-src') ||
      img.getAttribute('data-origin-src') ||
      img.getAttribute('data-desktop-src') ||
      img.getAttribute('data-lazy-src');
    if (zoomUrl) return zoomUrl;

    // 3. Parse srcset attributes
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      const parsed = this.parseSrcset(srcset);
      if (parsed) return parsed;
    }

    // 4. Fallback to data-src / currentSrc / src
    return (
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.currentSrc ||
      img.src ||
      img.getAttribute('src') ||
      null
    );
  }

  /**
   * Parse srcset string and return URL with the largest descriptor.
   */
  static parseSrcset(srcset: string): string | null {
    try {
      const entries = srcset.split(',').map((entry) => {
        const parts = entry.trim().split(/\s+/);
        const url = parts[0];
        let width = 0;
        if (parts[1]) {
          const match = parts[1].match(/^(\d+)w$/);
          if (match) width = parseInt(match[1], 10);
        }
        return { url, width };
      });

      entries.sort((a, b) => b.width - a.width);
      return entries[0]?.url || null;
    } catch {
      return null;
    }
  }

  /**
   * Strip dynamic thumbnail parameters to retrieve full-resolution asset.
   */
  static cleanImageUrl(url: string): string {
    try {
      let resolved = url.trim();
      if (resolved.startsWith('//')) {
        resolved = 'https:' + resolved;
      } else if (resolved.startsWith('/')) {
        resolved = (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '') + resolved;
      }

      // Amazon thumbnail stripper: e.g. ._AC_UL320_.jpg or ._AC_SR250,250_.jpg -> .jpg
      resolved = resolved.replace(/\._[A-Za-z0-9_,-]+_\.([a-z]+)$/i, '.$1');

      // Shopify thumbnail stripper: e.g. product_small.jpg or dress_480x480.png -> product.jpg / dress.png
      resolved = resolved.replace(/_(small|thumb|pico|icon|medium|compact|grande|\d+x\d*)\.([a-z]+)(\?.*)?$/i, '.$2');

      // Strip common tracking and analytics parameters
      try {
        const parsed = new URL(resolved);
        const searchParams = new URLSearchParams(parsed.search);
        const toDelete: string[] = [];
        for (const key of searchParams.keys()) {
          if (
            key.startsWith('utm_') ||
            key.startsWith('ref_') ||
            key === 'fbclid' ||
            key === 'gclid' ||
            key === '_ga'
          ) {
            toDelete.push(key);
          }
        }
        toDelete.forEach((k) => searchParams.delete(k));
        parsed.search = searchParams.toString();
        resolved = parsed.toString();
      } catch {
        // Fallback for non-standard relative URLs
      }

      return resolved;
    } catch {
      return url;
    }
  }

  /**
   * General check whether an image URL or dimensions indicate non-product noise.
   */
  static isNonProductImage(url: string, width?: number, height?: number): boolean {
    if ((width && width < 120) || (height && height < 120)) {
      return true;
    }

    const lower = url.toLowerCase();
    for (const token of NOISE_TOKENS) {
      if (lower.includes(token)) return true;
    }

    if (
      lower.startsWith('data:image/svg') ||
      lower.includes('.svg') ||
      lower.includes('base64,r0lgodlhaqaba')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Detect whether an image represents non-product noise (logo, badge, ad, etc.).
   */
  static isNoise(img: HTMLImageElement, url: string): boolean {
    const { width, height } = this.getImageDimensions(img);
    if (this.isNonProductImage(url, width, height)) return true;

    const textToCheck = `${url} ${img.className || ''} ${img.id || ''} ${img.alt || ''}`.toLowerCase();
    for (const token of NOISE_TOKENS) {
      if (textToCheck.includes(token)) return true;
    }

    return false;
  }

  /**
   * Determine viewing angle based on URL or alt text clues.
   */
  static detectViewAngle(url: string, alt: string = ''): ImageViewAngle {
    const text = `${url} ${alt}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    if (/\b(front|model|lookbook|main|hero)\b/.test(text)) return 'FRONT';
    if (/\b(back|rear|behind)\b/.test(text)) return 'BACK';
    if (/\b(side|profile|left|right|angle)\b/.test(text)) return 'SIDE';
    if (/\b(detail|close|swatch|texture|zoom|macro)\b/.test(text)) return 'DETAIL';
    if (/\b(flat|flatlay|ghost|packshot|lay)\b/.test(text)) return 'FLAT_LAY';
    return 'UNKNOWN';
  }

  static getImageDimensions(img: HTMLImageElement): { width?: number; height?: number } {
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (!width || !height) {
      const rect = img.getBoundingClientRect();
      width = Math.round(rect.width);
      height = Math.round(rect.height);
    }

    return {
      width: width > 0 ? width : undefined,
      height: height > 0 ? height : undefined,
    };
  }
}
