// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEngine} from "./IEngine.sol";

interface IERC20Split {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice IEngine router: longs go to one engine, shorts to another. Each engine is its own Perpl
/// account, and Perpl nets positions per (market, account), so with two accounts both sides of a
/// mirror pair (Up long + Down short on the same market) get a real position.
/// Rounds opened before the switch were all opened by the longs engine: they close there.
contract SplitEngine is IEngine {
    IERC20Split public immutable token;
    address public immutable rounds;
    IEngine public immutable longs;
    IEngine public immutable shorts;
    mapping(uint256 => IEngine) public engineOf; // round => engine that holds its position

    error NotRounds();
    error TransferFailed();

    constructor(IERC20Split token_, address rounds_, IEngine longs_, IEngine shorts_) {
        token = token_;
        rounds = rounds_;
        longs = longs_;
        shorts = shorts_;
    }

    modifier onlyRounds() {
        if (msg.sender != rounds) revert NotRounds();
        _;
    }

    /// @dev Any revert of the engine reverts the whole call, so Rounds keeps its funds.
    function open(uint256 roundId, uint256 marketId, bool isLong, uint256 margin, uint256 leverage) external onlyRounds {
        IEngine e = isLong ? longs : shorts;
        if (!token.transferFrom(msg.sender, address(this), margin)) revert TransferFailed();
        token.approve(address(e), margin);
        e.open(roundId, marketId, isLong, margin, leverage);
        engineOf[roundId] = e;
    }

    function close(uint256 roundId) external onlyRounds returns (uint256 returned) {
        IEngine e = engineOf[roundId];
        if (address(e) == address(0)) e = longs; // opened before the switch
        returned = e.close(roundId);
        if (returned != 0 && !token.transfer(msg.sender, returned)) revert TransferFailed();
    }
}
