// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Drip {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Testnet faucet for Rounds: test USD (AUSD) plus a little MON for gas, so a new user with
/// an empty wallet can play. A relayer (operator) sends the transaction, because the user has no
/// gas yet. Limits: once per address per cooldown, and a global daily cap, so even a leaked
/// operator key cannot drain it faster than the cap.
contract Faucet {
    IERC20Drip public immutable token;
    address public owner;
    address public operator;

    uint256 public tokenAmount = 100e6;   // 100 AUSD (6 decimals)
    uint256 public nativeAmount = 0.05 ether;
    uint256 public cooldown = 1 days;
    uint256 public dailyCap = 200;

    mapping(address => uint256) public lastDrip;
    uint256 public day;        // current day number
    uint256 public dripsToday;

    event Dripped(address indexed to, uint256 tokenAmount, uint256 nativeAmount);
    event Set(uint256 tokenAmount, uint256 nativeAmount, uint256 cooldown, uint256 dailyCap);

    error NotOwner();
    error NotOperator();
    error TooSoon();
    error DailyCap();
    error Empty();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20Drip token_, address operator_) {
        token = token_;
        owner = msg.sender;
        operator = operator_;
    }

    receive() external payable {}

    function drip(address to) external {
        if (msg.sender != operator && msg.sender != owner) revert NotOperator();
        if (!canDrip(to)) revert TooSoon();
        uint256 today = block.timestamp / 1 days;
        if (today != day) {
            day = today;
            dripsToday = 0;
        }
        if (dripsToday >= dailyCap) revert DailyCap();
        if (token.balanceOf(address(this)) < tokenAmount) revert Empty();
        dripsToday += 1;
        lastDrip[to] = block.timestamp;
        if (!token.transfer(to, tokenAmount)) revert TransferFailed();
        uint256 native = address(this).balance < nativeAmount ? address(this).balance : nativeAmount;
        if (native > 0) {
            (bool ok,) = to.call{value: native}("");
            if (!ok) revert TransferFailed();
        }
        emit Dripped(to, tokenAmount, native);
    }

    function canDrip(address to) public view returns (bool) {
        return lastDrip[to] == 0 || block.timestamp >= lastDrip[to] + cooldown;
    }

    // ---------------------------------------------------------------- owner

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
    }

    function setOwner(address owner_) external onlyOwner {
        owner = owner_;
    }

    function set(uint256 tokenAmount_, uint256 nativeAmount_, uint256 cooldown_, uint256 dailyCap_) external onlyOwner {
        tokenAmount = tokenAmount_;
        nativeAmount = nativeAmount_;
        cooldown = cooldown_;
        dailyCap = dailyCap_;
        emit Set(tokenAmount_, nativeAmount_, cooldown_, dailyCap_);
    }

    function withdraw(address to) external onlyOwner {
        uint256 t = token.balanceOf(address(this));
        if (t > 0 && !token.transfer(to, t)) revert TransferFailed();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert TransferFailed();
    }
}
