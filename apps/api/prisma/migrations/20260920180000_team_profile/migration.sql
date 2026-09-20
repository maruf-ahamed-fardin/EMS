-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "TeamProfileLinkKind" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'GITHUB', 'LINKEDIN', 'WEBSITE');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "blood_group" "BloodGroup";

-- CreateTable
CREATE TABLE "team_profiles" (
    "employee_id" UUID NOT NULL,
    "business_phone" TEXT,
    "headline" TEXT,
    "show_personal_phone" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_profiles_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "team_profile_links" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "TeamProfileLinkKind" NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_profile_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_profile_links_employee_id_kind_key" ON "team_profile_links"("employee_id", "kind");

-- AddForeignKey
ALTER TABLE "team_profiles" ADD CONSTRAINT "team_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_profile_links" ADD CONSTRAINT "team_profile_links_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "team_profiles"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

