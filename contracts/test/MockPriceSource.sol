// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPriceSource {
    mapping(uint256 => uint256) public price;

    function set(uint256 marketId, uint256 p) external {
        price[marketId] = p;
    }
}
