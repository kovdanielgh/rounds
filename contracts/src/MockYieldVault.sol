// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Testnet stand-in for an ERC-4626 yield vault (Morpho/Euler on mainnet). The share price
/// grows linearly at aprBps per year. The yield is paid from a reserve: tokens the owner sends to
/// the vault. Total assets never go above the tokens the vault holds.
contract MockYieldVault {
    uint256 constant YEAR = 365 days;
    uint256 constant ONE = 1e18;

    IERC20Like public immutable token;
    address public owner;
    uint256 public aprBps;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    uint256 internal ppsAt = ONE; // share price at checkpoint
    uint256 internal checkpoint = block.timestamp;

    event AprSet(uint256 aprBps);

    constructor(IERC20Like token_, uint256 aprBps_) {
        token = token_;
        owner = msg.sender;
        aprBps = aprBps_;
    }

    function setApr(uint256 aprBps_) external {
        require(msg.sender == owner, "owner");
        ppsAt = pricePerShare();
        checkpoint = block.timestamp;
        aprBps = aprBps_;
        emit AprSet(aprBps_);
    }

    function asset() external view returns (address) {
        return address(token);
    }

    function pricePerShare() public view returns (uint256) {
        return ppsAt + ppsAt * aprBps * (block.timestamp - checkpoint) / (10_000 * YEAR);
    }

    function totalAssets() public view returns (uint256) {
        uint256 grown = totalSupply * pricePerShare() / ONE;
        uint256 held = token.balanceOf(address(this));
        return grown < held ? grown : held;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return totalSupply == 0 ? shares * pricePerShare() / ONE : shares * totalAssets() / totalSupply;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        uint256 ta = totalAssets();
        shares = totalSupply == 0 || ta == 0 ? assets * ONE / pricePerShare() : assets * totalSupply / ta;
        require(token.transferFrom(msg.sender, address(this), assets), "transfer");
        totalSupply += shares;
        balanceOf[receiver] += shares;
    }

    function withdraw(uint256 assets, address receiver, address from) external returns (uint256 shares) {
        require(msg.sender == from, "owner only");
        uint256 ta = totalAssets();
        shares = (assets * totalSupply + ta - 1) / ta; // round up
        balanceOf[from] -= shares;
        totalSupply -= shares;
        require(token.transfer(receiver, assets), "transfer");
    }
}
