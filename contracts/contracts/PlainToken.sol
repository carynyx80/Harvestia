// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice A token without burn(), used in tests to check the dead-address burn path.
contract PlainToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Plain", "PLN") { _mint(msg.sender, initialSupply); }
}
