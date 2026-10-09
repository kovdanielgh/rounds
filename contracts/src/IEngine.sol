// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Opens one position per round with the round budget and closes it at settle.
/// One adapter per venue (Perpl on Monad, Arcus/Lighter on Robinhood Chain later).
interface IEngine {
    /// @notice Pull `margin` of the collateral token from msg.sender and open a position.
    /// Must revert if the position cannot be opened, so the caller keeps its funds.
    function open(uint256 roundId, uint256 marketId, bool isLong, uint256 margin) external;

    /// @notice Close the position of the round and send everything that is left to msg.sender.
    /// @return returned collateral sent back (0 on a full loss, more than margin on profit)
    function close(uint256 roundId) external returns (uint256 returned);
}
