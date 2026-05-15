// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract YieldVault {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public stakedBalance;
    uint256 public totalSupply;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function _cappedTimestamp() internal view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + ((_cappedTimestamp() - lastUpdateTime) * rewardRate * 1e18 / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return (stakedBalance[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) + rewards[account];
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake 0");
        updateReward(msg.sender);
        stakedBalance[msg.sender] += amount;
        totalSupply += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient");
        updateReward(msg.sender);
        stakedBalance[msg.sender] -= amount;
        totalSupply -= amount;
        stakingToken.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claimReward() external {
        updateReward(msg.sender);
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No reward");
        rewards[msg.sender] = 0;
        rewardToken.transfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = _cappedTimestamp();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }

    function setRewardParams(uint256 _rate, uint256 _duration) external {
        rewardRate = _rate;
        rewardsDuration = _duration;
        periodFinish = block.timestamp + _duration;
        lastUpdateTime = block.timestamp;
    }
}
