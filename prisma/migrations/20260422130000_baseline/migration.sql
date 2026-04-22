-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'DISABLED', 'INVITED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('BOOKING_VIEW', 'BOOKING_CREATE');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGOUT', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_SUCCESS', 'SESSION_REVOKED', 'INVITE_SENT', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'MEMBERSHIP_DISABLED', 'MEMBERSHIP_ENABLED', 'MEMBERSHIP_ROLE_CHANGED', 'USER_DISABLED', 'TENANT_SELECTED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'PALLET', 'LABOR');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'REQUEST');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "OrderEmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "OrderEmailStatus" AS ENUM ('SENT', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "OrderNotificationType" AS ENUM ('MANUAL_REVIEW', 'GSM_REVIEW', 'CAPACITY_REVIEW');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('ATTACHMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "SpecialOptionType" AS ENUM ('RETURN', 'XTRA', 'EXTRA_SERVICE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "description" TEXT,
    "logoPath" TEXT,
    "usernameDisplayColor" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceListId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPermission" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "username" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "description" TEXT,
    "logoPath" TEXT,
    "usernameDisplayColor" TEXT,
    "priceListId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitePermission" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "activeCompanyId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL,
    "type" "AuthEventType" NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "email" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'FIXED',
    "priceCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "message" TEXT,
    "preferredFrom" TIMESTAMP(3),
    "preferredTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "serviceId" TEXT,
    "titleSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "allowDeliveryTypes" BOOLEAN NOT NULL DEFAULT true,
    "allowInstallOptions" BOOLEAN NOT NULL DEFAULT true,
    "allowReturnOptions" BOOLEAN NOT NULL DEFAULT true,
    "allowExtraServices" BOOLEAN NOT NULL DEFAULT true,
    "allowDemont" BOOLEAN NOT NULL DEFAULT true,
    "allowQuantity" BOOLEAN NOT NULL DEFAULT true,
    "allowPeopleCount" BOOLEAN NOT NULL DEFAULT false,
    "allowHoursInput" BOOLEAN NOT NULL DEFAULT false,
    "allowModelNumber" BOOLEAN NOT NULL DEFAULT true,
    "autoXtraPerPallet" BOOLEAN NOT NULL DEFAULT false,
    "deliveryTypes" JSONB,
    "customSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productOptionId" TEXT NOT NULL,
    "customerPriceCents" INTEGER NOT NULL,
    "subcontractorPriceCents" INTEGER NOT NULL,
    "discountAmountCents" INTEGER,
    "discountEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListSpecialOption" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "type" "SpecialOptionType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "customerPrice" DECIMAL(10,2) NOT NULL,
    "subcontractorPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" TEXT,
    "discountEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListSpecialOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "customerMembershipId" TEXT,
    "priceListId" TEXT,
    "displayId" INTEGER NOT NULL,
    "orderNumber" TEXT,
    "description" TEXT,
    "modelNr" TEXT,
    "deliveryDate" TEXT,
    "timeWindow" TEXT,
    "expressDelivery" BOOLEAN NOT NULL DEFAULT false,
    "contactCustomerForCustomTimeWindow" BOOLEAN NOT NULL DEFAULT false,
    "customTimeContactNote" TEXT,
    "pickupAddress" TEXT,
    "extraPickupAddress" TEXT[],
    "extraPickupContacts" JSONB,
    "deliveryAddress" TEXT,
    "returnAddress" TEXT,
    "drivingDistance" TEXT,
    "customerName" TEXT,
    "customerLabel" TEXT,
    "phone" TEXT,
    "phoneTwo" TEXT,
    "email" TEXT,
    "customerComments" TEXT,
    "floorNo" TEXT,
    "lift" TEXT,
    "cashierName" TEXT,
    "cashierPhone" TEXT,
    "subcontractorMembershipId" TEXT,
    "subcontractor" TEXT,
    "driver" TEXT,
    "secondDriver" TEXT,
    "driverInfo" TEXT,
    "licensePlate" TEXT,
    "deviation" TEXT,
    "feeExtraWork" BOOLEAN NOT NULL DEFAULT false,
    "feeAddToOrder" BOOLEAN NOT NULL DEFAULT false,
    "statusNotes" TEXT,
    "status" TEXT,
    "dontSendEmail" BOOLEAN NOT NULL DEFAULT false,
    "priceExVat" INTEGER NOT NULL DEFAULT 0,
    "priceSubcontractor" INTEGER NOT NULL DEFAULT 0,
    "rabatt" TEXT,
    "leggTil" TEXT,
    "subcontractorMinus" TEXT,
    "subcontractorPlus" TEXT,
    "productsSummary" TEXT,
    "deliveryTypeSummary" TEXT,
    "servicesSummary" TEXT,
    "gsmOrderId" TEXT,
    "gsmExternalId" TEXT,
    "gsmLastTaskState" TEXT,
    "gsmSyncStatus" TEXT,
    "gsmSentAt" TIMESTAMP(3),
    "gsmLastWebhookAt" TIMESTAMP(3),
    "gsmLastSyncedAt" TIMESTAMP(3),
    "emailThreadToken" TEXT,
    "lastInboundEmailAt" TIMESTAMP(3),
    "lastOutboundEmailAt" TIMESTAMP(3),
    "needsEmailAttention" BOOLEAN NOT NULL DEFAULT false,
    "unreadInboundEmailCount" INTEGER NOT NULL DEFAULT 0,
    "lastNotificationAt" TIMESTAMP(3),
    "needsNotificationAttention" BOOLEAN NOT NULL DEFAULT false,
    "unreadNotificationCount" INTEGER NOT NULL DEFAULT 0,
    "productCardsSnapshot" JSONB,
    "lastEditedByMembershipId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "actorMembershipId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorSource" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEmailMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "OrderEmailDirection" NOT NULL,
    "status" "OrderEmailStatus" NOT NULL,
    "sentByMembershipId" TEXT,
    "externalMessageId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "OrderEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "OrderNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByMembershipId" TEXT,

    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productName" TEXT,
    "deliveryType" TEXT,
    "itemType" TEXT NOT NULL,
    "optionId" TEXT,
    "optionCode" TEXT,
    "optionLabel" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "customerPriceCents" INTEGER,
    "subcontractorPriceCents" INTEGER,
    "rawData" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderGsmTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gsmTaskId" TEXT NOT NULL,
    "gsmOrderId" TEXT,
    "category" TEXT,
    "reference" TEXT,
    "state" TEXT,
    "address" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderGsmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GsmWebhookEvent" (
    "id" TEXT NOT NULL,
    "gsmRequestId" TEXT,
    "gsmTaskId" TEXT,
    "gsmOrderId" TEXT,
    "topic" TEXT,
    "eventType" TEXT,
    "orderId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "GsmWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAttachment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'ATTACHMENT',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "gsmTaskId" TEXT,
    "gsmDocumentId" TEXT,
    "priceListSpecialOptionId" TEXT,

    CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingOrderAttachment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'ATTACHMENT',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyOrderCounter" (
    "companyId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyOrderCounter_pkey" PRIMARY KEY ("companyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "Membership_companyId_status_idx" ON "Membership"("companyId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "MembershipPermission_permission_idx" ON "MembershipPermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPermission_membershipId_permission_key" ON "MembershipPermission"("membershipId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_companyId_status_idx" ON "Invite"("companyId", "status");

-- CreateIndex
CREATE INDEX "Invite_email_status_idx" ON "Invite"("email", "status");

-- CreateIndex
CREATE INDEX "Invite_priceListId_idx" ON "Invite"("priceListId");

-- CreateIndex
CREATE INDEX "InvitePermission_permission_idx" ON "InvitePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "InvitePermission_inviteId_permission_key" ON "InvitePermission"("inviteId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_activeCompanyId_idx" ON "Session"("activeCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthEvent_type_createdAt_idx" ON "AuthEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_companyId_createdAt_idx" ON "AuthEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_isActive_sortOrder_idx" ON "Service"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Request_status_createdAt_idx" ON "Request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RequestItem_requestId_idx" ON "RequestItem"("requestId");

-- CreateIndex
CREATE INDEX "RequestItem_serviceId_idx" ON "RequestItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "ProductOption_productId_isActive_sortOrder_idx" ON "ProductOption"("productId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_code_key" ON "ProductOption"("productId", "code");

-- CreateIndex
CREATE INDEX "PriceListItem_priceListId_isActive_idx" ON "PriceListItem"("priceListId", "isActive");

-- CreateIndex
CREATE INDEX "PriceListItem_productOptionId_isActive_idx" ON "PriceListItem"("productOptionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productOptionId_key" ON "PriceListItem"("priceListId", "productOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_code_key" ON "PriceList"("code");

-- CreateIndex
CREATE INDEX "PriceListSpecialOption_priceListId_type_idx" ON "PriceListSpecialOption"("priceListId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListSpecialOption_priceListId_type_code_key" ON "PriceListSpecialOption"("priceListId", "type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Order_emailThreadToken_key" ON "Order"("emailThreadToken");

-- CreateIndex
CREATE INDEX "Order_companyId_createdAt_idx" ON "Order"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_deliveryDate_idx" ON "Order"("deliveryDate");

-- CreateIndex
CREATE INDEX "Order_customerMembershipId_idx" ON "Order"("customerMembershipId");

-- CreateIndex
CREATE INDEX "Order_subcontractorMembershipId_idx" ON "Order"("subcontractorMembershipId");

-- CreateIndex
CREATE INDEX "Order_gsmOrderId_idx" ON "Order"("gsmOrderId");

-- CreateIndex
CREATE INDEX "Order_gsmExternalId_idx" ON "Order"("gsmExternalId");

-- CreateIndex
CREATE INDEX "Order_gsmSyncStatus_idx" ON "Order"("gsmSyncStatus");

-- CreateIndex
CREATE INDEX "Order_needsEmailAttention_lastInboundEmailAt_idx" ON "Order"("needsEmailAttention", "lastInboundEmailAt");

-- CreateIndex
CREATE INDEX "Order_needsNotificationAttention_lastNotificationAt_idx" ON "Order"("needsNotificationAttention", "lastNotificationAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_displayId_key" ON "Order"("companyId", "displayId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_companyId_createdAt_idx" ON "OrderEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_type_createdAt_idx" ON "OrderEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_actorMembershipId_createdAt_idx" ON "OrderEvent"("actorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_orderId_createdAt_idx" ON "OrderEmailMessage"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_companyId_createdAt_idx" ON "OrderEmailMessage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_direction_createdAt_idx" ON "OrderEmailMessage"("direction", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_status_createdAt_idx" ON "OrderEmailMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_sentByMembershipId_createdAt_idx" ON "OrderEmailMessage"("sentByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEmailMessage_externalMessageId_idx" ON "OrderEmailMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "OrderNotification_orderId_createdAt_idx" ON "OrderNotification"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNotification_companyId_resolvedAt_createdAt_idx" ON "OrderNotification"("companyId", "resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "OrderNotification_resolvedByMembershipId_createdAt_idx" ON "OrderNotification"("resolvedByMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_optionId_idx" ON "OrderItem"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderGsmTask_gsmTaskId_key" ON "OrderGsmTask"("gsmTaskId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_orderId_idx" ON "OrderGsmTask"("orderId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_gsmOrderId_idx" ON "OrderGsmTask"("gsmOrderId");

-- CreateIndex
CREATE INDEX "OrderGsmTask_state_idx" ON "OrderGsmTask"("state");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmRequestId_idx" ON "GsmWebhookEvent"("gsmRequestId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmTaskId_idx" ON "GsmWebhookEvent"("gsmTaskId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_gsmOrderId_idx" ON "GsmWebhookEvent"("gsmOrderId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_orderId_idx" ON "GsmWebhookEvent"("orderId");

-- CreateIndex
CREATE INDEX "GsmWebhookEvent_processed_receivedAt_idx" ON "GsmWebhookEvent"("processed", "receivedAt");

-- CreateIndex
CREATE INDEX "OrderAttachment_orderId_createdAt_idx" ON "OrderAttachment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PendingOrderAttachment_sessionId_createdAt_idx" ON "PendingOrderAttachment"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermission" ADD CONSTRAINT "MembershipPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitePermission" ADD CONSTRAINT "InvitePermission_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productOptionId_fkey" FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListSpecialOption" ADD CONSTRAINT "PriceListSpecialOption_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerMembershipId_fkey" FOREIGN KEY ("customerMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_lastEditedByMembershipId_fkey" FOREIGN KEY ("lastEditedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEmailMessage" ADD CONSTRAINT "OrderEmailMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEmailMessage" ADD CONSTRAINT "OrderEmailMessage_sentByMembershipId_fkey" FOREIGN KEY ("sentByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_resolvedByMembershipId_fkey" FOREIGN KEY ("resolvedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderGsmTask" ADD CONSTRAINT "OrderGsmTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GsmWebhookEvent" ADD CONSTRAINT "GsmWebhookEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_priceListSpecialOptionId_fkey" FOREIGN KEY ("priceListSpecialOptionId") REFERENCES "PriceListSpecialOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
