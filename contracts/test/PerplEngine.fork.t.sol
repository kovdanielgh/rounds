// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PerplEngine, IPerplDex, IERC20Min} from "../src/PerplEngine.sol";

interface IERC20View is IERC20Min {
    function balanceOf(address) external view returns (uint256);
}

/// @notice Fork tests against the real Perpl Exchange on Monad testnet.
/// Run from contracts/: set -a; . ../.env; set +a; forge test --match-path test/PerplEngine.fork.t.sol -vv
/// Skipped when MONAD_TESTNET_RPC is not set.
contract PerplEngineForkTest is Test {
    IPerplDex constant EXCHANGE = IPerplDex(0x1964C32f0bE608E7D29302AFF5E61268E72080cc);
    IERC20View constant AUSD = IERC20View(0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC);
    address constant HOLDER = 0xB9eB69F8A03358f145f3813e2d706Ff89D821508;
    uint256 constant BTC = 16;
    uint256 constant ETH = 32;
    uint256 constant MARGIN = 20e6; // 20 AUSD round budget
    uint256 constant BUFFER = 100e6;

    PerplEngine engine;
    address rounds = makeAddr("rounds");
    bool noFork;

    function setUp() public {
        string memory rpc = vm.envOr("MONAD_TESTNET_RPC", string(""));
        if (bytes(rpc).length == 0) {
            noFork = true;
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        engine = new PerplEngine(EXCHANGE, AUSD, rounds);
        engine.setLeverage(BTC, 5);
        engine.setLeverage(ETH, 5);

        _fund(address(this), BUFFER);
        AUSD.approve(address(engine), BUFFER);
        engine.init(BUFFER);

        _fund(rounds, 10 * MARGIN);
        vm.prank(rounds);
        AUSD.approve(address(engine), type(uint256).max);
    }

    /// @dev `deal` cannot find the AUSD balance slot (proxy token with custom storage), so take
    /// the AUSD from a testnet holder that drips it.
    function _fund(address to, uint256 amount) internal {
        vm.prank(HOLDER);
        assertTrue(AUSD.transfer(to, amount), "fund");
    }

    function _roll(uint256 blocks) internal {
        vm.roll(block.number + blocks);
        vm.warp(block.timestamp + blocks / 2); // ~0.4-0.5 s blocks; keep mark price age valid
    }

    function _roundTrip(uint256 roundId, uint256 perpId, bool isLong) internal returns (uint256 back) {
        uint256 r0 = AUSD.balanceOf(rounds);
        vm.prank(rounds);
        engine.open(roundId, perpId, isLong, MARGIN);
        assertEq(AUSD.balanceOf(rounds), r0 - MARGIN, "margin pulled");
        IPerplDex.PositionInfo memory pos = engine.positionOf(perpId);
        assertGt(pos.lotLNS, 0, "filled");
        assertEq(pos.positionType, isLong ? 0 : 1, "side");
        (,, int256 credit,,,,) = engine.positions(roundId);
        console.log("lotLNS", pos.lotLNS);
        console.log("entry pricePNS", pos.pricePNS);
        console.log("position depositCNS", pos.depositCNS);
        console.log("credit after open (CNS)");
        console.logInt(credit);

        _roll(20);
        vm.prank(rounds);
        back = engine.close(roundId);
        assertEq(AUSD.balanceOf(rounds), r0 - MARGIN + back, "returned sent");
        assertEq(engine.positionOf(perpId).lotLNS, 0, "flat");
        assertEq(engine.busyRound(perpId), 0, "market free");
        console.log("margin in ", MARGIN);
        console.log("amount back", back);
        console.log("cost (fees + spread + pnl)", MARGIN > back ? MARGIN - back : 0);
        console.log("account balance", engine.accountBalance());
    }

    function test_openLongBtc_close() public {
        if (noFork) return;
        uint256 back = _roundTrip(1, BTC, true);
        // no price move between blocks on a fork: loss is fees + spread only
        assertApproxEqRel(back, MARGIN, 0.05e18, "back ~ margin");
        assertGe(engine.accountBalance(), BUFFER * 99 / 100, "buffer kept");
    }

    function test_openShortBtc_close() public {
        if (noFork) return;
        uint256 back = _roundTrip(2, BTC, false);
        assertApproxEqRel(back, MARGIN, 0.05e18, "back ~ margin");
    }

    function test_twoMarkets_independent() public {
        if (noFork) return;
        vm.startPrank(rounds);
        engine.open(1, BTC, true, MARGIN);
        engine.open(2, ETH, false, MARGIN);
        _roll(10);
        uint256 a = engine.close(2);
        uint256 b = engine.close(1);
        vm.stopPrank();
        console.log("ETH short back", a);
        console.log("BTC long back", b);
        assertApproxEqRel(a, MARGIN, 0.05e18);
        assertApproxEqRel(b, MARGIN, 0.05e18);
    }

    function test_busyMarket_reverts() public {
        if (noFork) return;
        vm.startPrank(rounds);
        engine.open(1, BTC, true, MARGIN);
        vm.expectRevert(PerplEngine.MarketBusy.selector);
        engine.open(2, BTC, false, MARGIN);
        vm.expectRevert(PerplEngine.RoundUsed.selector);
        engine.open(1, ETH, false, MARGIN);
        engine.close(1);
        engine.open(3, BTC, false, MARGIN); // free again after close
        vm.stopPrank();
    }

    function test_onlyRounds() public {
        if (noFork) return;
        address eve = makeAddr("eve");
        vm.startPrank(eve);
        vm.expectRevert(PerplEngine.NotRounds.selector);
        engine.open(1, BTC, true, MARGIN);
        vm.expectRevert(PerplEngine.NotRounds.selector);
        engine.close(1);
        vm.expectRevert(PerplEngine.NotOwner.selector);
        engine.setRounds(eve);
        vm.expectRevert(PerplEngine.NotOwner.selector);
        engine.rescueExchange(1, eve);
        vm.stopPrank();
    }

    function test_noLiquidity_revertsAndKeepsFunds() public {
        if (noFork) return;
        // worst price 0.01% from mark: an IOC that cannot fill must revert, Rounds keeps the margin
        engine.setSlippage(1, 1_000);
        uint256 r0 = AUSD.balanceOf(rounds);
        vm.prank(rounds);
        (bool ok, bytes memory err) = address(engine).call(abi.encodeCall(PerplEngine.open, (1, BTC, true, MARGIN)));
        if (!ok) {
            console.log("no-fill revert selector");
            console.logBytes4(bytes4(err));
            assertEq(AUSD.balanceOf(rounds), r0, "funds kept");
            assertEq(engine.busyRound(BTC), 0);
        } else {
            console.log("filled within 1 bp of mark; no-fill path not exercised");
        }
    }

    function test_unknownMarket_reverts() public {
        if (noFork) return;
        vm.prank(rounds);
        vm.expectRevert(PerplEngine.BadMarket.selector);
        engine.open(1, 64, true, MARGIN); // MON: leverage not set
    }

    function test_ownerClosePosition_thenClose() public {
        if (noFork) return;
        vm.prank(rounds);
        engine.open(1, BTC, true, MARGIN);
        engine.closePosition(1); // owner de-risks early, proceeds stay in Perpl
        assertEq(engine.positionOf(BTC).lotLNS, 0);
        vm.prank(rounds);
        uint256 back = engine.close(1);
        assertApproxEqRel(back, MARGIN, 0.05e18);
    }

    function test_rescue() public {
        if (noFork) return;
        address to = makeAddr("to");
        engine.rescueExchange(10e6, to);
        assertEq(AUSD.balanceOf(to), 10e6);
        assertEq(engine.buffer(), BUFFER - 10e6);
    }
}
