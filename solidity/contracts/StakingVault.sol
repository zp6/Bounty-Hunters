// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract StakingVault is ReentrancyGuard {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public rewardDebt;
    uint256 public totalStaked;
    uint256 public rewardRate;
    uint256 public lastRewardTime;
    uint256 public accRewardPerShare;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor() {
        rewardRate = 100;
        lastRewardTime = block.timestamp;
    }

    function stake() external payable {
        require(msg.value > 0, "Cannot stake 0");
        updateRewardPool();
        if (balances[msg.sender] > 0) {
            uint256 pending = (balances[msg.sender] * accRewardPerShare / 1e18) - rewardDebt[msg.sender];
            if (pending > 0) {
                (bool success, ) = payable(msg.sender).call{value: pending}("");
                require(success, "Transfer failed");
                emit RewardPaid(msg.sender, pending);
            }
        }
        balances[msg.sender] += msg.value;
        totalStaked += msg.value;
        rewardDebt[msg.sender] = balances[msg.sender] * accRewardPerShare / 1e18;
        emit Staked(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot withdraw 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        updateRewardPool();
        uint256 pending = (balances[msg.sender] * accRewardPerShare / 1e18) - rewardDebt[msg.sender];
        balances[msg.sender] -= amount;
        totalStaked -= amount;
        rewardDebt[msg.sender] = balances[msg.sender] * accRewardPerShare / 1e18;
        if (pending > 0) {
            (bool rs, ) = payable(msg.sender).call{value: pending}("");
            require(rs, "Reward transfer failed");
            emit RewardPaid(msg.sender, pending);
        }
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        updateRewardPool();
        uint256 pending = (balances[msg.sender] * accRewardPerShare / 1e18) - rewardDebt[msg.sender];
        require(pending > 0, "No rewards to claim");
        rewardDebt[msg.sender] = balances[msg.sender] * accRewardPerShare / 1e18;
        (bool success, ) = payable(msg.sender).call{value: pending}("");
        require(success, "Transfer failed");
        emit RewardPaid(msg.sender, pending);
    }

    function updateRewardPool() internal {
        if (totalStaked == 0) { lastRewardTime = block.timestamp; return; }
        uint256 timeElapsed = block.timestamp - lastRewardTime;
        accRewardPerShare += (timeElapsed * rewardRate * 1e18) / totalStaked;
        lastRewardTime = block.timestamp;
    }
}
