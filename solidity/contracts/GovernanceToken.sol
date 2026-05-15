// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GovernanceToken is Ownable {
    string public name = "GovernanceToken";
    string public symbol = "GOV";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => address) public delegates;
    mapping(address => uint256) public numCheckpoints;
    mapping(address => mapping(uint256 => Checkpoint)) public checkpoints;

    struct Checkpoint { uint32 fromBlock; uint224 votes; }

    event DelegateChanged(address indexed delegator, address indexed from, address indexed to);
    event Snapshot(uint256 id);

    function delegateVote(address delegate) external {
        require(msg.sender != address(0), "Invalid sender");
        require(delegate != address(0), "Invalid delegate");
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = delegate;
        _moveDelegates(msg.sender, oldDelegate, delegate);
        emit DelegateChanged(msg.sender, oldDelegate, delegate);
    }

    function revokeDelegate() external {
        require(msg.sender != address(0), "Invalid sender");
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = address(0);
        _moveDelegates(msg.sender, oldDelegate, address(0));
        emit DelegateChanged(msg.sender, oldDelegate, address(0));
    }

    function snapshot() external onlyOwner {
        emit Snapshot(block.number);
    }

    function getVotingPower(address account) external view returns (uint256) {
        uint256 n = numCheckpoints[account];
        return n == 0 ? 0 : checkpoints[account][n - 1].votes;
    }

    function _moveDelegates(address delegator, address from, address to) internal {
        if (from != address(0)) {
            uint256 n = numCheckpoints[from];
            uint256 old = n > 0 ? checkpoints[from][n-1].votes : 0;
            _writeCheckpoint(from, old > balanceOf[delegator] ? old - balanceOf[delegator] : 0);
        }
        if (to != address(0)) {
            uint256 n = numCheckpoints[to];
            uint256 old = n > 0 ? checkpoints[to][n-1].votes : 0;
            _writeCheckpoint(to, old + balanceOf[delegator]);
        }
    }

    function _writeCheckpoint(address account, uint256 newVotes) internal {
        uint256 n = numCheckpoints[account];
        if (n > 0 && checkpoints[account][n-1].fromBlock == block.number) {
            checkpoints[account][n-1].votes = uint224(newVotes);
        } else {
            checkpoints[account][n] = Checkpoint(uint32(block.number), uint224(newVotes));
            numCheckpoints[account] = n + 1;
        }
    }
}