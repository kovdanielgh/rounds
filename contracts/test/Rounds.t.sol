// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Rounds, IERC20, IERC4626, IEntropyV2, IPriceSource} from "../src/Rounds.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockEntropy} from "./MockEntropy.sol";
import {MockPriceSource} from "./MockPriceSource.sol";
import {MockEngine} from "./MockEngine.sol";
import {MockYieldVault, IERC20Like} from "../src/MockYieldVault.sol";
import {IEngine} from "../src/IEngine.sol";

contract RoundsTest is Test {
    receive() external payable {}

    /// Claim one round as `u`; returns what reached the wallet.
    function _claim(address u, uint256 id) internal returns (uint256 paid) {
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        vm.prank(u);
        paid = rounds.claim(ids);
    }

    function _create(bytes32 asset, uint256 marketId, Rounds.Thesis thesis, uint256 budget) internal returns (uint256) {
        return _create(asset, marketId, thesis, budget, 0, 0);
    }

    function _create(bytes32 asset, uint256 marketId, Rounds.Thesis thesis, uint256 budget, uint64 entry, uint64 duration)
        internal
        returns (uint256)
    {
        return rounds.createRound(
            Rounds.RoundParams(asset, marketId, thesis, budget, entry, duration, "BTC goes up", "Mark price TWAP vs strike", 0)
        );
    }

    function test_descriptionAndRulesStored() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 1e6);
        assertEq(rounds.descriptionOf(id), "BTC goes up");
        assertEq(rounds.getRound(id).start, block.number);
        assertEq(rounds.rulesOf(id), "Mark price TWAP vs strike");
    }

    MockUSD usd;
    MockEntropy entropy;
    MockPriceSource px;
    MockYieldVault vault;
    MockEngine eng;
    Rounds rounds;
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address engine = makeAddr("engine");
    bytes32 constant MON = "MON-PERP";

    function setUp() public {
        usd = new MockUSD();
        entropy = new MockEntropy();
        px = new MockPriceSource();
        vault = new MockYieldVault(IERC20Like(address(usd)), 0);
        rounds = new Rounds(
            IERC20(address(usd)), IERC4626(address(vault)), IEntropyV2(address(entropy)), IPriceSource(address(px)), 10, 20
        );
        rounds.setEconomics(300, 0, 4_650, 78_840_000); // no advance in the basic tests
        eng = new MockEngine(usd);
        usd.mint(address(this), 1_000_000e6);
        usd.approve(address(rounds), type(uint256).max);
        rounds.fundTreasury(1_000_000e6);
        vm.deal(keeper, 100 ether);
        _fund(alice, 300e6);
        _fund(bob, 100e6);
        _fund(carol, 500e6);
        _fund(dave, 100e6);
    }

    function _fund(address u, uint256 amount) internal {
        usd.mint(u, amount);
        vm.startPrank(u);
        usd.approve(address(rounds), type(uint256).max);
        rounds.deposit(amount);
        vm.stopPrank();
    }

    function _enter(address u, uint256 id, uint256 stake) internal {
        vm.prank(u);
        rounds.enter(id, stake);
    }

    /// strike 2000 -> final price; returns entropy sequence (0 if no draw)
    function _resolve(uint256 id, uint256 finalPrice) internal returns (uint64) {
        vm.roll(rounds.getRound(id).entryEnd + 1);
        px.set(1, 2_000);
        vm.prank(keeper);
        rounds.setStrike(id);
        vm.roll(rounds.getRound(id).end + 1);
        px.set(1, finalPrice);
        vm.prank(keeper);
        rounds.settle{value: 0.3 ether}(id);
        return rounds.getRound(id).sequence;
    }

    function test_bullishWins_threeDifferentWinners_80_15_5() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 300e6);
        _enter(bob, id, 100e6);
        _enter(carol, id, 500e6);
        _enter(dave, id, 100e6);

        uint64 seq = _resolve(id, 2_100);
        assertEq(uint8(rounds.getRound(id).status), uint8(Rounds.Status.Drawing));
        assertEq(keeper.balance, 100 ether - 0.1 ether); // excess fee refunded
        entropy.fire(seq, keccak256("seed"));

        Rounds.Round memory r = rounds.getRound(id);
        assertEq(uint8(r.status), uint8(Rounds.Status.Settled));
        assertTrue(r.winners[0] != r.winners[1] && r.winners[1] != r.winners[2] && r.winners[0] != r.winners[2]);
        assertEq(rounds.prizeOf(id, r.winners[0]), 80e6);
        assertEq(rounds.prizeOf(id, r.winners[1]), 15e6);
        assertEq(rounds.prizeOf(id, r.winners[2]), 5e6);

        address[4] memory all = [alice, bob, carol, dave];
        uint256 sum;
        for (uint256 i; i < 4; i++) {
            (, uint256 st,,,) = rounds.entries(id, all[i]);
            uint256 paid = _claim(all[i], id);
            assertEq(rounds.lockedOf(all[i]), 0);
            assertEq(rounds.balanceOf(all[i]), 0);
            assertEq(usd.balanceOf(all[i]), paid);
            sum += paid - st;
        }
        assertEq(sum, 100e6);
        // every deposit is intact or bigger, now in the wallet
        assertGe(usd.balanceOf(carol), 500e6);
    }

    function test_thesisLost_noPrize_depositsSafe() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 300e6);
        assertEq(_resolve(id, 1_900), 0);
        assertEq(uint8(rounds.getRound(id).status), uint8(Rounds.Status.Settled));
        assertEq(keeper.balance, 100 ether); // no draw, full refund
        assertEq(_claim(alice, id), 300e6); // no prize: the whole deposit goes back to the wallet
        assertEq(usd.balanceOf(alice), 300e6);
        assertEq(rounds.balanceOf(alice), 0);
    }

    function test_bearishWinsOnDrop() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bearish, 10e6);
        _enter(alice, id, 1e6);
        uint64 seq = _resolve(id, 1_900);
        entropy.fire(seq, bytes32(uint256(1)));
        assertEq(rounds.prizeOf(id, alice), 10e6); // single participant takes all places
        assertEq(_claim(alice, id), 310e6); // deposit + prize to the wallet
    }

    function test_twoParticipants_thirdShareGoesToFirst() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 1e6);
        _enter(bob, id, 1e6);
        entropy.fire(_resolve(id, 2_001), bytes32(uint256(7)));
        Rounds.Round memory r = rounds.getRound(id);
        assertEq(rounds.prizeOf(id, r.winners[0]), 85e6);
        assertEq(rounds.prizeOf(id, r.winners[1]), 15e6);
        assertEq(r.winners[2], address(0));
    }

    function test_onlyEntropyCallsBack_andStaleSequenceIgnored() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        _enter(alice, id, 1e6);
        uint64 first = _resolve(id, 2_100);
        vm.expectRevert(Rounds.NotEntropy.selector);
        rounds._entropyCallback(first, address(0), bytes32(0));

        vm.deal(address(this), 1 ether);
        rounds.retryDraw{value: 0.1 ether}(id); // owner
        entropy.fire(first, bytes32(uint256(1))); // stale: ignored
        assertEq(uint8(rounds.getRound(id).status), uint8(Rounds.Status.Drawing));
        entropy.fire(rounds.getRound(id).sequence, bytes32(uint256(1)));
        assertEq(uint8(rounds.getRound(id).status), uint8(Rounds.Status.Settled));
    }

    function test_phases_lockedAfterWindow() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        assertEq(uint8(rounds.phase(id)), uint8(Rounds.Phase.Open));
        _enter(alice, id, 300e6);
        _enter(bob, id, 100e6);
        vm.prank(bob);
        rounds.exitRound(id); // Open: exit ok, money goes straight to the wallet
        assertEq(usd.balanceOf(bob), 100e6);
        assertEq(rounds.balanceOf(bob), 0);
        vm.prank(bob);
        rounds.depositAndEnter(id, 100e6);

        vm.roll(rounds.getRound(id).entryEnd + 1);
        assertEq(uint8(rounds.phase(id)), uint8(Rounds.Phase.Closed));
        vm.startPrank(alice);
        vm.expectRevert(Rounds.WrongPhase.selector);
        rounds.exitRound(id);
        vm.expectRevert(Rounds.InsufficientFree.selector);
        rounds.withdraw(1);
        vm.stopPrank();

        uint64 seq = _resolve(id, 2_100);
        assertEq(uint8(rounds.phase(id)), uint8(Rounds.Phase.Drawing));
        entropy.fire(seq, keccak256("p"));
        assertEq(uint8(rounds.phase(id)), uint8(Rounds.Phase.Settled));
        _claim(alice, id);
        assertEq(rounds.balanceOf(alice), 0);
        assertGe(usd.balanceOf(alice), 300e6);
    }

    function test_depositAndEnter() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        address eve = makeAddr("eve");
        usd.mint(eve, 50e6);
        vm.startPrank(eve);
        usd.approve(address(rounds), type(uint256).max);
        rounds.depositAndEnter(id, 50e6);
        vm.stopPrank();
        assertEq(rounds.balanceOf(eve), 50e6);
        assertEq(rounds.lockedOf(eve), 50e6);
        assertEq(rounds.getRound(id).totalStake, 50e6);
    }

    function test_exitedUserNeverWins() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        _enter(alice, id, 1e6);
        _enter(carol, id, 500e6);
        _enter(bob, id, 1e6);
        vm.prank(carol);
        rounds.exitRound(id);
        entropy.fire(_resolve(id, 2_100), keccak256("x"));
        Rounds.Round memory r = rounds.getRound(id);
        assertTrue(r.winners[0] != carol && r.winners[1] != carol);
        assertEq(r.winners[2], address(0));
    }

    function test_topUpStake() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        _enter(alice, id, 100e6);
        _enter(alice, id, 50e6);
        (, uint256 stake,,,) = rounds.entries(id, alice);
        assertEq(stake, 150e6);
        assertEq(rounds.lockedOf(alice), 150e6);
        assertEq(rounds.getRound(id).count, 1);
    }

    /// 1st place frequency should follow stake weights: alice 30%, bob 10%, carol 50%, dave 10%.
    function test_firstPlaceFrequencyFollowsStake() public {
        uint256 runs = 400;
        uint256[4] memory wins;
        address[4] memory all = [alice, bob, carol, dave];
        uint256[4] memory st = [uint256(300e6), 100e6, 500e6, 100e6];
        for (uint256 j; j < runs; j++) {
            uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 1e6);
            for (uint256 i; i < 4; i++) {
                vm.prank(all[i]);
                if (j == 0) rounds.enter(id, st[i]); // setUp deposit
                else rounds.depositAndEnter(id, st[i]); // claim sent it to the wallet
            }
            entropy.fire(_resolve(id, 2_100), keccak256(abi.encode(j)));
            address w = rounds.getRound(id).winners[0];
            for (uint256 i; i < 4; i++) {
                if (w == all[i]) wins[i]++;
                _claim(all[i], id);
            }
        }
        // expected 120 / 40 / 200 / 40, allow wide tolerance
        assertApproxEqAbs(wins[0], 120, 35);
        assertApproxEqAbs(wins[1], 40, 22);
        assertApproxEqAbs(wins[2], 200, 40);
        assertApproxEqAbs(wins[3], 40, 22);
    }

    function test_manyRoundsInOneContract_customLength() public {
        uint256 a = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        uint256 b = _create("BTC-PERP", 1, Rounds.Thesis.Bearish, 10e6, 5, 100);
        assertEq(b, a + 1);
        assertEq(rounds.getRound(b).entryEnd, block.number + 5);
        assertEq(rounds.getRound(b).end, block.number + 105);
        vm.expectRevert(Rounds.BadThesis.selector);
        _create(MON, 1, Rounds.Thesis.None, 1e6);
    }

    function test_editDefaultsAndRoundTimes() public {
        rounds.setDefaults(50, 100);
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        assertEq(rounds.getRound(id).end, block.number + 150);

        rounds.setRoundTimes(id, uint64(block.number + 3), uint64(block.number + 10));
        vm.roll(block.number + 4);
        uint64 entryEnd = rounds.getRound(id).entryEnd;
        vm.expectRevert(Rounds.BadTimes.selector);
        rounds.setRoundTimes(id, entryEnd + 1, uint64(block.number + 50));
        rounds.setRoundTimes(id, entryEnd, uint64(block.number + 50));
        assertEq(rounds.getRound(id).end, block.number + 50);
    }

    function test_noLateEntry_andRoles() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        vm.prank(alice);
        vm.expectRevert(Rounds.NotOwner.selector);
        _create(MON, 1, Rounds.Thesis.Bullish, 1e6);
        vm.roll(block.number + 11);
        vm.expectRevert(Rounds.WrongPhase.selector);
        _enter(alice, id, 1e6);
    }

    function test_anyoneCallsInWindow_onlyOwnerAfter() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        _enter(alice, id, 1e6);
        px.set(1, 2_000);

        vm.prank(bob);
        vm.expectRevert(Rounds.WrongPhase.selector); // entry still open
        rounds.setStrike(id);

        vm.roll(rounds.getRound(id).entryEnd + 1);
        vm.prank(bob); // anyone, inside the window
        rounds.setStrike(id);
        assertEq(rounds.getRound(id).strike, 2_000);
        vm.expectRevert(Rounds.WrongPhase.selector); // strike is fixed once
        rounds.setStrike(id);

        // settle window missed: bob cannot pick a later moment, owner can
        vm.roll(rounds.getRound(id).end + rounds.callWindowBlocks() + 1);
        px.set(1, 2_100);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(Rounds.OutsideWindow.selector);
        rounds.settle{value: 0.1 ether}(id);

        vm.deal(address(this), 1 ether);
        rounds.settle{value: 0.1 ether}(id); // owner fallback
        assertEq(uint8(rounds.phase(id)), uint8(Rounds.Phase.Drawing));
    }

    function test_priceComesFromSource() public {
        uint256 id = _create("BTC", 16, Rounds.Thesis.Bearish, 10e6);
        _enter(alice, id, 1e6);
        px.set(16, 80_000);
        vm.roll(rounds.getRound(id).entryEnd + 1);
        rounds.setStrike(id);
        px.set(16, 79_000);
        vm.roll(rounds.getRound(id).end + 1);
        vm.prank(keeper);
        rounds.settle{value: 0.1 ether}(id);
        Rounds.Round memory r = rounds.getRound(id);
        assertEq(r.strike, 80_000);
        assertEq(r.finalPrice, 79_000);
        assertTrue(r.thesisWon);
    }

    function test_settleNeedsFee() public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 10e6);
        _enter(alice, id, 1e6);
        vm.roll(block.number + 11);
        px.set(1, 2_000);
        vm.prank(keeper);
        rounds.setStrike(id);
        vm.roll(block.number + 21);
        px.set(1, 2_100);
        vm.prank(keeper);
        vm.expectRevert(Rounds.InsufficientFee.selector);
        rounds.settle{value: 0.05 ether}(id);
    }

    /// Fenwick picks must match a naive linear scan, with random stakes and exits.
    function testFuzz_treeMatchesNaive(uint256 seed) public {
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 1e6);
        uint256 n = 1 + seed % 13;
        address[] memory us = new address[](n);
        for (uint256 i; i < n; i++) {
            us[i] = address(uint160(0x1000 + i));
            uint256 s = 1 + uint256(keccak256(abi.encode(seed, i))) % 1_000e6;
            _fund(us[i], s);
            _enter(us[i], id, s);
        }
        if (n > 2) {
            vm.prank(us[seed % n]);
            rounds.exitRound(id);
        }
        bytes32 rnd = keccak256(abi.encode(seed, "r"));
        entropy.fire(_resolve(id, 2_100), rnd);

        // naive replay of the same 3 picks
        uint256[] memory st = new uint256[](n);
        uint256 remaining;
        for (uint256 i; i < n; i++) {
            (, st[i],,,) = rounds.entries(id, us[i]);
            remaining += st[i];
        }
        Rounds.Round memory r = rounds.getRound(id);
        for (uint256 k; k < 3 && remaining > 0; k++) {
            uint256 t = uint256(keccak256(abi.encode(rnd, k))) % remaining;
            uint256 i;
            while (t >= st[i]) t -= st[i++];
            assertEq(r.winners[k], us[i]);
            remaining -= st[i];
            st[i] = 0;
        }
    }

    function test_withdrawTreasury_onlyFreeTreasury() public {
        _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        uint256 t = rounds.treasury();
        vm.expectRevert(Rounds.BadAmount.selector);
        rounds.withdrawTreasury(address(this), t + 1);
        rounds.withdrawTreasury(address(this), t);
        assertEq(usd.balanceOf(address(this)), t);
        vm.prank(alice);
        vm.expectRevert(Rounds.NotOwner.selector);
        rounds.withdrawTreasury(alice, 0);
    }

    // ---------------------------------------------------------------- engine, fee, yield

    function _liabilities() internal view returns (uint256) {
        return rounds.totalBalances() + rounds.treasury() + rounds.reserved() + rounds.fees();
    }

    function _assertSolvent() internal view {
        assertGe(vault.convertToAssets(vault.balanceOf(address(rounds))), _liabilities());
    }

    function test_engineOpensOnThesis_profitDrawn_fee3pct() public {
        rounds.setEngine(IEngine(address(eng)));
        uint256 id = _create("BTC", 16, Rounds.Thesis.Bearish, 100e6);
        _enter(alice, id, 300e6);
        px.set(1, 0);
        px.set(16, 80_000);
        vm.roll(rounds.getRound(id).entryEnd + 1);
        rounds.setStrike(id);
        assertEq(eng.marginOf(id), 100e6);
        assertFalse(eng.longOf(id)); // Bearish -> short
        assertEq(rounds.getRound(id).borrowed, 100e6);
        assertEq(rounds.getRound(id).budget, 0);

        eng.setResult(25_000); // position x2.5
        px.set(16, 79_000);
        vm.roll(rounds.getRound(id).end + 1);
        vm.prank(keeper);
        rounds.settle{value: 0.1 ether}(id);
        // profit 150, fee 3% = 4.5
        assertEq(rounds.fees(), 4_500_000);
        assertEq(rounds.getRound(id).budget, 245_500_000);
        entropy.fire(rounds.getRound(id).sequence, keccak256("f"));
        assertEq(rounds.prizeOf(id, alice), 245_500_000);
        assertEq(_claim(alice, id), 545_500_000); // 300 deposit + prize
        _assertSolvent();

        rounds.withdrawFees(address(0xFEE));
        assertEq(usd.balanceOf(address(0xFEE)), 4_500_000);
    }

    function test_engineLoss_noFee_depositsIntact() public {
        rounds.setEngine(IEngine(address(eng)));
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 300e6);
        eng.setResult(0); // liquidated
        uint256 t0 = rounds.treasury();
        assertEq(_resolve(id, 1_900), 0);
        assertEq(rounds.fees(), 0);
        assertEq(rounds.treasury(), t0); // nothing came back
        assertEq(_claim(alice, id), 300e6);
        assertEq(usd.balanceOf(alice), 300e6);
        _assertSolvent();
    }

    function test_thesisWonButPositionLost_potIsDrawnNoFee() public {
        rounds.setEngine(IEngine(address(eng)));
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 300e6);
        eng.setResult(6_000); // fees/slippage ate 40%
        entropy.fire(_resolve(id, 2_100), keccak256("g"));
        assertEq(rounds.fees(), 0);
        assertEq(rounds.prizeOf(id, alice), 60e6);
        assertEq(_claim(alice, id), 360e6);
        _assertSolvent();
    }

    function test_engineFailsToOpen_roundGoesOnWithBudget() public {
        rounds.setEngine(IEngine(address(eng)));
        eng.setFailOpen(true);
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 100e6);
        _enter(alice, id, 300e6);
        entropy.fire(_resolve(id, 2_100), keccak256("h"));
        assertEq(rounds.getRound(id).borrowed, 0);
        assertEq(rounds.prizeOf(id, alice), 100e6);
        assertEq(_claim(alice, id), 400e6);
        _assertSolvent();
    }

    function test_budgetIsAdvancedFromTreasuryAtWindowClose() public {
        // 10% APR on stakes, 1000 blocks per year for easy numbers, round of 20 blocks
        rounds.setEconomics(300, 1_000, 4_650, 1_000);
        uint256 id = _create(MON, 1, Rounds.Thesis.Bullish, 0);
        _enter(alice, id, 300e6);
        _enter(carol, id, 500e6);
        uint256 t0 = rounds.treasury();
        vm.roll(rounds.getRound(id).entryEnd + 1);
        px.set(1, 2_000);
        rounds.setStrike(id);
        // 800 * 10% * 20 / 1000 = 1.6
        assertEq(rounds.getRound(id).budget, 1_600_000);
        assertEq(rounds.getRound(id).funded, 1_600_000);
        assertEq(rounds.treasury(), t0 - 1_600_000);
        _assertSolvent();
    }

    function test_vaultYield_basePart_toUsers_restToTreasury() public {
        MockYieldVault v = new MockYieldVault(IERC20Like(address(usd)), 1_000); // 10% APR
        Rounds r2 = new Rounds(
            IERC20(address(usd)), IERC4626(address(v)), IEntropyV2(address(entropy)), IPriceSource(address(px)), 10, 20
        );
        usd.mint(address(v), 1_000e6); // yield reserve
        usd.mint(alice, 1_000e6);
        usd.mint(bob, 3_000e6);
        vm.prank(alice);
        usd.approve(address(r2), type(uint256).max);
        vm.prank(bob);
        usd.approve(address(r2), type(uint256).max);
        vm.prank(alice);
        r2.deposit(1_000e6);
        vm.prank(bob);
        r2.deposit(3_000e6);

        vm.warp(block.timestamp + 365 days); // vault: 4000 -> 4400
        r2.harvest();
        // users get 46.5% of 400 = 186, pro rata 1:3; treasury 214
        assertApproxEqAbs(r2.balanceWithYield(alice), 1_000e6 + 46_500_000, 2);
        assertApproxEqAbs(r2.balanceWithYield(bob), 3_000e6 + 139_500_000, 2);
        assertApproxEqAbs(r2.treasury(), 214e6, 2);

        uint256 a = r2.balanceWithYield(alice);
        vm.prank(alice);
        r2.withdraw(a);
        assertApproxEqAbs(usd.balanceOf(alice), 1_046_500_000, 2);
        // liabilities can be a few wei above assets: per-user yield is rounded down, totalBalances is not
        assertApproxEqAbs(
            v.convertToAssets(v.balanceOf(address(r2))), r2.totalBalances() + r2.treasury() + r2.reserved() + r2.fees(), 3
        );
        uint256 b = r2.balanceWithYield(bob);
        vm.prank(bob);
        r2.withdraw(b); // last user can take everything they see
    }

    function test_feeIsEditable_capped() public {
        rounds.setEconomics(500, 230, 4_650, 78_840_000);
        assertEq(rounds.feeBps(), 500);
        vm.expectRevert(Rounds.BadAmount.selector);
        rounds.setEconomics(2_001, 230, 4_650, 78_840_000);
        vm.prank(alice);
        vm.expectRevert(Rounds.NotOwner.selector);
        rounds.setEconomics(0, 0, 0, 1);
    }

    function test_prizeEarnsYieldUntilClaim_andEarnedShown() public {
        MockYieldVault v = new MockYieldVault(IERC20Like(address(usd)), 1_000); // 10% APR
        Rounds r2 = new Rounds(
            IERC20(address(usd)), IERC4626(address(v)), IEntropyV2(address(entropy)), IPriceSource(address(px)), 10, 20
        );
        r2.setEconomics(300, 0, 5_000, 78_840_000); // users get half of the vault yield
        usd.mint(address(v), 10_000e6); // yield reserve
        usd.mint(address(this), 1_000e6);
        usd.approve(address(r2), type(uint256).max);
        r2.fundTreasury(1_000e6);
        address eve = makeAddr("eve");
        usd.mint(eve, 1_000e6);
        vm.prank(eve);
        usd.approve(address(r2), type(uint256).max);

        uint256 id = r2.createRound(Rounds.RoundParams("BTC", 1, Rounds.Thesis.Bullish, 1_000e6, 0, 0, "", "", 0));
        vm.prank(eve);
        r2.depositAndEnter(id, 1_000e6);
        px.set(1, 100);
        vm.roll(r2.getRound(id).entryEnd + 1);
        r2.setStrike(id);
        px.set(1, 101);
        vm.roll(r2.getRound(id).end + 1);
        vm.deal(address(this), 1 ether);
        r2.settle{value: 0.1 ether}(id);
        entropy.fire(r2.getRound(id).sequence, keccak256("y"));
        assertEq(r2.prizeOf(id, eve), 1_000e6);
        assertEq(r2.balanceWithYield(eve), 2_000e6); // prize is on the balance right after the draw

        vm.warp(block.timestamp + 365 days);
        r2.harvest();
        uint256 earned = r2.earnedOf(id, eve);
        assertGt(earned, 0); // stake and prize both earn while unclaimed
        assertApproxEqAbs(r2.balanceWithYield(eve), 2_000e6 + earned, 2);

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        vm.prank(eve);
        uint256 paid = r2.claim(ids);
        assertEq(usd.balanceOf(eve), paid);
        assertApproxEqAbs(paid, 2_000e6 + earned, 2);
        (,,,, uint256 earnedFinal) = r2.entries(id, eve);
        assertEq(earnedFinal, earned);
    }

    function test_claimMany_oneTx_andLeveragePassedToEngine() public {
        rounds.setEngine(IEngine(address(eng)));
        uint256 a = rounds.createRound(Rounds.RoundParams(MON, 1, Rounds.Thesis.Bullish, 10e6, 0, 0, "", "", 12));
        uint256 b = _create(MON, 1, Rounds.Thesis.Bearish, 10e6);
        _enter(alice, a, 100e6);
        _enter(alice, b, 100e6);
        vm.roll(rounds.getRound(a).entryEnd + 1);
        px.set(1, 2_000);
        rounds.setStrike(a);
        assertEq(eng.lastLeverage(), 12);
        rounds.setStrike(b);
        assertEq(eng.lastLeverage(), 0); // 0 = engine uses the market cap
        vm.roll(rounds.getRound(a).end + 1);
        px.set(1, 1_900);
        vm.deal(address(this), 1 ether);
        rounds.settle(a); // bull thesis lost
        rounds.settle{value: 0.1 ether}(b); // bear thesis won
        entropy.fire(rounds.getRound(b).sequence, keccak256("m"));

        uint256[] memory ids = new uint256[](2);
        ids[0] = a;
        ids[1] = b;
        vm.prank(alice);
        uint256 paid = rounds.claim(ids);
        assertEq(paid, 300e6 + 10e6); // whole deposit + prize of b, in one transaction
        assertEq(usd.balanceOf(alice), paid);
        _assertSolvent();
    }

    function test_mirrorPair_sameStrikeAndFinal_oneTx() public {
        uint256 bull = _create("BTC", 16, Rounds.Thesis.Bullish, 10e6);
        uint256 bear = _create("BTC", 16, Rounds.Thesis.Bearish, 10e6);
        _enter(alice, bull, 100e6);
        _enter(bob, bear, 100e6);
        uint256[] memory ids = new uint256[](2);
        ids[0] = bull;
        ids[1] = bear;

        px.set(16, 80_000);
        vm.roll(rounds.getRound(bull).entryEnd + 1);
        vm.prank(keeper);
        rounds.setStrikeMany(ids);
        assertEq(rounds.getRound(bull).strike, rounds.getRound(bear).strike);

        px.set(16, 80_500);
        vm.roll(rounds.getRound(bull).end + 1);
        uint256 k0 = keeper.balance;
        vm.prank(keeper);
        rounds.settleMany{value: 0.2 ether}(ids); // fee for both, one is refunded
        assertEq(keeper.balance, k0 - 0.1 ether); // only the winning side drew
        Rounds.Round memory a = rounds.getRound(bull);
        Rounds.Round memory b = rounds.getRound(bear);
        assertEq(a.finalPrice, b.finalPrice);
        assertTrue(a.thesisWon != b.thesisWon); // exactly one side wins
    }

    function test_createRounds_pairHasSameBlocks() public {
        Rounds.RoundParams[] memory ps = new Rounds.RoundParams[](2);
        ps[0] = Rounds.RoundParams("BTC", 16, Rounds.Thesis.Bullish, 5e6, 30, 40, "up", "r", 15);
        ps[1] = Rounds.RoundParams("BTC", 16, Rounds.Thesis.Bearish, 5e6, 30, 40, "down", "r", 15);
        uint256 first = rounds.createRounds(ps);
        Rounds.Round memory a = rounds.getRound(first);
        Rounds.Round memory b = rounds.getRound(first + 1);
        assertEq(a.entryEnd, b.entryEnd);
        assertEq(a.end, b.end);
        assertEq(uint8(b.thesis), uint8(Rounds.Thesis.Bearish));
        assertEq(b.leverage, 15);
    }
}
