// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceSource} from "./Rounds.sol";

/// @notice Perpl Exchange, the subset we read. Field order matches PerpetualInfo in the Perpl ABI.
interface IPerplExchange {
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

    function getPerpetualInfo(uint256 perpId) external view returns (PerpetualInfo memory);
}

/// @notice Mark price of a Perpl market, in Perpl price units (price * 10^priceDecimals).
contract PerplPriceSource is IPriceSource {
    IPerplExchange public immutable exchange;

    constructor(IPerplExchange exchange_) {
        exchange = exchange_;
    }

    function price(uint256 perpId) external view returns (uint256) {
        IPerplExchange.PerpetualInfo memory info = exchange.getPerpetualInfo(perpId);
        require(info.status != 0, "market paused");
        return info.markPNS;
    }
}
