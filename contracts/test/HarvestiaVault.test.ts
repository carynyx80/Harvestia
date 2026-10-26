import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Signer } from 'ethers';

const E = (n: number | string) => ethers.parseEther(String(n));
const id = (s: string) => ethers.id(s);

async function deploy(burnable = true) {
  const [admin, settler, rewardSigner, alice, bob, ops] = await ethers.getSigners();
  const token = burnable
    ? await (await ethers.getContractFactory('TestHRV')).deploy(E(1_000_000))
    : await (await ethers.getContractFactory('PlainToken')).deploy(E(1_000_000));
  const vault = await (await ethers.getContractFactory('HarvestiaVault')).deploy(await token.getAddress(), burnable, admin.address, E(1_000));
  await vault.grantRole(await vault.SETTLER_ROLE(), settler.address);
  await vault.grantRole(await vault.REWARD_SIGNER_ROLE(), rewardSigner.address);
  for (const p of [alice, bob]) {
    await token.transfer(p.address, E(10_000));
    await token.connect(p).approve(await vault.getAddress(), ethers.MaxUint256);
  }
  await token.approve(await vault.getAddress(), ethers.MaxUint256);
  const { chainId } = await ethers.provider.getNetwork();
  const domain = { name: 'HarvestiaVault', version: '1', chainId, verifyingContract: await vault.getAddress() };
  const signSpend = (who: Signer, player: string, amount: bigint, purchaseId: string, deadline: number) =>
    who.signTypedData(domain, { Spend: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'purchaseId', type: 'bytes32' }, { name: 'deadline', type: 'uint256' }] }, { player, amount, purchaseId, deadline });
  const signReward = (who: Signer, player: string, totalEarned: bigint, deadline: number) =>
    who.signTypedData(domain, { Reward: [{ name: 'player', type: 'address' }, { name: 'totalEarned', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] }, { player, totalEarned, deadline });
  const later = async (s = 600) => (await ethers.provider.getBlock('latest'))!.timestamp + s;
  return { admin, settler, rewardSigner, alice, bob, ops, token, vault, signSpend, signReward, later };
}

describe('HarvestiaVault', () => {
  it('deposits credit the player after the 3% fee', async () => {
    const { vault, alice } = await deploy();
    await expect(vault.connect(alice).deposit(E(1000))).to.emit(vault, 'Deposited').withArgs(alice.address, E(1000), E(30), E(970));
    expect(await vault.balanceOf(alice.address)).to.equal(E(970));
    expect(await vault.operationsBalance()).to.equal(E(30));
    expect(await vault.solvent()).to.equal(true);
  });

  it('withdrawals pay out after the 5% fee, only up to the balance, and work while paused', async () => {
    const { vault, token, alice, admin } = await deploy();
    await vault.connect(alice).deposit(E(1000));
    await expect(vault.connect(alice).withdraw(E(971))).to.be.revertedWith('Vault: insufficient balance');
    await vault.connect(admin).pause();
    await expect(vault.connect(alice).deposit(E(1))).to.be.revertedWithCustomError(vault, 'EnforcedPause');
    const before = await token.balanceOf(alice.address);
    await vault.connect(alice).withdraw(E(100));
    expect((await token.balanceOf(alice.address)) - before).to.equal(E(95));
    expect(await vault.balanceOf(alice.address)).to.equal(E(870));
    expect(await vault.operationsBalance()).to.equal(E(35));
  });

  it('a signed purchase burns half and sends half to the reward treasury, once', async () => {
    const { vault, token, settler, alice, signSpend, later } = await deploy();
    await vault.connect(alice).deposit(E(1000));
    const supply = await token.totalSupply(), deadline = await later(), pid = id('purchase-1');
    const sig = await signSpend(alice, alice.address, E(100), pid, deadline);
    await expect(vault.connect(settler).spend(alice.address, E(100), pid, deadline, sig))
      .to.emit(vault, 'Spent').withArgs(alice.address, pid, E(100), E(50), E(50));
    expect(await vault.balanceOf(alice.address)).to.equal(E(870));
    expect(await vault.rewardReserve()).to.equal(E(50));
    expect(await vault.totalBurned()).to.equal(E(50));
    expect(supply - (await token.totalSupply())).to.equal(E(50)); // really burned
    await expect(vault.connect(settler).spend(alice.address, E(100), pid, deadline, sig)).to.be.revertedWith('Vault: purchase already settled');
    expect(await vault.solvent()).to.equal(true);
  });

  it('refuses purchases the player did not sign, expired ones, overspends and non-settlers', async () => {
    const { vault, settler, alice, bob, signSpend, later } = await deploy();
    await vault.connect(alice).deposit(E(100));
    const deadline = await later();
    // bob signs a spend of alice's balance
    const forged = await signSpend(bob, alice.address, E(10), id('p2'), deadline);
    await expect(vault.connect(settler).spend(alice.address, E(10), id('p2'), deadline, forged)).to.be.revertedWith('Vault: bad signature');
    // amount changed after signing
    const sig = await signSpend(alice, alice.address, E(10), id('p3'), deadline);
    await expect(vault.connect(settler).spend(alice.address, E(90), id('p3'), deadline, sig)).to.be.revertedWith('Vault: bad signature');
    // more than the balance
    const big = await signSpend(alice, alice.address, E(500), id('p4'), deadline);
    await expect(vault.connect(settler).spend(alice.address, E(500), id('p4'), deadline, big)).to.be.revertedWith('Vault: insufficient balance');
    // expired
    const old = (await later(0)) - 10;
    const late = await signSpend(alice, alice.address, E(10), id('p5'), old);
    await expect(vault.connect(settler).spend(alice.address, E(10), id('p5'), old, late)).to.be.revertedWith('Vault: signature expired');
    // only the settler may submit
    await expect(vault.connect(bob).spend(alice.address, E(10), id('p3'), deadline, sig)).to.be.revertedWithCustomError(vault, 'AccessControlUnauthorizedAccount');
  });

  it('burns by sending to the dead address when the token has no burn()', async () => {
    const { vault, token, settler, alice, signSpend, later } = await deploy(false);
    await vault.connect(alice).deposit(E(1000));
    const deadline = await later(), sig = await signSpend(alice, alice.address, E(100), id('x'), deadline);
    await vault.connect(settler).spend(alice.address, E(100), id('x'), deadline, sig);
    expect(await token.balanceOf('0x000000000000000000000000000000000000dEaD')).to.equal(E(50));
  });

  it('pays only unclaimed rewards, within the treasury and the daily cap', async () => {
    const { vault, admin, rewardSigner, alice, bob, signReward, later } = await deploy();
    await vault.connect(admin).fundRewards(E(5000));
    const deadline = await later();
    const s1 = await signReward(rewardSigner, alice.address, E(300), deadline);
    await expect(vault.connect(bob).claimRewards(alice.address, E(300), deadline, s1)).to.emit(vault, 'RewardClaimed').withArgs(alice.address, E(300), E(300));
    expect(await vault.balanceOf(alice.address)).to.equal(E(300));
    // the same attestation pays nothing more
    await expect(vault.claimRewards(alice.address, E(300), deadline, s1)).to.be.revertedWith('Vault: nothing to claim');
    // a higher cumulative total pays only the difference
    const s2 = await signReward(rewardSigner, alice.address, E(500), deadline);
    await vault.claimRewards(alice.address, E(500), deadline, s2);
    expect(await vault.balanceOf(alice.address)).to.equal(E(500));
    // daily cap is 1,000 in total: 500 used, 600 more is too much
    const s3 = await signReward(rewardSigner, bob.address, E(600), deadline);
    await expect(vault.claimRewards(bob.address, E(600), deadline, s3)).to.be.revertedWith('Vault: daily reward cap reached');
    // next day it goes through
    await ethers.provider.send('evm_increaseTime', [86_400]); await ethers.provider.send('evm_mine', []);
    const d2 = await later(), s4 = await signReward(rewardSigner, bob.address, E(600), d2);
    await vault.claimRewards(bob.address, E(600), d2, s4);
    expect(await vault.rewardReserve()).to.equal(E(5000 - 500 - 600));
    // not signed by the reward signer
    const fake = await signReward(alice, alice.address, E(900), d2);
    await expect(vault.claimRewards(alice.address, E(900), d2, fake)).to.be.revertedWith('Vault: bad reward signature');
    expect(await vault.solvent()).to.equal(true);
  });

  it('never pays rewards beyond the treasury', async () => {
    const { vault, admin, rewardSigner, alice, signReward, later } = await deploy();
    await vault.connect(admin).setDailyRewardCap(E(1_000_000));
    await vault.connect(admin).fundRewards(E(100));
    const deadline = await later(), sig = await signReward(rewardSigner, alice.address, E(101), deadline);
    await expect(vault.claimRewards(alice.address, E(101), deadline, sig)).to.be.revertedWith('Vault: reward treasury too low');
  });

  it('admin can take only operations fees and true excess — never player funds or rewards', async () => {
    const { vault, token, admin, alice, ops } = await deploy();
    await vault.connect(alice).deposit(E(1000)); // ops 30, player 970
    await vault.connect(admin).fundRewards(E(200));
    await expect(vault.connect(admin).withdrawOperations(ops.address, E(31))).to.be.revertedWith('Vault: exceeds operations balance');
    await vault.connect(admin).withdrawOperations(ops.address, E(30));
    await expect(vault.connect(admin).recoverExcess(ops.address)).to.be.revertedWith('Vault: no excess');
    await token.connect(alice).transfer(await vault.getAddress(), E(7)); // sent by mistake
    await vault.connect(admin).recoverExcess(ops.address);
    expect(await token.balanceOf(ops.address)).to.equal(E(37));
    expect(await vault.solvent()).to.equal(true);
    await expect(vault.connect(alice).withdrawOperations(alice.address, 1)).to.be.revertedWithCustomError(vault, 'AccessControlUnauthorizedAccount');
  });

  it('test token faucet gives tokens once a day', async () => {
    const { token, bob } = await deploy();
    const t = token.connect(bob) as unknown as { faucet(): Promise<unknown> };
    await t.faucet();
    await expect(t.faucet()).to.be.revertedWith('TestHRV: once per day');
  });
});
