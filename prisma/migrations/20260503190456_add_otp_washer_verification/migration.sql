/*
  Warnings:

  - You are about to drop the column `cinNumber` on the `WasherProfile` table. All the data in the column will be lost.
  - You are about to drop the column `triporteurReg` on the `WasherProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('TRIPORTEUR', 'MINIVAN', 'MOBILE');

-- CreateEnum
CREATE TYPE "WasherVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('PHONE_VERIFICATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "WasherProfile" DROP COLUMN "cinNumber",
DROP COLUMN "triporteurReg",
ADD COLUMN     "cinPhotoUrl" TEXT,
ADD COLUMN     "equipmentType" "EquipmentType",
ADD COLUMN     "licensePlate" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationStatus" "WasherVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone", "purpose");

-- CreateIndex
CREATE INDEX "WasherProfile_verificationStatus_idx" ON "WasherProfile"("verificationStatus");
