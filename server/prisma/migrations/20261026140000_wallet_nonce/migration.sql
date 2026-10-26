-- CreateTable
CREATE TABLE "WalletNonce" (
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "WalletNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE INDEX "WalletNonce_expiresAt_idx" ON "WalletNonce"("expiresAt");

