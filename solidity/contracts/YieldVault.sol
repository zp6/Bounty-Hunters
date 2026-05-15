// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract YieldVault is Ownable {
    uint256 public rewardRate;
    uint256 public periodFinish;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public totalSupply;
    uint256 public constant DURATION = 7 days;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardAdded(uint256 reward);

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        uint256 lastTime = block.timestamp < periodFinish ? block.timestamp : periodFinish;
        return rewardPerTokenStored + ((lastTime - lastUpdateTime) * rewardRate * 1e18 / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return (balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function notifyRewardAmount(uint256 reward) external onlyOwner {
        _updateReward(address(0));
        if (block.timestamp >= periodFinish) {
            rewardRate = (reward * 1e18) / DURATION;
        } else {
            uint256 remaining = (periodFinish - block.timestamp) * rewardRate;
            rewardRate = ((reward * 1e18) + remaining) / DURATION;
        }
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;
        emit RewardAdded(reward);
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp < periodFinish ? block.timestamp : periodFinish;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }
}