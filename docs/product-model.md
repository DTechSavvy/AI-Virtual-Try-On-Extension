# Normalized Product Model Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** Core Data Model Specification  

---

## 1. Design Objectives

The Normalized Product Model provides a standardized, vendor-agnostic representation of apparel and accessory products extracted across arbitrary shopping websites.

Key criteria:
1. **Extensible Taxonomy:** New product categories can be registered dynamically without database migrations or extension re-compilation.
2. **Defensive Ingestion:** Websites often omit fields (e.g. missing prices, unparsed variants); the model treats non-essential fields as optional while ensuring necessary visual attributes exist for virtual try-on.
3. **Try-On Metadata Anchors:** Every category maps to an anatomical anchor region and default profile photo type.

---

## 2. Category Taxonomy & Mapping Matrix

```typescript
export enum ProductCategory {
  TOPS = 'TOPS',
  SHIRTS = 'SHIRTS',
  DRESSES = 'DRESSES',
  JACKETS = 'JACKETS',
  PANTS = 'PANTS',
  SHOES = 'SHOES',
  JEWELLERY = 'JEWELLERY',
  NECKLACES = 'NECKLACES',
  ACCESSORIES = 'ACCESSORIES',
  CUSTOM = 'CUSTOM', // For dynamic user-defined or future categories
}

export interface CategoryMetadata {
  displayName: string;
  targetBodyRegion: 'UPPER_BODY' | 'LOWER_BODY' | 'FULL_BODY' | 'FEET' | 'FACE_NECK' | 'CUSTOM';
  requiredProfilePhoto: 'FRONT_FULL_BODY' | 'UPPER_BODY' | 'LOWER_BODY' | 'FEET' | 'FACE';
  fallbackProfilePhoto: 'FRONT_FULL_BODY';
  aspectRatioGuidance: string;
}

export const CATEGORY_METADATA_MAP: Record<ProductCategory, CategoryMetadata> = {
  [ProductCategory.TOPS]: {
    displayName: 'T-Shirts & Tops',
    targetBodyRegion: 'UPPER_BODY',
    requiredProfilePhoto: 'UPPER_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '3:4 or 1:1',
  },
  [ProductCategory.SHIRTS]: {
    displayName: 'Shirts & Blouses',
    targetBodyRegion: 'UPPER_BODY',
    requiredProfilePhoto: 'UPPER_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '3:4',
  },
  [ProductCategory.DRESSES]: {
    displayName: 'Dresses & Jumpsuits',
    targetBodyRegion: 'FULL_BODY',
    requiredProfilePhoto: 'FRONT_FULL_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '9:16 or 3:4',
  },
  [ProductCategory.JACKETS]: {
    displayName: 'Jackets & Outerwear',
    targetBodyRegion: 'UPPER_BODY',
    requiredProfilePhoto: 'UPPER_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '3:4',
  },
  [ProductCategory.PANTS]: {
    displayName: 'Pants & Trousers',
    targetBodyRegion: 'LOWER_BODY',
    requiredProfilePhoto: 'LOWER_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '9:16 or 3:4',
  },
  [ProductCategory.SHOES]: {
    displayName: 'Shoes & Footwear',
    targetBodyRegion: 'FEET',
    requiredProfilePhoto: 'FEET',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '1:1 or 4:3',
  },
  [ProductCategory.JEWELLERY]: {
    displayName: 'Jewellery',
    targetBodyRegion: 'FACE_NECK',
    requiredProfilePhoto: 'FACE',
    fallbackProfilePhoto: 'UPPER_BODY',
    aspectRatioGuidance: '1:1',
  },
  [ProductCategory.NECKLACES]: {
    displayName: 'Necklaces & Pendants',
    targetBodyRegion: 'FACE_NECK',
    requiredProfilePhoto: 'FACE',
    fallbackProfilePhoto: 'UPPER_BODY',
    aspectRatioGuidance: '1:1',
  },
  [ProductCategory.ACCESSORIES]: {
    displayName: 'Accessories & Bags',
    targetBodyRegion: 'CUSTOM',
    requiredProfilePhoto: 'FRONT_FULL_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '1:1',
  },
  [ProductCategory.CUSTOM]: {
    displayName: 'Custom Category',
    targetBodyRegion: 'CUSTOM',
    requiredProfilePhoto: 'FRONT_FULL_BODY',
    fallbackProfilePhoto: 'FRONT_FULL_BODY',
    aspectRatioGuidance: '1:1',
  },
};
```

---

## 3. Normalized Product Model Interfaces

```typescript
export interface ProductImageCandidate {
  id: string;
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  isPrimary: boolean;
  score: number; // 0.0 - 1.0 confidence score
  viewAngle?: 'FRONT' | 'BACK' | 'SIDE' | 'DETAIL' | 'FLAT_LAY' | 'UNKNOWN';
}

export interface ProductVariant {
  id: string;
  name: string;
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface NormalizedProduct {
  id: string;
  sourceDomain: string;
  sourceUrl: string;
  title: string;
  description?: string;
  category: ProductCategory;
  userOverriddenCategory?: ProductCategory;
  brand?: string;
  price?: number;
  currency?: string;
  images: ProductImageCandidate[];
  selectedImageId: string;
  variants: ProductVariant[];
  selectedVariantId?: string;
  detectionConfidence: number; // 0.0 - 1.0
  metadata: Record<string, any>;
  extractedAt: string; // ISO 8601
}
```

---

## 4. Extensibility Mechanism for Future Categories

To add a new category (e.g., `HATS`, `BELTS`, `SUNGLASSES`):
1. Register the category identifier in the `ProductCategoryRegistry`.
2. Define the corresponding `CategoryMetadata` with anatomical target body region and required profile photograph mapping.
3. Add relevant detection keyword tokens to the `CategoryKeywordDictionary`.
4. The Chrome Extension UI dynamically populates dropdowns and badges directly from the registry without code modification.
