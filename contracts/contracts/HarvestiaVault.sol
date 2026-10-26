// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title Harvestia Game Vault
/// @notice Holds $HRV that players deposit for spending in Harvestia.
///
/// Accounting is kept in three separate buckets that never mix:
///  - player balances (liabilities): only the player can withdraw them, and only a
///    purchase the player signed can spend them;
///  - the farmer reward treasury: funded by half of every purchase (and later by
///    buybacks), paid out only as capped reward claims;
///  - operations: deposit and withdrawal fees.
/// The other half of every purchase is burned on-chain.
///
/// Withdrawals stay open even while the vault is paused, so players can always exit.
/// NOT AUDITED. For local chains and testnet until an independent audit is complete.
contract HarvestiaVault is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 public constant REWARD_SIGNER_ROLE = keccak256("REWARD_SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant SPEND_TYPEHASH = keccak256("Spend(address player,uint256 amount,bytes32 purchaseId,uint256 deadline)");
    bytes32 public constant REWARD_TYPEHASH = keccak256("Reward(address player,uint256 totalEarned,uint256 deadline)");

    uint256 public constant BPS = 10_000;
    uint256 public constant DEPOSIT_FEE_BPS = 300; // 3%
    uint256 public constant WITHDRAW_FEE_BPS = 500; // 5%
    uint256 public constant BURN_SHARE_BPS = 5_000; // 50% of each purchase burned, 50% to rewards
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IERC20 public immutable token;
    /// @notice true if the token has burn(uint256); otherwise burns go to the dead address
    bool public immutable burnable;

    mapping(address => uint256) public balanceOf;
    uint256 public totalPlayerBalances;
    uint256 public rewardReserve;
    uint256 public operationsBalance;
    uint256 public totalBurned;
    uint256 public totalRewardsPaid;

    mapping(bytes32 => bool) public purchaseUsed;
    /// @notice cumulative rewards already paid to each player (claims pay only the difference)
    mapping(address => uint256) public rewardsClaimed;

    uint256 public dailyRewardCap;
    uint256 public rewardDay;
    uint256 public rewardsPaidToday;

    event Deposited(address indexed player, uint256 received, uint256 fee, uint256 credited);
    event Withdrawn(address indexed player, uint256 amount, uint256 fee, uint256 sent);
    event Spent(address indexed player, bytes32 indexed purchaseId, uint256 amount, uint256 burned, uint256 toRewards);
    event Burned(uint256 amount, uint256 totalBurned);
    event RewardsFunded(address indexed from, uint256 amount);
    event RewardClaimed(address indexed player, uint256 amount, uint256 totalClaimed);
    event OperationsWithdrawn(address indexed to, uint256 amount);
    event DailyRewardCapSet(uint256 cap);

    constructor(IERC20 token_, bool burnable_, address admin, uint256 dailyRewardCap_) EIP712("HarvestiaVault", "1") {
        token = token_;
        burnable = burnable_;
        dailyRewardCap = dailyRewardCap_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ------------------------------------------------------------------ players

    /// @notice Deposit `amount` (approve first). 3% goes to operations; the rest is your vault balance.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Vault: zero amount");
        uint256 received = _pull(msg.sender, amount);
        uint256 fee = (received * DEPOSIT_FEE_BPS) / BPS;
        uint256 credited = received - fee;
        balanceOf[msg.sender] += credited;
        totalPlayerBalances += credited;
        operationsBalance += fee;
        emit Deposited(msg.sender, received, fee, credited);
    }

    /// @notice Withdraw from your vault balance to your wallet. 5% goes to operations. Works even while paused.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: zero amount");
        require(balanceOf[msg.sender] >= amount, "Vault: insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalPlayerBalances -= amount;
        uint256 fee = (amount * WITHDRAW_FEE_BPS) / BPS;
        operationsBalance += fee;
        token.safeTransfer(msg.sender, amount - fee);
        emit Withdrawn(msg.sender, amount, fee, amount - fee);
    }

    // ------------------------------------------------------------------ purchases

    /// @notice Settles a purchase the player signed (EIP-712, gasless for the player).
    /// Half is burned, half goes to the farmer reward treasury. Each purchase id can be used once.
    function spend(address player, uint256 amount, bytes32 purchaseId, uint256 deadline, bytes calldata signature)
        external
        onlyRole(SETTLER_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(block.timestamp <= deadline, "Vault: signature expired");
        require(!purchaseUsed[purchaseId], "Vault: purchase already settled");
        require(amount > 0, "Vault: zero amount");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(SPEND_TYPEHASH, player, amount, purchaseId, deadline)));
        // ERC-1271 aware, so smart-contract wallets can sign too
        require(SignatureChecker.isValidSignatureNow(player, digest, signature), "Vault: bad signature");
        require(balanceOf[player] >= amount, "Vault: insufficient balance");

        purchaseUsed[purchaseId] = true;
        balanceOf[player] -= amount;
        totalPlayerBalances -= amount;
        uint256 burned = (amount * BURN_SHARE_BPS) / BPS;
        uint256 toRewards = amount - burned;
        rewardReserve += toRewards;
        _burn(burned);
        emit Spent(player, purchaseId, amount, burned, toRewards);
    }

    // ------------------------------------------------------------------ rewards

    /// @notice Adds tokens to the farmer reward treasury (e.g. weekly buybacks).
    function fundRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: zero amount");
        uint256 received = _pull(msg.sender, amount);
        rewardReserve += received;
        emit RewardsFunded(msg.sender, received);
    }

    /// @notice Pays a player's unclaimed rewards into their vault balance. The reward signer attests the
    /// player's cumulative earnings; only the part not yet claimed is paid, so a signature can't be replayed.
    /// Payouts are limited by the treasury balance and a daily cap. Anyone may relay a claim.
    function claimRewards(address player, uint256 totalEarned, uint256 deadline, bytes calldata signature) external nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "Vault: signature expired");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(REWARD_TYPEHASH, player, totalEarned, deadline)));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        require(err == ECDSA.RecoverError.NoError && hasRole(REWARD_SIGNER_ROLE, signer), "Vault: bad reward signature");
        uint256 already = rewardsClaimed[player];
        require(totalEarned > already, "Vault: nothing to claim");
        uint256 payout = totalEarned - already;
        require(payout <= rewardReserve, "Vault: reward treasury too low");

        uint256 day = block.timestamp / 1 days;
        if (day != rewardDay) { rewardDay = day; rewardsPaidToday = 0; }
        require(rewardsPaidToday + payout <= dailyRewardCap, "Vault: daily reward cap reached");
        rewardsPaidToday += payout;

        rewardsClaimed[player] = totalEarned;
        rewardReserve -= payout;
        totalRewardsPaid += payout;
        balanceOf[player] += payout;
        totalPlayerBalances += payout;
        emit RewardClaimed(player, payout, totalEarned);
    }

    // ------------------------------------------------------------------ admin (never touches player balances or rewards)

    function withdrawOperations(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(amount <= operationsBalance, "Vault: exceeds operations balance");
        operationsBalance -= amount;
        token.safeTransfer(to, amount);
        emit OperationsWithdrawn(to, amount);
    }

    /// @notice Recovers tokens sent to the vault by mistake — only what exceeds every bucket.
    function recoverExcess(address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 excess = token.balanceOf(address(this)) - liabilities();
        require(excess > 0, "Vault: no excess");
        token.safeTransfer(to, excess);
    }

    function setDailyRewardCap(uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyRewardCap = cap;
        emit DailyRewardCapSet(cap);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ------------------------------------------------------------------ views

    function liabilities() public view returns (uint256) {
        return totalPlayerBalances + rewardReserve + operationsBalance;
    }

    /// @notice True when the vault holds at least everything it owes.
    function solvent() external view returns (bool) {
        return token.balanceOf(address(this)) >= liabilities();
    }

    function domainSeparator() external view returns (bytes32) { return _domainSeparatorV4(); }

    // ------------------------------------------------------------------ internal

    /// @dev Measures what actually arrived, so fee-on-transfer tokens can't inflate balances.
    function _pull(address from, uint256 amount) private returns (uint256) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        return token.balanceOf(address(this)) - before;
    }

    function _burn(uint256 amount) private {
        if (amount == 0) return;
        if (burnable) ERC20Burnable(address(token)).burn(amount);
        else token.safeTransfer(DEAD, amount);
        totalBurned += amount;
        emit Burned(amount, totalBurned);
    }
}
