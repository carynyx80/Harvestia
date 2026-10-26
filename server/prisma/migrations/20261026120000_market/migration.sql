-- CreateTable
CREATE TABLE "ReferencePrice" (
    "commodity" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "usdPerTonne" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferencePrice_pkey" PRIMARY KEY ("commodity","period")
);

-- CreateTable
CREATE TABLE "MarketFeed" (
    "commodity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "rejected" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketFeed_pkey" PRIMARY KEY ("commodity")
);

-- CreateTable
CREATE TABLE "CommodityPrice" (
    "id" BIGSERIAL NOT NULL,
    "commodity" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mid" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "parts" JSONB NOT NULL,

    CONSTRAINT "CommodityPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityBook" (
    "commodity" TEXT NOT NULL,
    "pressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommodityBook_pkey" PRIMARY KEY ("commodity")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" BIGSERIAL NOT NULL,
    "farmId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommodityPrice_commodity_at_idx" ON "CommodityPrice"("commodity", "at");

-- CreateIndex
CREATE INDEX "Trade_commodity_at_idx" ON "Trade"("commodity", "at");

-- CreateIndex
CREATE INDEX "Trade_farmId_at_idx" ON "Trade"("farmId", "at");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

