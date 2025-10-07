-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PREMIUM', 'PRO');

-- CreateEnum
CREATE TYPE "StyleType" AS ENUM ('REALISTIC', 'CARTOON', 'ANIME', 'FANTASY', 'CYBERPUNK', 'VINTAGE', 'MINIMALIST');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "auth0_id" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "daily_quota" INTEGER NOT NULL DEFAULT 3,
    "daily_used" INTEGER NOT NULL DEFAULT 0,
    "total_generated" INTEGER NOT NULL DEFAULT 0,
    "last_reset_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "style_type" "StyleType" NOT NULL DEFAULT 'REALISTIC',
    "image_url" TEXT,
    "thumbnail_url" TEXT,
    "reference_image_url" TEXT,
    "metadata" JSONB,
    "tags" TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_in_library" BOOLEAN NOT NULL DEFAULT false,
    "generation_status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "age" TEXT,
    "gender" TEXT,
    "occupation" TEXT,
    "personality" TEXT[],
    "physicalTraits" JSONB,
    "clothing" TEXT,
    "background" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "character_id" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "batch_size" INTEGER NOT NULL DEFAULT 1,
    "nano_banana_request_id" TEXT,
    "prompt" TEXT NOT NULL,
    "style_type" "StyleType" NOT NULL DEFAULT 'REALISTIC',
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "style_type" "StyleType" NOT NULL DEFAULT 'REALISTIC',
    "tags" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "cover_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_collection_items" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environment" TEXT,
    "setting" TEXT,
    "mood" TEXT,
    "lighting" TEXT,
    "thumbnail_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_characters" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "pose" TEXT,
    "expression" TEXT,
    "action" TEXT,
    "position" JSONB,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_themes" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_variants" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "image_url" TEXT,
    "thumbnail_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_id_key" ON "users"("auth0_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_collection_items_collection_id_character_id_key" ON "character_collection_items"("collection_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "scene_characters_scene_id_character_id_key" ON "scene_characters"("scene_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_themes_character_id_name_key" ON "character_themes"("character_id", "name");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_collections" ADD CONSTRAINT "character_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_collection_items" ADD CONSTRAINT "character_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "character_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_collection_items" ADD CONSTRAINT "character_collection_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_generations" ADD CONSTRAINT "scene_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_generations" ADD CONSTRAINT "scene_generations_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_themes" ADD CONSTRAINT "character_themes_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_variants" ADD CONSTRAINT "theme_variants_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "character_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
