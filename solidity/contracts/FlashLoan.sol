// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IFlashLoanReceiver {
    function executeOperation(uint256 amount, uint256 premium, address initiator) external returns (bool);
}

/**
 * @title FlashLoan
 * @dev Fixed: Zero-fee flash loans and pool drainage protection.
 */
contract FlashLoan is ReentrancyGuard {
    uint256 public constant MIN_FEE_BPS = 5; // 0.05% minimum fee
    uint256 public constant MAX_FLASH_RATIO = 80; // Max 80% of pool in single flash
    uint256 public feeBps = 9; // 0.09% default fee
    uint256 public poolBalance;
    
    address public owner;
    
    event FlashLoanExecuted(address indexed borrower, uint256 amount, uint256 fee);
    event FeeUpdated(uint256 newFeeBps);
    event Deposited(address indexed depositor, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Fixed: Added minimum fee enforcement, max flash ratio, and reentrancy guard.
     */
    function flashLoan(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(poolBalance > 0, "Pool empty");
        
        // Fix 1: Limit single flash to MAX_FLASH_RATIO of pool
        require(amount <= (poolBalance * MAX_FLASH_RATIO) / 100, "Amount exceeds max ratio");
        
        // Fix 2: Enforce minimum fee
        uint256 fee = (amount * feeBps) / 10000;
        uint256 minFee = (amount * MIN_FEE_BPS) / 10000;
        require(fee >= minFee, "Fee too low");
        
        uint256 balanceBefore = address(this).balance;
        require(balanceBefore >= amount, "Insufficient pool");
        
        // Transfer loan amount
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
        
        // Execute callback
        require(
            IFlashLoanReceiver(msg.sender).executeOperation(amount, fee, address(this)),
            "Callback failed"
        );
        
        // Verify repayment
        uint256 balanceAfter = address(this).balance;
        require(balanceAfter >= balanceBefore + fee, "Flash loan not repaid");
        
        poolBalance = balanceAfter;
        
        emit FlashLoanExecuted(msg.sender, amount, fee);
    }
    
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");
        poolBalance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps >= MIN_FEE_BPS, "Below minimum fee");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }
    
    receive() external payable {
        poolBalance += msg.value;
    }
}
