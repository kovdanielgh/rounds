// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEntropyConsumerCallback {
    function _entropyCallback(uint64 sequence, address provider, bytes32 randomNumber) external;
}

contract MockEntropy {
    uint128 public fee = 0.1 ether;
    uint64 public lastSequence;
    mapping(uint64 => address) public requester;

    function getFeeV2() external view returns (uint128) {
        return fee;
    }

    function requestV2() external payable returns (uint64) {
        require(msg.value >= fee, "fee");
        requester[++lastSequence] = msg.sender;
        return lastSequence;
    }

    function fire(uint64 sequence, bytes32 randomNumber) external {
        IEntropyConsumerCallback(requester[sequence])._entropyCallback(sequence, address(this), randomNumber);
    }
}
