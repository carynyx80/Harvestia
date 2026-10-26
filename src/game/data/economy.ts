// Economy rules the UI must present. Token-side values are demonstration
// numbers until $HRV launches; real quotes come from verified on-chain pricing
// with liquidity checks, never from the client (see the Game Vault service).

/** Demo token price for previews only: 1 HRV = $0.0125. */
export const DEMO_HRV_USD = 0.0125;
/** Highest reference price allowed for any single shop item. */
export const MAX_ITEM_USD = 15;
/** How long a purchase quote stays valid before it must be refreshed. */
export const QUOTE_SECONDS = 30;

export const VAULT_FEES = { deposit: 0.03, withdraw: 0.05 };
/** Ordinary in-game purchases: half is burned, half funds the farmer reward treasury. */
export const PURCHASE_SPLIT = { burn: 0.5, treasury: 0.5 };
/** Proposed marketplace and exchange fees. */
export const MARKET_FEE = 0.02;
export const EXCHANGE_FEE = 0.01;

export const toHrv = (usd: number) => Math.round(usd / DEMO_HRV_USD);
export const fmtHrv = (n: number) => `${Math.round(n).toLocaleString('en-US')} HRV`;
export const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
