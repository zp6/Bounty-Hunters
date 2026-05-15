// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    struct VestingSchedule { uint256 totalAllocation; uint256 start; uint256 cliff; uint256 duration; uint256 claimed; }
    mapping(address => VestingSchedule) public schedules;
    IERC20 public token;

    constructor(address _t) { token = IERC20(_t); }

    function createVesting(address b, uint256 total, uint256 start, uint256 cliff, uint256 dur) external onlyOwner {
        require(schedules[b].totalAllocation == 0 && total > 0 && dur > 0 && cliff >= start);
        schedules[b] = VestingSchedule(total, start, cliff, dur, 0);
    }

    function vestedAmount(address b) public view returns (uint256) {
        VestingSchedule memory s = schedules[b];
        if (block.timestamp < s.cliff) return 0;
        if (block.timestamp >= s.start + s.duration) return s.totalAllocation;
        uint256 elapsed = block.timestamp - s.start;
        uint256 vested = (s.totalAllocation / s.duration) * elapsed;
        uint256 remainder = s.totalAllocation % s.duration;
        vested += (remainder * elapsed) / s.duration;
        return vested;
    }

    function claim() external {
        uint256 vested = vestedAmount(msg.sender);
        uint256 claimable = vested - schedules[msg.sender].claimed;
        require(claimable > 0, "Nothing");
        schedules[msg.sender].claimed += claimable;
        require(token.transfer(msg.sender, claimable));
    }

    function revoke(address b) external onlyOwner {
        VestingSchedule storage s = schedules[b];
        require(s.totalAllocation > 0);
        uint256 vested = vestedAmount(b);
        uint256 unvested = s.totalAllocation - vested;
        if (unvested > 0) require(token.transfer(owner(), unvested));
        s.totalAllocation = vested;
        s.duration = block.timestamp > s.start ? block.timestamp - s.start : 0;
    }
}