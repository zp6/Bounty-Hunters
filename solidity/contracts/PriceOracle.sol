// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface AggregatorV3Interface {
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract PriceOracle {
    AggregatorV3Interface public feed;
    AggregatorV3Interface public fallbackOracle;
    address public owner;
    uint256 public maxStaleness = 1 hours;

    event FallbackUsed(address indexed oracle);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _feed) {
        feed = AggregatorV3Interface(_feed);
        owner = msg.sender;
    }

    function getPrice() external view returns (uint256) {
        (uint256 price, bool valid) = _getValidPrice(feed);
        if (valid) return price;
        if (address(fallbackOracle) != address(0)) {
            (uint256 fbPrice, bool fbValid) = _getValidPrice(fallbackOracle);
            if (fbValid) return fbPrice;
        }
        revert("No valid price");
    }

    function _getValidPrice(AggregatorV3Interface oracleFeed) internal view returns (uint256, bool) {
        try oracleFeed.latestRoundData() returns (uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound) {
            if (answeredInRound < roundId) return (0, false);
            if (answer <= 0) return (0, false);
            if (block.timestamp - updatedAt > maxStaleness) return (0, false);
            return (uint256(answer), true);
        } catch { return (0, false); }
    }

    function setFallbackOracle(address _fb) external onlyOwner {
        fallbackOracle = AggregatorV3Interface(_fb);
    }

    function setMaxStaleness(uint256 _ms) external onlyOwner {
        require(_ms > 0, "Invalid");
        maxStaleness = _ms;
    }
}
