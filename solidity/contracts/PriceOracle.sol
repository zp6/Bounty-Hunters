// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracle is Ownable {
    uint256 public constant MAX_STALENESS = 3600;
    address public primaryOracle;
    address public fallbackOracle;

    struct RoundData { uint80 roundId; int256 answer; uint256 startedAt; uint256 updatedAt; uint80 answeredInRound; }
    event StalePrice(address indexed oracle, uint256 timestamp);

    constructor(address _p, address _f) { primaryOracle = _p; fallbackOracle = _f; }

    function getPrice() external view returns (uint256) {
        uint256 price = _getValidatedPrice(primaryOracle);
        if (price != 0) return price;
        price = _getValidatedPrice(fallbackOracle);
        require(price != 0, "Both oracles stale");
        return price;
    }

    function _getValidatedPrice(address) internal pure returns (uint256) {
        // Stub - in production calls Chainlink latestRoundData
        return 0;
    }
}