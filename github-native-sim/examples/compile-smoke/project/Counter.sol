// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

contract Counter {
    uint256 public value;

    function increment() external {
        value += 1;
    }
}
