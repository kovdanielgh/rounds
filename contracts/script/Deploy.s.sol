// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Rounds, IERC20, IERC4626, IEntropyV2, IPriceSource} from "../src/Rounds.sol";
import {IEngine} from "../src/IEngine.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {MockYieldVault, IERC20Like} from "../src/MockYieldVault.sol";
import {PerplPriceSource, IPerplExchange} from "../src/PerplPriceSource.sol";
import {PerplEngine, IPerplDex, IERC20Min} from "../src/PerplEngine.sol";

/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// Env: PRIVATE_KEY, optional TOKEN, VAULT, VAULT_APR_BPS, ENTROPY, PERPL_EXCHANGE, ENGINE,
/// ENTRY_BLOCKS, DURATION_BLOCKS, PERPL_ENGINE (true: deploy PerplEngine, token must be AUSD),
/// ENGINE_BUFFER (AUSD for the Perpl account, default 100e6).
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address token = vm.envOr("TOKEN", address(0));
        address vault = vm.envOr("VAULT", address(0));
        // Pyth Entropy v2 on Monad testnet (from Fortuna configs; the address in Monad docs is wrong).
        address entropy = vm.envOr("ENTROPY", address(0x825c0390f379C631f3Cf11A82a37D20BddF93c07));
        address perpl = vm.envOr("PERPL_EXCHANGE", address(0x1964C32f0bE608E7D29302AFF5E61268E72080cc));
        address engine = vm.envOr("ENGINE", address(0));
        // Monad testnet ~0.3 s/block: 1000 blocks ~ 5 min entry, 2000 ~ 10 min round.
        uint64 entryBlocks = uint64(vm.envOr("ENTRY_BLOCKS", uint256(1000)));
        uint64 durationBlocks = uint64(vm.envOr("DURATION_BLOCKS", uint256(2000)));

        vm.startBroadcast(pk);
        if (token == address(0)) token = address(new MockUSD());
        if (vault == address(0)) {
            vault = address(new MockYieldVault(IERC20Like(token), vm.envOr("VAULT_APR_BPS", uint256(430))));
        }
        PerplPriceSource prices = new PerplPriceSource(IPerplExchange(perpl));
        Rounds rounds = new Rounds(
            IERC20(token), IERC4626(vault), IEntropyV2(entropy), IPriceSource(address(prices)), entryBlocks, durationBlocks
        );
        if (engine == address(0) && vm.envOr("PERPL_ENGINE", false)) {
            PerplEngine pe = new PerplEngine(IPerplDex(perpl), IERC20Min(token), address(rounds));
            uint256 buffer = vm.envOr("ENGINE_BUFFER", uint256(100e6));
            IERC20(token).approve(address(pe), buffer);
            pe.init(buffer);
            // Caps = Perpl max per market; a round picks its own leverage up to the cap (0 = cap).
            pe.setLeverage(16, 15);
            pe.setLeverage(32, 12);
            pe.setLeverage(48, 10);
            pe.setLeverage(64, 3);
            engine = address(pe);
        }
        if (engine != address(0)) rounds.setEngine(IEngine(engine));
        vm.stopBroadcast();

        console.log("token ", token);
        console.log("vault ", vault);
        console.log("prices", address(prices));
        console.log("rounds", address(rounds));
        console.log("engine", engine);
    }
}
