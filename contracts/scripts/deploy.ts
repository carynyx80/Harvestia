// Deploys the Game Vault (and a test HRV token unless HRV_TOKEN_ADDRESS is given),
// grants the settler and reward-signer roles, and writes the addresses to
// deployments/<network>.json. Mainnet is not configured on purpose: no
// deployment there before an independent audit.
import { ethers, network } from 'hardhat';
import { mkdirSync, writeFileSync } from 'node:fs';

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const settler = process.env.SETTLER_ADDRESS ?? signers[1]?.address;
  const rewardSigner = process.env.REWARD_SIGNER_ADDRESS ?? signers[2]?.address;
  if (!settler || !rewardSigner) throw new Error('Set SETTLER_ADDRESS and REWARD_SIGNER_ADDRESS');
  const dailyCap = ethers.parseEther(process.env.DAILY_REWARD_CAP ?? '10000');

  let tokenAddress = process.env.HRV_TOKEN_ADDRESS, burnable = process.env.HRV_BURNABLE !== '0', testToken = false;
  if (!tokenAddress) {
    const t = await (await ethers.getContractFactory('TestHRV')).deploy(ethers.parseEther('1000000'));
    await t.waitForDeployment();
    tokenAddress = await t.getAddress(); burnable = true; testToken = true;
    console.log('TestHRV', tokenAddress);
  }
  const vault = await (await ethers.getContractFactory('HarvestiaVault')).deploy(tokenAddress, burnable, deployer.address, dailyCap);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  await (await vault.grantRole(await vault.SETTLER_ROLE(), settler)).wait();
  await (await vault.grantRole(await vault.REWARD_SIGNER_ROLE(), rewardSigner)).wait();
  const block = await ethers.provider.getBlockNumber();
  const out = { network: network.name, chainId: Number((await ethers.provider.getNetwork()).chainId), token: tokenAddress, testToken, burnable, vault: vaultAddress, admin: deployer.address, settler, rewardSigner, dailyRewardCap: dailyCap.toString(), deployedBlock: block, deployedAt: new Date().toISOString() };
  mkdirSync('deployments', { recursive: true });
  writeFileSync(`deployments/${network.name}.json`, JSON.stringify(out, null, 2) + '\n');
  console.log(out);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
