// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title Test HRV — a stand-in token for local chains and Robinhood Chain testnet only.
/// @notice Has no value. Anyone can claim test tokens from the faucet once a day.
contract TestHRV is ERC20, ERC20Burnable {
    uint256 public constant FAUCET_AMOUNT = 10_000 ether;
    mapping(address => uint256) public lastFaucet;

    constructor(uint256 initialSupply) ERC20("Test Harvestia", "tHRV") {
        _mint(msg.sender, initialSupply);
    }

    function faucet() external {
        require(block.timestamp >= lastFaucet[msg.sender] + 1 days, "TestHRV: once per day");
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
