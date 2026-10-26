'use client';
import { erc20Abi, formatUnits } from 'viem';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { DEFAULT_CHAIN, HRV_CHAIN_ID, HRV_TOKEN } from '@/lib/wallet';

const REFRESH_MS = 30_000;

/** Live balances of the connected wallet, read from Robinhood Chain (refreshed every 30 seconds). */
export function useWalletData() {
  const account = useAccount();
  const address = account.address;
  const eth = useBalance({ address, chainId: DEFAULT_CHAIN.id, query: { enabled: !!address, refetchInterval: REFRESH_MS } });
  const hrv = useReadContracts({
    contracts: HRV_TOKEN && address ? [
      { address: HRV_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: HRV_CHAIN_ID },
      { address: HRV_TOKEN, abi: erc20Abi, functionName: 'decimals', chainId: HRV_CHAIN_ID },
      { address: HRV_TOKEN, abi: erc20Abi, functionName: 'symbol', chainId: HRV_CHAIN_ID },
    ] : [],
    query: { enabled: !!(HRV_TOKEN && address), refetchInterval: REFRESH_MS },
  });
  const [bal, dec, sym] = hrv.data ?? [];
  const hrvAmount = bal?.status === 'success' && dec?.status === 'success' ? Number(formatUnits(bal.result as bigint, dec.result as number)) : null;
  return {
    account,
    onRobinhood: account.chainId === DEFAULT_CHAIN.id,
    eth: eth.data ? Number(formatUnits(eth.data.value, eth.data.decimals)) : null,
    ethLoading: eth.isLoading,
    hrvLaunched: !!HRV_TOKEN,
    hrv: hrvAmount,
    hrvSymbol: sym?.status === 'success' ? String(sym.result) : 'HRV',
    hrvError: hrv.error?.message ?? null,
    refetch: () => { void eth.refetch(); void hrv.refetch(); },
  };
}

export const fmtToken = (n: number | null, digits = 4) => n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : digits });
