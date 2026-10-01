-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FRONT_FULL_BODY', 'UPPER_BODY', 'LOWER_BODY', 'FEET', 'FACE', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "CategoryEnum" AS ENUM ('TOPS', 'SHIRTS', 'DRESSES', 'JACKETS', 'PANTS', 'SHOES', 'JEWELLERY', 'NECKLACES', 'ACCESSORIES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "JobStatusEnum" AS ENUM ('CREATED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenerationModeEnum" AS ENUM ('FAST', 'STANDARD', 'HIGH_QUALITY', 'CONTEXT_AWARE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "consent_training" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Profile',
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "measurements" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_images" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "source_domain" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "CategoryEnum" NOT NULL,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "brand" TEXT,
    "detection_confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "local_storage_key" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "quality_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "sku" TEXT,
    "price" DECIMAL(10,2),
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_on_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "product_id" TEXT,
    "status" "JobStatusEnum" NOT NULL DEFAULT 'CREATED',
    "generation_mode" "GenerationModeEnum" NOT NULL DEFAULT 'STANDARD',
    "provider_used" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "current_stage" TEXT,
    "queued_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "try_on_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_on_results" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "try_on_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wardrobe_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "custom_title" TEXT,
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wardrobe_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "digital_profiles_user_id_idx" ON "digital_profiles"("user_id");

-- CreateIndex
CREATE INDEX "profile_images_profile_id_idx" ON "profile_images"("profile_id");

-- CreateIndex
CREATE INDEX "products_source_domain_idx" ON "products"("source_domain");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "try_on_jobs_user_id_idx" ON "try_on_jobs"("user_id");

-- CreateIndex
CREATE INDEX "try_on_jobs_status_idx" ON "try_on_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "try_on_results_job_id_key" ON "try_on_results"("job_id");

-- CreateIndex
CREATE INDEX "try_on_results_user_id_idx" ON "try_on_results"("user_id");

-- CreateIndex
CREATE INDEX "wardrobe_items_user_id_idx" ON "wardrobe_items"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_profiles" ADD CONSTRAINT "digital_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_images" ADD CONSTRAINT "profile_images_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "digital_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_jobs" ADD CONSTRAINT "try_on_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_jobs" ADD CONSTRAINT "try_on_jobs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "digital_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_jobs" ADD CONSTRAINT "try_on_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "try_on_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "try_on_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
