// Game Vault interface shared by the server and the browser: the contract
// functions both sides call, the EIP-712 typed data players sign, and the fees.
export const VAULT_FEES_BPS = { deposit: 300, withdraw: 500, burnShare: 5000 } as const;

export const VAULT_ABI = [
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'spend', stateMutability: 'nonpayable', inputs: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'purchaseId', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'claimRewards', stateMutability: 'nonpayable', inputs: [{ name: 'player', type: 'address' }, { name: 'totalEarned', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'rewardsClaimed', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'purchaseUsed', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalPlayerBalances', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'rewardReserve', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'operationsBalance', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalBurned', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalRewardsPaid', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'dailyRewardCap', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'solvent', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'event', name: 'Deposited', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'received', type: 'uint256' }, { name: 'fee', type: 'uint256' }, { name: 'credited', type: 'uint256' }] },
  { type: 'event', name: 'Withdrawn', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }, { name: 'fee', type: 'uint256' }, { name: 'sent', type: 'uint256' }] },
  { type: 'event', name: 'Spent', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'purchaseId', type: 'bytes32', indexed: true }, { name: 'amount', type: 'uint256' }, { name: 'burned', type: 'uint256' }, { name: 'toRewards', type: 'uint256' }] },
  { type: 'event', name: 'Burned', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'totalBurned', type: 'uint256' }] },
  { type: 'event', name: 'RewardsFunded', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }] },
  { type: 'event', name: 'RewardClaimed', inputs: [{ name: 'player', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }, { name: 'totalClaimed', type: 'uint256' }] },
] as const;

export const TEST_TOKEN_ABI = [
  { type: 'function', name: 'faucet', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const SPEND_TYPES = {
  Spend: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'purchaseId', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }],
} as const;
export const REWARD_TYPES = {
  Reward: [{ name: 'player', type: 'address' }, { name: 'totalEarned', type: 'uint256' }, { name: 'deadline', type: 'uint256' }],
} as const;
export const vaultDomain = (chainId: number, vault: `0x${string}`) => ({ name: 'HarvestiaVault', version: '1', chainId, verifyingContract: vault }) as const;

/** What the server tells the browser about the vault (GET /v1/vault). */
export interface VaultInfo {
  enabled: boolean;
  /** why it is off, when it is */
  reason?: string;
  chainId?: number;
  vault?: `0x${string}`;
  token?: `0x${string}`;
  testToken?: boolean;
  /** HRV per 1 USD of reference price, and where that price comes from */
  price?: { usdPerHrv: number; source: string; verified: boolean; at: number };
  stats?: { totalBurned: string; rewardReserve: string; playerBalances: string; operations: string; rewardsPaid: string; dailyRewardCap: string; solvent: boolean; paused: boolean };
}
