// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEngine} from "./IEngine.sol";

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Perpl Exchange (v1.7.x), the subset the engine uses. Struct layouts match the Perpl ABI.
interface IPerplDex {
    struct OrderDesc {
        uint256 orderDescId;
        uint256 perpId;
        uint8 orderType; // 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort
        uint256 orderId;
        uint256 pricePNS;
        uint256 lotLNS;
        uint256 expiryBlock;
        bool postOnly;
        bool fillOrKill;
        bool immediateOrCancel;
        uint256 maxMatches;
        uint256 leverageHdths;
        uint256 lastExecutionBlock;
        uint256 amountCNS;
        uint256 maxNegPnlCollatBPS;
    }

    struct OrderSignature {
        uint256 perpId;
        uint256 orderId;
    }

    struct PositionBitMap {
        uint256 bank1;
        uint256 bank2;
        uint256 bank3;
        uint256 bank4;
    }

    struct AccountInfo {
        uint256 accountId;
        uint256 balanceCNS;
        uint256 lockedBalanceCNS;
        uint8 frozen;
        address accountAddr;
        PositionBitMap positions;
    }

    struct PositionInfo {
        uint256 accountId;
        uint256 nextNodeId;
        uint256 prevNodeId;
        uint8 positionType; // 0 long, 1 short
        uint256 depositCNS;
        uint256 pricePNS;
        uint256 lotLNS;
        uint256 entryBlock;
        int256 pnlCNS;
        int256 deltaPnlCNS;
        int256 premiumPnlCNS;
    }

    struct PerpetualInfo {
        string name;
        string symbol;
        uint256 priceDecimals;
        uint256 lotDecimals;
        bytes32 linkFeedId;
        uint256 priceTolPer100K;
        uint256 marginTol;
        uint256 marginTolDecimals;
        uint256 refPriceMaxAgeSec;
        uint256 positionBalanceCNS;
        uint256 insuranceBalanceCNS;
        uint256 markPNS;
        uint256 markTimestamp;
        uint256 lastPNS;
        uint256 lastTimestamp;
        uint256 oraclePNS;
        uint256 oracleTimestampSec;
        uint256 longOpenInterestLNS;
        uint256 shortOpenInterestLNS;
        uint256 fundingStartBlock;
        int16 fundingRatePct100k;
        uint256 absFundingClampPctPer100K;
        uint8 status;
        uint256 basePricePNS;
        uint256 maxBidPriceONS;
        uint256 minBidPriceONS;
        uint256 maxAskPriceONS;
        uint256 minAskPriceONS;
        uint256 numOrders;
        bool ignOracle;
    }

    function createAccount(uint256 amountCNS) external returns (uint256 accountId);
    function depositCollateral(uint256 amountCNS) external;
    function withdrawCollateral(uint256 amountCNS) external;
    function execOrder(OrderDesc calldata orderDesc) external returns (OrderSignature memory);
    function getAccountByAddr(address accountAddress) external view returns (AccountInfo memory);
    function getPosition(uint256 perpId, uint256 accountId)
        external
        view
        returns (PositionInfo memory positionInfo, uint256 markPricePNS, bool markPriceValid);
    function getPerpetualInfo(uint256 perpId) external view returns (PerpetualInfo memory);
}

/// @notice IEngine adapter for the Perpl perp DEX on Monad. One Perpl account (this contract) holds
/// all positions. Perpl nets positions per (market, account), so only one round per market can be
/// open at a time.
///
/// Accounting is per round and exact: every change of the account free balance caused by the
/// round (deposit, open fee, position margin, close proceeds) is measured as a balance delta right
/// around the call and added to the round credit. The owner buffer (needed because the first
/// deposit must be >= getMinAccountOpenCNS) absorbs only rounding and is never paid to a round.
contract PerplEngine is IEngine {
    struct Pos {
        uint256 perpId;
        uint256 margin;  // pulled from Rounds
        int256 credit;   // round share of the account free balance (signed balance deltas)
        uint256 lotLNS;  // size filled at open
        bool isLong;
        bool open;       // position opened and round not finished
        bool closed;     // position closed on Perpl, credit is final
    }

    uint256 constant BPS = 10_000;
    uint256 constant CNS = 1e6; // collateral decimals (AUSD)

    IPerplDex public immutable exchange;
    IERC20Min public immutable token;
    address public owner;
    address public rounds;

    uint256 public accountId; // Perpl account id of this contract, 0 until init
    uint256 public buffer;    // owner collateral kept in the Perpl account
    uint256 public slippageBps = 100;      // worst IOC price vs mark
    uint256 public maxNegPnlBps = 1_000;   // Perpl maxNegPnlCollatBPS on open

    mapping(uint256 => uint256) public leverageOf; // perpId => leverage (x, integer), 0 = disabled
    mapping(uint256 => uint256) public busyRound;  // perpId => roundId + 1 of the open round, 0 = free
    mapping(uint256 => Pos) public positions;      // roundId => position

    event OwnerSet(address owner);
    event RoundsSet(address rounds);
    event Initialized(uint256 accountId, uint256 buffer);
    event BufferChanged(uint256 buffer);
    event LeverageSet(uint256 indexed perpId, uint256 leverage);
    event SlippageSet(uint256 slippageBps, uint256 maxNegPnlBps);
    event Opened(uint256 indexed roundId, uint256 indexed perpId, bool isLong, uint256 margin, uint256 lotLNS, int256 credit);
    event PositionClosed(uint256 indexed roundId, uint256 lotLNS, int256 credit);
    event Closed(uint256 indexed roundId, uint256 returned);
    event Cleared(uint256 indexed roundId);

    error NotOwner();
    error NotRounds();
    error NotInitialized();
    error AlreadyInitialized();
    error BadAmount();
    error BadMarket();
    error MarketBusy();
    error RoundUsed();
    error NotOpen();
    error NotFilled();
    error NotClosed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRounds() {
        if (msg.sender != rounds) revert NotRounds();
        _;
    }

    constructor(IPerplDex exchange_, IERC20Min token_, address rounds_) {
        exchange = exchange_;
        token = token_;
        owner = msg.sender;
        rounds = rounds_;
        token_.approve(address(exchange_), type(uint256).max);
        emit OwnerSet(msg.sender);
        emit RoundsSet(rounds_);
    }

    // ---------------------------------------------------------------- owner

    function setOwner(address owner_) external onlyOwner {
        owner = owner_;
        emit OwnerSet(owner_);
    }

    function setRounds(address rounds_) external onlyOwner {
        rounds = rounds_;
        emit RoundsSet(rounds_);
    }

    /// @notice Leverage cap for a market (integer x, e.g. 15), also the default when a round asks
    /// for 0. Must be <= the Perpl max for the market. 0 = market disabled.
    function setLeverage(uint256 perpId, uint256 leverage) external onlyOwner {
        if (leverage > 100) revert BadAmount();
        leverageOf[perpId] = leverage;
        emit LeverageSet(perpId, leverage);
    }

    /// @param slippageBps_ worst IOC price distance from mark, in bps
    /// @param maxNegPnlBps_ Perpl maxNegPnlCollatBPS for opens (loss vs mark the fill may lock)
    function setSlippage(uint256 slippageBps_, uint256 maxNegPnlBps_) external onlyOwner {
        if (slippageBps_ == 0 || slippageBps_ >= BPS || maxNegPnlBps_ > type(uint16).max) revert BadAmount();
        slippageBps = slippageBps_;
        maxNegPnlBps = maxNegPnlBps_;
        emit SlippageSet(slippageBps_, maxNegPnlBps_);
    }

    /// @notice Create the Perpl account with owner collateral (>= getMinAccountOpenCNS, 100 AUSD now).
    /// This collateral stays in the account as a buffer and is not part of any round.
    function init(uint256 amount) external onlyOwner {
        if (accountId != 0) revert AlreadyInitialized();
        _pull(msg.sender, amount);
        accountId = exchange.createAccount(amount);
        buffer = amount;
        emit Initialized(accountId, amount);
    }

    /// @notice Add owner collateral to the buffer.
    function addBuffer(uint256 amount) external onlyOwner {
        if (accountId == 0) revert NotInitialized();
        _pull(msg.sender, amount);
        exchange.depositCollateral(amount);
        buffer += amount;
        emit BufferChanged(buffer);
    }

    /// @notice Rescue: withdraw collateral from the Perpl account to `to`. Lowers the buffer first.
    /// Use with care while rounds are open: it can take collateral that belongs to a round.
    function rescueExchange(uint256 amount, address to) external onlyOwner {
        exchange.withdrawCollateral(amount);
        buffer = amount >= buffer ? 0 : buffer - amount;
        _send(to, amount);
        emit BufferChanged(buffer);
    }

    /// @notice Rescue: send any token held by this contract (not in Perpl) to `to`.
    function rescueToken(IERC20Min t, address to, uint256 amount) external onlyOwner {
        if (!t.transfer(to, amount)) revert TransferFailed();
    }

    /// @notice Close the Perpl position of a round now, keep the proceeds in the account until
    /// Rounds calls close. For early de-risking, or when a withdrawal is blocked by the rate limit.
    function closePosition(uint256 roundId) external onlyOwner {
        _closePosition(roundId);
    }

    /// @notice Forget a round (free its market) after the owner handled it by hand. Sends nothing.
    function clearRound(uint256 roundId) external onlyOwner {
        Pos storage p = positions[roundId];
        if (!p.open) revert NotOpen();
        p.open = false;
        busyRound[p.perpId] = 0;
        emit Cleared(roundId);
    }

    // ---------------------------------------------------------------- engine

    /// @inheritdoc IEngine
    function open(uint256 roundId, uint256 marketId, bool isLong, uint256 margin, uint256 leverage_)
        external
        onlyRounds
    {
        if (accountId == 0) revert NotInitialized();
        if (margin == 0) revert BadAmount();
        if (busyRound[marketId] != 0) revert MarketBusy();
        if (positions[roundId].margin != 0) revert RoundUsed();
        (IPerplDex.PositionInfo memory before,,) = exchange.getPosition(marketId, accountId);
        if (before.lotLNS != 0) revert MarketBusy(); // leftover position not owned by a round
        (uint256 leverage, uint256 lot, uint256 worst) = _size(marketId, isLong, margin, leverage_);

        _pull(msg.sender, margin);
        uint256 b0 = _balance();
        exchange.depositCollateral(margin);
        exchange.execOrder(_order(marketId, isLong ? 0 : 1, worst, lot, leverage * 100, maxNegPnlBps));
        int256 credit = int256(_balance()) - int256(b0);

        (IPerplDex.PositionInfo memory pos,,) = exchange.getPosition(marketId, accountId);
        if (pos.lotLNS == 0) revert NotFilled(); // reverts the deposit too: Rounds keeps its funds

        positions[roundId] = Pos(marketId, margin, credit, pos.lotLNS, isLong, true, false);
        busyRound[marketId] = roundId + 1;
        emit Opened(roundId, marketId, isLong, margin, pos.lotLNS, credit);
    }

    /// @inheritdoc IEngine
    function close(uint256 roundId) external onlyRounds returns (uint256 returned) {
        Pos storage p = positions[roundId];
        if (!p.open) revert NotOpen();
        if (!p.closed) _closePosition(roundId);
        p.open = false;
        busyRound[p.perpId] = 0;

        returned = p.credit > 0 ? uint256(p.credit) : 0;
        uint256 bal = _balance();
        if (returned > bal) returned = bal;
        if (returned != 0) {
            exchange.withdrawCollateral(returned);
            _send(msg.sender, returned);
        }
        emit Closed(roundId, returned);
    }

    // ---------------------------------------------------------------- views

    /// @notice Account free balance in Perpl (buffer + round credits of closed rounds + spare).
    function accountBalance() external view returns (uint256) {
        return accountId == 0 ? 0 : _balance();
    }

    /// @notice Current position of a market on the Perpl account.
    function positionOf(uint256 perpId) external view returns (IPerplDex.PositionInfo memory pos) {
        (pos,,) = exchange.getPosition(perpId, accountId);
    }

    // ---------------------------------------------------------------- internal

    /// @dev Reduce-only IOC for the whole position. If Perpl already removed it (liquidation), the
    /// round keeps only its credit. Reverts if the position is still open after the order.
    function _closePosition(uint256 roundId) internal {
        Pos storage p = positions[roundId];
        if (!p.open || p.closed) revert NotOpen();
        (IPerplDex.PositionInfo memory pos,,) = exchange.getPosition(p.perpId, accountId);
        if (pos.lotLNS != 0) {
            uint256 mark = exchange.getPerpetualInfo(p.perpId).markPNS;
            uint256 worst = p.isLong ? mark * (BPS - slippageBps) / BPS : mark * (BPS + slippageBps) / BPS;
            uint256 b0 = _balance();
            exchange.execOrder(_order(p.perpId, p.isLong ? 2 : 3, worst, pos.lotLNS, leverageOf[p.perpId] * 100, 0));
            (pos,,) = exchange.getPosition(p.perpId, accountId);
            if (pos.lotLNS != 0) revert NotClosed();
            p.credit += int256(_balance()) - int256(b0);
        }
        p.closed = true;
        emit PositionClosed(roundId, p.lotLNS, p.credit);
    }

    /// @dev Leverage (round value or the market cap), lot size and worst IOC price for an open.
    function _size(uint256 marketId, bool isLong, uint256 margin, uint256 leverage_)
        internal
        view
        returns (uint256 leverage, uint256 lot, uint256 worst)
    {
        uint256 cap = leverageOf[marketId]; // owner-set cap for the market, <= the Perpl max
        leverage = leverage_ == 0 ? cap : leverage_;
        if (cap == 0 || leverage > cap) revert BadMarket();
        IPerplDex.PerpetualInfo memory info = exchange.getPerpetualInfo(marketId);
        if (info.markPNS == 0) revert BadMarket();
        // size = notional / mark; lotLNS = margin * leverage * 10^(priceDec + lotDec) / (markPNS * 10^collatDec)
        lot = margin * leverage * 10 ** (info.priceDecimals + info.lotDecimals) / (info.markPNS * CNS);
        if (lot == 0) revert BadAmount();
        worst = isLong ? info.markPNS * (BPS + slippageBps) / BPS : info.markPNS * (BPS - slippageBps) / BPS;
    }

    function _order(uint256 perpId, uint8 orderType, uint256 price, uint256 lot, uint256 levHdths, uint256 negPnl)
        internal
        pure
        returns (IPerplDex.OrderDesc memory d)
    {
        d.perpId = perpId;
        d.orderType = orderType;
        d.pricePNS = price;
        d.lotLNS = lot;
        d.immediateOrCancel = true;
        d.leverageHdths = levHdths;
        d.maxNegPnlCollatBPS = negPnl;
    }

    function _balance() internal view returns (uint256) {
        return exchange.getAccountByAddr(address(this)).balanceCNS;
    }

    function _pull(address from, uint256 amount) internal {
        if (amount == 0) revert BadAmount();
        if (!token.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _send(address to, uint256 amount) internal {
        if (!token.transfer(to, amount)) revert TransferFailed();
    }
}
