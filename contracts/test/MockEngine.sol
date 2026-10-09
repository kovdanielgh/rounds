// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSD} from "../src/MockUSD.sol";

/// @notice Test engine: pulls the margin, and on close returns margin * resultBps / 10000.
contract MockEngine {
    MockUSD public immutable usd;
    uint256 public resultBps = 10_000;
    bool public failOpen;
    mapping(uint256 => uint256) public marginOf;
    mapping(uint256 => bool) public longOf;

    constructor(MockUSD usd_) {
        usd = usd_;
    }

    function setResult(uint256 bps) external {
        resultBps = bps;
    }

    function setFailOpen(bool f) external {
        failOpen = f;
    }

    function open(uint256 roundId, uint256, bool isLong, uint256 margin) external {
        require(!failOpen, "no liquidity");
        usd.transferFrom(msg.sender, address(this), margin);
        marginOf[roundId] = margin;
        longOf[roundId] = isLong;
    }

    function close(uint256 roundId) external returns (uint256 returned) {
        returned = marginOf[roundId] * resultBps / 10_000;
        uint256 have = usd.balanceOf(address(this));
        if (returned > have) usd.mint(address(this), returned - have); // profit comes from the "market"
        usd.transfer(msg.sender, returned);
        marginOf[roundId] = 0;
    }
}
