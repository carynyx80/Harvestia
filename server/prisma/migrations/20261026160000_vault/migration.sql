-- CreateTable
CREATE TABLE "ChainCursor" (
    "name" TEXT NOT NULL,
    "block" BIGINT NOT NULL,

    CONSTRAINT "ChainCursor_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "VaultEvent" (
    "id" BIGSERIAL NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "block" BIGINT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "player" TEXT,
    "amount" TEXT NOT NULL,
    "extra" JSONB NOT NULL,

    CONSTRAINT "VaultEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrvPurchase" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "amountWei" TEXT NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "usdPerHrv" DOUBLE PRECISION NOT NULL,
    "priceSource" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "HrvPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrvReward" (
    "id" BIGSERIAL NOT NULL,
    "wallet" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrvReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEvent_player_block_idx" ON "VaultEvent"("player", "block");

-- CreateIndex
CREATE INDEX "VaultEvent_kind_block_idx" ON "VaultEvent"("kind", "block");

-- CreateIndex
CREATE UNIQUE INDEX "VaultEvent_txHash_logIndex_key" ON "VaultEvent"("txHash", "logIndex");

-- CreateIndex
CREATE INDEX "HrvPurchase_playerId_createdAt_idx" ON "HrvPurchase"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "HrvReward_wallet_createdAt_idx" ON "HrvReward"("wallet", "createdAt");

