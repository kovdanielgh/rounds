// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEngine} from "./IEngine.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice ERC-4626 vault, the subset we use (Morpho/Euler vault on mainnet, MockYieldVault on testnet).
interface IERC4626 {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Pyth Entropy v2, the subset we use.
interface IEntropyV2 {
    function requestV2() external payable returns (uint64 sequenceNumber);
    function getFeeV2() external view returns (uint128 fee);
}

/// @notice Price of a market, read on-chain. One adapter per venue (Perpl on Monad, Chainlink on RH Chain).
interface IPriceSource {
    function price(uint256 marketId) external view returns (uint256);
}

/// @notice No-loss rounds on one contract.
/// Owner creates a round with a thesis (Bullish/Bearish) on an asset. Users put part of their
/// deposit into the round. If the thesis is right, the round budget is drawn among participants:
/// 80% / 15% / 5% to three different winners, chance proportional to stake (Pyth Entropy).
/// A deposit is never at risk: only the budget is. Round length is in blocks and is editable.
///
/// Yield: all money sits in an ERC-4626 vault. Everything above the liabilities (balances,
/// treasury, round pots, fees) is earned yield. harvest() gives userYieldBps of it to all
/// depositors (base yield, pro rata to balance) and the rest to the treasury.
///
/// Budget: when the entry window closes, the treasury advances the yield the stakes are expected to
/// earn during the round (totalStake * roundAprBps * duration). It does not wait for the yield:
/// the yield earned during the round pays the advance back to the treasury.
///
/// Engine: at the same moment the whole budget goes to the engine, which opens a position on the
/// thesis (long for Bullish, short for Bearish). settle closes it. Max loss = round budget.
/// User deposits never go to the engine. If the thesis wins, feeBps of the profit is the protocol fee.
///
/// Phases of a round:
///   Open    (block <= entryEnd)            enter, add more, exit
///   Closed  (entryEnd < block, not drawn)  stakes are locked, no enter, no exit
///   Drawing / Settled                      prizes are drawn, then claim frees stake + prize
///
/// No trusted resolver: setStrike and settle read the price on-chain and anyone can call them, but
/// only in a short window after entryEnd / end (so the caller cannot pick the moment). After the
/// window only the owner can call them (fallback).
contract Rounds {
    enum Thesis { None, Bullish, Bearish }
    enum Status { None, Open, Drawing, Settled }
    enum Phase { None, Open, Closed, Drawing, Settled }

    struct Round {
        bytes32 asset;      // label of the reference market, e.g. "BTC"
        uint256 marketId;   // id in the price source (Perpl perpId)
        Thesis thesis;
        Status status;
        bool thesisWon;
        uint64 entryEnd;    // last block to enter
        uint64 end;         // block after which the round can be settled
        uint64 sequence;    // Entropy request id while Drawing
        uint32 count;       // participant slots ever used (tree size)
        uint256 budget;     // prize pot held in the vault; 0 while the money is in the engine
        uint256 borrowed;   // sent to the engine and not yet returned
        uint256 strike;     // on-chain price just after entryEnd
        uint256 finalPrice; // on-chain price just after end
        uint256 totalStake;
        address[3] winners;
        uint256 funded;     // budget when the position opened (advance + bonus): baseline for the fee
        uint64 start;       // block of creation (for progress bars)
        uint8 leverage;     // engine leverage for this round, 0 = engine default (market cap)
        uint256 accAtDraw;  // accYieldPerBalance when prizes were credited
    }

    struct RoundParams {
        bytes32 asset;
        uint256 marketId;
        Thesis thesis;
        uint256 bonus;         // extra budget from the treasury at creation (jackpot, sponsor), can be 0
        uint64 entryBlocks;    // 0 = default
        uint64 durationBlocks; // 0 = default
        string description;    // what the round is about, e.g. "BTC goes up before FOMC"
        string rules;          // how it resolves, in plain words
        uint8 leverage;        // engine leverage, 0 = engine default
    }

    struct Entry {
        uint32 index; // 1-based slot in the round tree, 0 = not entered
        uint256 stake;
        bool claimed;
        uint256 accAt;  // accYieldPerBalance when the stake last changed
        uint256 earned; // base yield of this stake (and prize) booked so far, final at claim
    }

    uint256 constant BPS = 10_000;
    uint256 constant SECOND_BPS = 1_500;
    uint256 constant THIRD_BPS = 500;

    uint256 constant MAX_FEE_BPS = 2_000;
    uint256 constant ACC = 1e18;

    IERC20 public immutable token;
    IERC4626 public immutable vault;
    IEntropyV2 public immutable entropy;
    IPriceSource public immutable priceSource;
    address public owner;
    IEngine public engine;

    uint256 public feeBps = 300;          // protocol fee, share of round profit
    uint256 public roundAprBps = 230;     // yield advanced to a round, per year, on its stakes
    uint256 public userYieldBps = 4_650;  // share of vault yield to depositors (~2% of ~4.3%)
    uint256 public blocksPerYear = 78_840_000; // 0.4 s blocks

    uint64 public defaultEntryBlocks;
    uint64 public defaultDurationBlocks;
    uint64 public callWindowBlocks = 150; // ~45 s on Monad

    // Liabilities. vault assets - liabilities = yield not harvested yet.
    uint256 public totalBalances; // all user balances, including yield credited lazily
    uint256 public treasury;      // team capital + yield share, not assigned to a round
    uint256 public reserved;      // round pots in the vault + prizes not claimed yet
    uint256 public fees;          // protocol fees
    uint256 public roundCount;

    uint256 public accYieldPerBalance; // base yield per balance unit, scaled by ACC
    mapping(address => uint256) internal yieldDebt;

    mapping(uint256 => Round) internal rounds;
    mapping(uint256 => mapping(address => Entry)) public entries;
    mapping(uint256 => mapping(uint256 => address)) public userAt; // round => slot => user
    mapping(uint256 => mapping(uint256 => uint256)) internal tree;  // round => Fenwick tree of stakes
    mapping(uint256 => mapping(address => uint256)) public prizeOf;
    mapping(uint256 => string) public descriptionOf;
    mapping(uint256 => string) public rulesOf;
    mapping(uint64 => uint256) public roundOfSequence;

    mapping(address => uint256) public balanceOf; // deposit + won prizes
    mapping(address => uint256) public lockedOf;  // part of balance staked in unclaimed rounds

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event TreasuryFunded(address indexed from, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event DefaultsSet(uint64 entryBlocks, uint64 durationBlocks);
    event RoundCreated(
        uint256 indexed id, bytes32 asset, uint256 marketId, Thesis thesis, uint64 entryEnd, uint64 end, uint256 budget
    );
    event CallWindowSet(uint64 blocks);
    event RoundText(uint256 indexed id, string description, string rules);
    event RoundTimesSet(uint256 indexed id, uint64 entryEnd, uint64 end);
    event Entered(uint256 indexed id, address indexed user, uint256 stake);
    event Exited(uint256 indexed id, address indexed user);
    event StrikeSet(uint256 indexed id, uint256 strike);
    event DrawRequested(uint256 indexed id, uint64 sequence);
    event Settled(uint256 indexed id, uint256 finalPrice, bool thesisWon, address[3] winners);
    event Claimed(uint256 indexed id, address indexed user, uint256 prize, uint256 earned);
    event Paid(address indexed user, uint256 amount);
    event EngineSet(address engine);
    event EngineOpened(uint256 indexed id, uint256 margin);
    event EngineSkipped(uint256 indexed id, uint256 budget);
    event EngineReturned(uint256 indexed id, uint256 borrowed, uint256 returned);
    event EconomicsSet(uint256 feeBps, uint256 roundAprBps, uint256 userYieldBps, uint256 blocksPerYear);
    event Harvested(uint256 yield, uint256 toUsers, uint256 toTreasury);
    event BudgetAdvanced(uint256 indexed id, uint256 advance);
    event FeeTaken(uint256 indexed id, uint256 fee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error OutsideWindow();
    error BadVault();
    error EngineOpen();
    error NotEntropy();
    error BadAmount();
    error BadTimes();
    error BadThesis();
    error WrongPhase();
    error NotEntered();
    error InsufficientFree();
    error InsufficientFee();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        IERC20 token_,
        IERC4626 vault_,
        IEntropyV2 entropy_,
        IPriceSource priceSource_,
        uint64 entryBlocks_,
        uint64 durationBlocks_
    ) {
        if (vault_.asset() != address(token_)) revert BadVault();
        token = token_;
        vault = vault_;
        token_.approve(address(vault_), type(uint256).max);
        entropy = entropy_;
        priceSource = priceSource_;
        owner = msg.sender;
        _setDefaults(entryBlocks_, durationBlocks_);
    }

    // ---------------------------------------------------------------- admin

    function setOwner(address owner_) external onlyOwner {
        owner = owner_;
    }

    function setCallWindow(uint64 blocks) external onlyOwner {
        if (blocks == 0) revert BadTimes();
        callWindowBlocks = blocks;
        emit CallWindowSet(blocks);
    }

    /// @notice Engine adapter; address(0) = rounds run without a position (budget is the prize).
    function setEngine(IEngine engine_) external onlyOwner {
        engine = engine_;
        emit EngineSet(address(engine_));
    }

    function setEconomics(uint256 feeBps_, uint256 roundAprBps_, uint256 userYieldBps_, uint256 blocksPerYear_)
        external
        onlyOwner
    {
        if (feeBps_ > MAX_FEE_BPS || userYieldBps_ > BPS || blocksPerYear_ == 0) revert BadAmount();
        feeBps = feeBps_;
        roundAprBps = roundAprBps_;
        userYieldBps = userYieldBps_;
        blocksPerYear = blocksPerYear_;
        emit EconomicsSet(feeBps_, roundAprBps_, userYieldBps_, blocksPerYear_);
    }

    function withdrawFees(address to) external onlyOwner {
        uint256 amount = fees;
        if (amount == 0) revert BadAmount();
        fees = 0;
        _push(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    /// @notice Write off an engine position that will not come back, so the round can settle.
    function writeOffEngine(uint256 id) external onlyOwner {
        Round storage r = rounds[id];
        if (r.borrowed == 0) revert BadAmount();
        emit EngineReturned(id, r.borrowed, 0);
        r.borrowed = 0;
    }

    function setDefaults(uint64 entryBlocks_, uint64 durationBlocks_) external onlyOwner {
        _setDefaults(entryBlocks_, durationBlocks_);
    }

    /// @notice Add team capital to the treasury. It pays round advances before the yield comes in.
    function fundTreasury(uint256 amount) external {
        if (amount == 0) revert BadAmount();
        _pull(amount);
        treasury += amount;
        emit TreasuryFunded(msg.sender, amount);
    }

    /// @notice Take back team capital from the treasury. Round budgets and user deposits are not in it.
    function withdrawTreasury(address to, uint256 amount) external onlyOwner {
        if (amount == 0 || amount > treasury) revert BadAmount();
        treasury -= amount;
        _push(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }

    /// @notice Create a round, starting now. Zero lengths take the defaults.
    function createRound(RoundParams calldata p) external onlyOwner returns (uint256 id) {
        id = _create(p);
    }

    /// @notice Create several rounds in one transaction: a mirror pair gets exactly the same blocks.
    function createRounds(RoundParams[] calldata ps) external onlyOwner returns (uint256 firstId) {
        for (uint256 i; i < ps.length; i++) {
            uint256 id = _create(ps[i]);
            if (i == 0) firstId = id;
        }
    }

    function _create(RoundParams calldata p) internal returns (uint256 id) {
        uint64 entryEnd = uint64(block.number) + (p.entryBlocks == 0 ? defaultEntryBlocks : p.entryBlocks);
        uint64 end = entryEnd + (p.durationBlocks == 0 ? defaultDurationBlocks : p.durationBlocks);
        id = _createRound(p.asset, p.marketId, p.thesis, p.bonus, entryEnd, end);
        rounds[id].leverage = p.leverage;
        descriptionOf[id] = p.description;
        rulesOf[id] = p.rules;
        emit RoundText(id, p.description, p.rules);
    }

    /// @notice Edit the blocks of an open round. entryEnd can only move while entry is open;
    /// end can move until it is reached.
    function setRoundTimes(uint256 id, uint64 entryEnd, uint64 end) external onlyOwner {
        Round storage r = rounds[id];
        if (r.status != Status.Open || block.number > r.end) revert WrongPhase();
        if (entryEnd != r.entryEnd && (block.number > r.entryEnd || entryEnd < block.number)) revert BadTimes();
        if (end <= entryEnd || end < block.number) revert BadTimes();
        r.entryEnd = entryEnd;
        r.end = end;
        emit RoundTimesSet(id, entryEnd, end);
    }

    // ---------------------------------------------------------------- keeper (anyone)

    /// @notice Fix the strike from the on-chain price, just after the entry window closes.
    function setStrike(uint256 id) external {
        _setStrike(id);
    }

    /// @notice Fix several strikes in one transaction, so the two sides of a mirror pair get the same price.
    function setStrikeMany(uint256[] calldata ids) external {
        for (uint256 i; i < ids.length; i++) _setStrike(ids[i]);
    }

    /// @notice Resolve the thesis from the on-chain price, just after the round end. If it won and
    /// there are participants, the whole pot (budget after the engine PnL) is drawn: send at least
    /// entropy.getFeeV2() as value, the rest is refunded. If it lost, the pot goes back to treasury.
    function settle(uint256 id) external payable {
        _refund(msg.value - _settle(id, msg.value));
    }

    /// @notice Settle several rounds in one transaction at one price (mirror pairs). Send
    /// entropy.getFeeV2() for each round that may draw; the rest is refunded.
    function settleMany(uint256[] calldata ids) external payable {
        uint256 left = msg.value;
        for (uint256 i; i < ids.length; i++) left -= _settle(ids[i], left);
        _refund(left);
    }

    function _setStrike(uint256 id) internal {
        Round storage r = rounds[id];
        if (r.status != Status.Open || r.strike != 0 || block.number <= r.entryEnd) revert WrongPhase();
        _checkWindow(r.entryEnd);
        uint256 strike = priceSource.price(r.marketId);
        if (strike == 0) revert BadAmount();
        r.strike = strike;
        emit StrikeSet(id, strike);

        if (r.totalStake == 0) return;
        harvest();
        uint256 advance = r.totalStake * roundAprBps * (r.end - r.entryEnd) / (BPS * blocksPerYear);
        if (advance > treasury) advance = treasury;
        if (advance > 0) {
            treasury -= advance;
            reserved += advance;
            r.budget += advance;
            emit BudgetAdvanced(id, advance);
        }
        r.funded = r.budget;
        _openPosition(id, r);
    }

    /// @dev Returns the Entropy fee it spent (0 when there is no draw).
    function _settle(uint256 id, uint256 value) internal returns (uint256 used) {
        Round storage r = rounds[id];
        if (r.status != Status.Open || block.number <= r.end || r.strike == 0) revert WrongPhase();
        _checkWindow(r.end);
        uint256 finalPrice = priceSource.price(r.marketId);
        if (finalPrice == 0) revert BadAmount();
        if (r.borrowed != 0) _closePosition(id, r);

        r.finalPrice = finalPrice;
        r.thesisWon = r.thesis == Thesis.Bullish ? finalPrice > r.strike : finalPrice < r.strike;

        if (r.thesisWon && r.budget > r.funded) {
            uint256 fee = (r.budget - r.funded) * feeBps / BPS;
            r.budget -= fee;
            reserved -= fee;
            fees += fee;
            emit FeeTaken(id, fee);
        }

        if (!r.thesisWon || r.totalStake == 0 || r.budget == 0) {
            reserved -= r.budget;
            treasury += r.budget;
            r.status = Status.Settled;
            emit Settled(id, finalPrice, r.thesisWon, r.winners);
            return 0;
        }
        r.status = Status.Drawing;
        used = _requestDraw(id, value);
    }

    /// @notice Request randomness again if the callback did not arrive. Owner only: a public retry
    /// would let anyone cancel a draw result they saw coming.
    function retryDraw(uint256 id) external payable onlyOwner {
        if (rounds[id].status != Status.Drawing) revert WrongPhase();
        _refund(msg.value - _requestDraw(id, msg.value));
    }

    /// @notice Called by Pyth Entropy (same signature as IEntropyConsumer in the Pyth SDK).
    function _entropyCallback(uint64 sequence, address, bytes32 randomNumber) external {
        if (msg.sender != address(entropy)) revert NotEntropy();
        uint256 id = roundOfSequence[sequence];
        Round storage r = rounds[id];
        if (r.status != Status.Drawing || r.sequence != sequence) return; // stale request after retry
        _draw(id, r, randomNumber);
    }

    // ---------------------------------------------------------------- users

    function deposit(uint256 amount) external {
        _deposit(amount);
    }

    /// @notice Withdraw free balance. Staked balance is freed by exitRound (Open phase) or claim (Settled).
    function withdraw(uint256 amount) external {
        if (amount == 0) revert BadAmount();
        harvest();
        _accrue(msg.sender);
        if (balanceOf[msg.sender] - lockedOf[msg.sender] < amount) revert InsufficientFree();
        balanceOf[msg.sender] -= amount;
        totalBalances -= amount;
        _syncDebt(msg.sender);
        _push(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Deposit and put it into a round in one call.
    function depositAndEnter(uint256 id, uint256 amount) external {
        _deposit(amount);
        _enter(id, amount);
    }

    /// @notice Split the yield earned since the last harvest. Anyone can call; users' calls do it too.
    function harvest() public {
        uint256 assets = vault.convertToAssets(vault.balanceOf(address(this)));
        uint256 liabilities = totalBalances + treasury + reserved + fees;
        if (assets <= liabilities) return;
        uint256 yield_ = assets - liabilities;
        uint256 toUsers = totalBalances == 0 ? 0 : yield_ * userYieldBps / BPS;
        if (toUsers > 0) {
            accYieldPerBalance += toUsers * ACC / totalBalances;
            totalBalances += toUsers;
        }
        treasury += yield_ - toUsers;
        emit Harvested(yield_, toUsers, yield_ - toUsers);
    }

    /// @notice Put part of the deposit into a round. Can be called again to add more.
    function enter(uint256 id, uint256 stake) external {
        _enter(id, stake);
    }

    function _enter(uint256 id, uint256 stake) internal {
        Round storage r = rounds[id];
        if (r.status != Status.Open || block.number > r.entryEnd) revert WrongPhase();
        if (stake == 0) revert BadAmount();
        if (balanceOf[msg.sender] - lockedOf[msg.sender] < stake) revert InsufficientFree();

        Entry storage e = entries[id][msg.sender];
        _bookEarned(e);
        if (e.index == 0) {
            e.index = ++r.count;
            userAt[id][e.index] = msg.sender;
            _treeAppend(id, e.index, stake);
        } else {
            _treeAdd(id, r.count, e.index, stake);
        }
        e.stake += stake;
        r.totalStake += stake;
        lockedOf[msg.sender] += stake;
        emit Entered(id, msg.sender, stake);
    }

    /// @notice Leave a round while it is Open and free the stake. After the window closes, stakes are locked.
    function exitRound(uint256 id) external {
        Round storage r = rounds[id];
        Entry storage e = entries[id][msg.sender];
        if (r.status != Status.Open || block.number > r.entryEnd) revert WrongPhase();
        if (e.stake == 0) revert NotEntered();

        harvest();
        _accrue(msg.sender);
        _bookEarned(e);
        _treeSub(id, r.count, e.index, e.stake);
        r.totalStake -= e.stake;
        lockedOf[msg.sender] -= e.stake;
        e.stake = 0; // keep the slot, a later enter reuses it
        emit Exited(id, msg.sender);
        _payout(msg.sender);
    }

    /// @notice After settlement: free the stakes of these rounds and send everything free (stakes,
    /// prizes, base yield) to the wallet. One call for one round or for all of them.
    /// Prizes are credited at the draw, so they earn base yield until this call.
    function claim(uint256[] calldata ids) external returns (uint256 paid) {
        harvest();
        _accrue(msg.sender);
        for (uint256 i; i < ids.length; i++) {
            uint256 id = ids[i];
            Round storage r = rounds[id];
            Entry storage e = entries[id][msg.sender];
            if (r.status != Status.Settled) revert WrongPhase();
            if (e.stake == 0 || e.claimed) revert NotEntered();
            uint256 prize = prizeOf[id][msg.sender];
            _bookEarned(e);
            if (prize > 0) e.earned += prize * (accYieldPerBalance - r.accAtDraw) / ACC;
            e.claimed = true;
            lockedOf[msg.sender] -= e.stake;
            emit Claimed(id, msg.sender, prize, e.earned);
        }
        _syncDebt(msg.sender);
        paid = _payout(msg.sender);
    }

    // ---------------------------------------------------------------- views

    function phase(uint256 id) external view returns (Phase) {
        Round storage r = rounds[id];
        if (r.status == Status.Open) return block.number <= r.entryEnd ? Phase.Open : Phase.Closed;
        if (r.status == Status.Drawing) return Phase.Drawing;
        if (r.status == Status.Settled) return Phase.Settled;
        return Phase.None;
    }

    function freeBalanceOf(address user) external view returns (uint256) {
        return balanceOf[user] + _pending(user) - lockedOf[user];
    }

    /// @notice Balance including base yield credited since the user's last action (harvested part only).
    function balanceWithYield(address user) external view returns (uint256) {
        return balanceOf[user] + _pending(user);
    }

    function getRound(uint256 id) external view returns (Round memory) {
        return rounds[id];
    }

    /// @notice Base yield of a user's stake (and prize) in a round: live until claim, then final.
    function earnedOf(uint256 id, address user) external view returns (uint256) {
        Entry storage e = entries[id][user];
        if (e.claimed) return e.earned;
        uint256 acc = accYieldPerBalance;
        uint256 earned = e.earned + e.stake * (acc - e.accAt) / ACC;
        uint256 prize = prizeOf[id][user];
        if (prize > 0) earned += prize * (acc - rounds[id].accAtDraw) / ACC;
        return earned;
    }

    function drawFee() external view returns (uint256) {
        return entropy.getFeeV2();
    }

    // ---------------------------------------------------------------- internal: rounds

    function _setDefaults(uint64 entryBlocks_, uint64 durationBlocks_) internal {
        if (entryBlocks_ == 0 || durationBlocks_ == 0) revert BadTimes();
        defaultEntryBlocks = entryBlocks_;
        defaultDurationBlocks = durationBlocks_;
        emit DefaultsSet(entryBlocks_, durationBlocks_);
    }

    function _checkWindow(uint64 from) internal view {
        if (block.number > from + callWindowBlocks && msg.sender != owner) revert OutsideWindow();
    }

    function _createRound(
        bytes32 asset,
        uint256 marketId,
        Thesis thesis,
        uint256 budget,
        uint64 entryEnd,
        uint64 end
    ) internal returns (uint256 id) {
        if (thesis == Thesis.None) revert BadThesis();
        if (entryEnd <= block.number || end <= entryEnd) revert BadTimes();
        if (budget > treasury) revert BadAmount();
        treasury -= budget;
        reserved += budget;
        id = ++roundCount;
        Round storage r = rounds[id];
        r.asset = asset;
        r.marketId = marketId;
        r.start = uint64(block.number);
        r.thesis = thesis;
        r.entryEnd = entryEnd;
        r.end = end;
        r.status = Status.Open;
        r.budget = budget;
        emit RoundCreated(id, asset, marketId, thesis, entryEnd, end, budget);
    }

    /// @dev Send the whole budget to the engine. If the engine cannot open, the round goes on
    /// without a position and the budget stays the prize.
    function _openPosition(uint256 id, Round storage r) internal {
        uint256 margin = r.budget;
        if (address(engine) == address(0) || margin == 0) return;
        vault.withdraw(margin, address(this), address(this));
        token.approve(address(engine), margin);
        try engine.open(id, r.marketId, r.thesis == Thesis.Bullish, margin, r.leverage) {
            r.budget = 0;
            r.borrowed = margin;
            reserved -= margin;
            emit EngineOpened(id, margin);
        } catch {
            token.approve(address(engine), 0);
            vault.deposit(margin, address(this));
            emit EngineSkipped(id, margin);
        }
    }

    function _closePosition(uint256 id, Round storage r) internal {
        uint256 returned = engine.close(id);
        if (returned > 0) vault.deposit(returned, address(this));
        r.budget += returned;
        reserved += returned;
        emit EngineReturned(id, r.borrowed, returned);
        r.borrowed = 0;
    }

    function _deposit(uint256 amount) internal {
        if (amount == 0) revert BadAmount();
        harvest();
        _accrue(msg.sender);
        _pull(amount);
        balanceOf[msg.sender] += amount;
        totalBalances += amount;
        _syncDebt(msg.sender);
        emit Deposited(msg.sender, amount);
    }

    /// @dev Book the base yield of the current stake up to now (call before the stake changes).
    function _bookEarned(Entry storage e) internal {
        if (e.stake > 0) e.earned += e.stake * (accYieldPerBalance - e.accAt) / ACC;
        e.accAt = accYieldPerBalance;
    }

    /// @dev Send the whole free balance to the user's wallet.
    function _payout(address user) internal returns (uint256 amount) {
        amount = balanceOf[user] - lockedOf[user];
        if (amount == 0) return 0;
        balanceOf[user] -= amount;
        totalBalances -= amount;
        _syncDebt(user);
        _push(user, amount);
        emit Paid(user, amount);
    }

    function _pending(address user) internal view returns (uint256) {
        return balanceOf[user] * (accYieldPerBalance - yieldDebt[user]) / ACC;
    }

    /// @dev Credit the base yield to the balance. totalBalances already counts it (see harvest).
    function _accrue(address user) internal {
        uint256 pending = _pending(user);
        if (pending > 0) balanceOf[user] += pending;
        yieldDebt[user] = accYieldPerBalance;
    }

    function _syncDebt(address user) internal {
        yieldDebt[user] = accYieldPerBalance;
    }

    /// @dev Pays the Entropy fee from `value` and returns it.
    function _requestDraw(uint256 id, uint256 value) internal returns (uint256 fee) {
        fee = entropy.getFeeV2();
        if (value < fee) revert InsufficientFee();
        uint64 sequence = entropy.requestV2{value: fee}();
        rounds[id].sequence = sequence;
        roundOfSequence[sequence] = id;
        emit DrawRequested(id, sequence);
    }

    /// @dev Pick up to 3 different winners weighted by stake. A picked stake is removed from the
    /// tree before the next pick and restored after. Missing places go to the 1st place.
    function _draw(uint256 id, Round storage r, bytes32 seed) internal {
        uint256 n = r.count;
        uint256 remaining = r.totalStake;
        uint256[3] memory picked;
        uint256[3] memory stakes;
        uint256 k;
        for (; k < 3 && remaining > 0; k++) {
            uint256 ticket = uint256(keccak256(abi.encode(seed, k))) % remaining;
            uint256 idx = _treeFind(id, n, ticket);
            address w = userAt[id][idx];
            picked[k] = idx;
            stakes[k] = entries[id][w].stake;
            r.winners[k] = w;
            _treeSub(id, n, idx, stakes[k]);
            remaining -= stakes[k];
        }
        for (uint256 i; i < k; i++) {
            _treeAdd(id, n, picked[i], stakes[i]);
        }

        uint256 second = k > 1 ? r.budget * SECOND_BPS / BPS : 0;
        uint256 third = k > 2 ? r.budget * THIRD_BPS / BPS : 0;
        uint256[3] memory prize = [r.budget - second - third, second, third];
        // Credit prizes now, so they earn base yield until the winner claims.
        r.accAtDraw = accYieldPerBalance;
        for (uint256 i; i < k; i++) {
            address w = r.winners[i];
            prizeOf[id][w] = prize[i];
            _accrue(w);
            balanceOf[w] += prize[i];
            _syncDebt(w);
        }
        totalBalances += r.budget;
        reserved -= r.budget;

        r.status = Status.Settled;
        emit Settled(id, r.finalPrice, true, r.winners);
    }

    // ---------------------------------------------------------------- internal: Fenwick tree of stakes

    function _treePrefix(uint256 id, uint256 i) internal view returns (uint256 s) {
        mapping(uint256 => uint256) storage t = tree[id];
        for (; i > 0; i -= i & (~i + 1)) s += t[i];
    }

    /// @dev Append slot i = n (new last) with value v.
    function _treeAppend(uint256 id, uint256 i, uint256 v) internal {
        uint256 low = i & (~i + 1);
        tree[id][i] = v + _treePrefix(id, i - 1) - _treePrefix(id, i - low);
    }

    function _treeAdd(uint256 id, uint256 n, uint256 i, uint256 v) internal {
        mapping(uint256 => uint256) storage t = tree[id];
        for (; i <= n; i += i & (~i + 1)) t[i] += v;
    }

    function _treeSub(uint256 id, uint256 n, uint256 i, uint256 v) internal {
        mapping(uint256 => uint256) storage t = tree[id];
        for (; i <= n; i += i & (~i + 1)) t[i] -= v;
    }

    /// @dev Smallest slot whose prefix sum is > ticket. Requires ticket < total.
    function _treeFind(uint256 id, uint256 n, uint256 ticket) internal view returns (uint256) {
        mapping(uint256 => uint256) storage t = tree[id];
        uint256 pos;
        uint256 step = 1;
        while (step << 1 <= n) step <<= 1;
        for (; step > 0; step >>= 1) {
            uint256 next = pos + step;
            if (next <= n && t[next] <= ticket) {
                pos = next;
                ticket -= t[next];
            }
        }
        return pos + 1;
    }

    // ---------------------------------------------------------------- internal: transfers

    /// @dev Take tokens from the caller and put them into the vault.
    function _pull(uint256 amount) internal {
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        vault.deposit(amount, address(this));
    }

    /// @dev Take tokens out of the vault and send them.
    function _push(address to, uint256 amount) internal {
        vault.withdraw(amount, to, address(this));
    }

    function _refund(uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
