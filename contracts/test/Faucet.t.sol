// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Faucet, IERC20Drip} from "../src/Faucet.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract FaucetTest is Test {
    MockUSD usd;
    Faucet faucet;
    address operator = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usd = new MockUSD();
        faucet = new Faucet(IERC20Drip(address(usd)), operator);
        usd.mint(address(faucet), 1_000e6);
        vm.deal(address(faucet), 1 ether);
    }

    function test_dripSendsUsdAndMon() public {
        vm.prank(operator);
        faucet.drip(alice);
        assertEq(usd.balanceOf(alice), 100e6);
        assertEq(alice.balance, 0.05 ether);
    }

    function test_oncePerCooldown() public {
        vm.startPrank(operator);
        faucet.drip(alice);
        vm.expectRevert(Faucet.TooSoon.selector);
        faucet.drip(alice);
        vm.warp(block.timestamp + 1 days);
        faucet.drip(alice);
        vm.stopPrank();
        assertEq(usd.balanceOf(alice), 200e6);
    }

    function test_onlyOperatorOrOwner() public {
        vm.prank(alice);
        vm.expectRevert(Faucet.NotOperator.selector);
        faucet.drip(alice);
        faucet.drip(bob); // owner
        assertEq(usd.balanceOf(bob), 100e6);
    }

    function test_dailyCapLimitsALeakedKey() public {
        faucet.set(1e6, 0, 1 days, 3);
        vm.startPrank(operator);
        for (uint160 i = 1; i <= 3; i++) faucet.drip(address(i));
        vm.expectRevert(Faucet.DailyCap.selector);
        faucet.drip(address(4));
        vm.warp(block.timestamp + 1 days);
        faucet.drip(address(4)); // a new day
        vm.stopPrank();
    }

    function test_emptyReverts_lowMonSendsWhatIsLeft() public {
        faucet.withdraw(address(this));
        vm.prank(operator);
        vm.expectRevert(Faucet.Empty.selector);
        faucet.drip(alice);
        usd.mint(address(faucet), 100e6);
        vm.deal(address(faucet), 0.01 ether);
        vm.prank(operator);
        faucet.drip(alice);
        assertEq(alice.balance, 0.01 ether);
    }

    receive() external payable {}
}
