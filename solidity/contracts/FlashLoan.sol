// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IFlashLoanReceiver { function executeOperation(uint256 amount, uint256 fee) external; }

contract FlashLoan is Ownable {
    uint256 public feeBPS = 30;
    uint256 public maxLoanBPS = 5000;
    uint256 public poolBalance;
    bool public paused;

    event FlashLoanExecuted(address borrower, uint256 amount, uint256 fee);
    event EmergencyPaused(bool paused);

    modifier whenNotPaused() { require(!paused, "Paused"); _; }

    function deposit() external payable { poolBalance += msg.value; }

    function flashLoan(uint256 amount) external whenNotPaused {
        uint256 maxLoan = (poolBalance * maxLoanBPS) / 10000;
        require(amount <= maxLoan, "Exceeds max");
        require(amount > 0, "Zero");
        uint256 fee = (amount * feeBPS) / 10000;
        if (fee == 0) fee = 1;
        uint256 balBefore = address(this).balance;
        require(balBefore >= amount, "Low pool");
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Send failed");
        IFlashLoanReceiver(msg.sender).executeOperation(amount, fee);
        require(address(this).balance >= balBefore + fee, "Not repaid");
        poolBalance = address(this).balance;
        emit FlashLoanExecuted(msg.sender, amount, fee);
    }

    function emergencyPause() external onlyOwner { paused = !paused; emit EmergencyPaused(paused); }
    receive() external payable {}
}