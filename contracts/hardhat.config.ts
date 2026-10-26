import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

// Deployments to Robinhood Chain read the deployer key from your own shell environment.
// Never commit it, never paste it anywhere else.
const deployer = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 500 }, evmVersion: 'cancun' } },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: 'http://127.0.0.1:8545', chainId: 31337 },
    robinhoodTestnet: { url: 'https://rpc.testnet.chain.robinhood.com', chainId: 46630, accounts: deployer },
    // mainnet is deliberately absent: the vault is not deployed to mainnet before an independent audit
  },
};
export default config;
