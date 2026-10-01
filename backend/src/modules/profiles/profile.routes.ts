import { Router } from 'express';
import multer from 'multer';
import { profileController } from './profile.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  createProfileSchema,
  updateProfileSchema,
  uploadAssetBodySchema,
} from './profile.dto.js';

const router = Router();

// Configure secure Multer memory upload with size and MIME filters
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum upload limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new multer.MulterError(
          'LIMIT_UNEXPECTED_FILE',
          `Unsupported file MIME type: ${file.mimetype}. Allowed: image/jpeg, image/png, image/webp.`
        )
      );
    }
  },
});

// All profile routes require authenticated session
router.use(requireAuth);

router.get('/', profileController.getProfile.bind(profileController));
router.post('/', validateBody(createProfileSchema), profileController.createProfile.bind(profileController));
router.patch('/', validateBody(updateProfileSchema), profileController.updateProfile.bind(profileController));
router.delete('/', profileController.deleteProfile.bind(profileController));

router.get('/assets', profileController.getAssets.bind(profileController));
router.post(
  '/assets',
  upload.single('file'),
  validateBody(uploadAssetBodySchema),
  profileController.uploadAsset.bind(profileController)
);
router.delete('/assets/:id', profileController.deleteAsset.bind(profileController));

router.get('/readiness/:category', profileController.getCategoryReadiness.bind(profileController));

export const profileRoutes = router;
