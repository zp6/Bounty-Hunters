// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract GovernanceToken is ERC20 {
    mapping(address => address) public delegates;
    mapping(address => uint256) public votingPower;
    mapping(address => uint256) public snapshotBlock;

    event VoteDelegated(address indexed from, address indexed to);
    event DelegateRevoked(address indexed from, address indexed to);
    event SnapshotCreated(address indexed account, uint256 blockNumber);

    constructor(uint256 initialSupply) ERC20("GovernanceToken", "GOV") {
        _mint(msg.sender, initialSupply);
        votingPower[msg.sender] = initialSupply;
    }

    function delegateVote(address to) external {
        require(msg.sender != address(0), "Invalid sender");
        require(to != address(0), "Cannot delegate to zero address");
        require(to != msg.sender, "Cannot delegate to self");
        address currentDelegate = delegates[msg.sender];
        if (currentDelegate != address(0)) {
            votingPower[currentDelegate] -= balanceOf(msg.sender);
        }
        delegates[msg.sender] = to;
        votingPower[to] += balanceOf(msg.sender);
        emit VoteDelegated(msg.sender, to);
    }

    function revokeDelegate() external {
        require(msg.sender != address(0), "Invalid sender");
        address currentDelegate = delegates[msg.sender];
        require(currentDelegate != address(0), "No delegate set");
        votingPower[currentDelegate] -= balanceOf(msg.sender);
        delegates[msg.sender] = address(0);
        emit DelegateRevoked(msg.sender, currentDelegate);
    }

    function snapshot() external {
        require(msg.sender != address(0), "Invalid sender");
        snapshotBlock[msg.sender] = block.number;
        emit SnapshotCreated(msg.sender, block.number);
    }

    function getVotingPower(address account) external view returns (uint256) {
        return votingPower[account];
    }

    function getDelegate(address account) external view returns (address) {
        return delegates[account];
    }
}
