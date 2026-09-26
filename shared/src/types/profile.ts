import { ProfilePhotoType } from './category.js';

export interface ProfileImage {
  id: string;
  profileId: string;
  photoType: ProfilePhotoType;
  presignedUrl?: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  createdAt: string;
}

export interface DigitalProfile {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  measurements?: {
    heightCm?: number;
    chestCm?: number;
    waistCm?: number;
    hipsCm?: number;
  };
  images: ProfileImage[];
  createdAt: string;
  updatedAt?: string;
}
