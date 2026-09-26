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
  CUSTOM = 'CUSTOM',
}

export type TargetBodyRegion =
  | 'UPPER_BODY'
  | 'LOWER_BODY'
  | 'FULL_BODY'
  | 'FEET'
  | 'FACE_NECK'
  | 'CUSTOM';

export type ProfilePhotoType =
  | 'FRONT_FULL_BODY'
  | 'UPPER_BODY'
  | 'LOWER_BODY'
  | 'FEET'
  | 'FACE'
  | 'ADDITIONAL';

export interface CategoryMetadata {
  displayName: string;
  targetBodyRegion: TargetBodyRegion;
  requiredProfilePhoto: ProfilePhotoType;
  fallbackProfilePhoto: ProfilePhotoType;
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
