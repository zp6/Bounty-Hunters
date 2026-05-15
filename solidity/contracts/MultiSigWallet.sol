// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MultiSigWallet {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public requiredConfirmations;
    
    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmationCount;
    }
    
    mapping(uint256 => mapping(address => bool)) public confirmations;
    Transaction[] public transactions;
    
    event TransactionSubmitted(uint256 indexed txId, address indexed submitter);
    event TransactionConfirmed(uint256 indexed txId, address indexed confirmer);
    event TransactionExecuted(uint256 indexed txId);
    
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }
    
    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "Tx does not exist");
        _;
    }
    
    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "Tx already executed");
        _;
    }
    
    modifier notConfirmed(uint256 txId) {
        require(!confirmations[txId][msg.sender], "Tx already confirmed");
        _;
    }
    
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required");
        for (uint i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0), "Invalid owner");
            require(!isOwner[_owners[i]], "Duplicate owner");
            isOwner[_owners[i]] = true;
            owners.push(_owners[i]);
        }
        requiredConfirmations = _required;
    }
    
    function submitTransaction(address destination, uint256 value, bytes calldata data) external onlyOwner returns (uint256) {
        uint256 txId = transactions.length;
        transactions.push(Transaction({
            destination: destination,
            value: value,
            data: data,
            executed: false,
            confirmationCount: 0
        }));
        emit TransactionSubmitted(txId, msg.sender);
        return txId;
    }
    
    /**
     * @dev Fixed: Atomic confirm + execute prevents race condition.
     *      Confirmation count is incremented and checked atomically.
     *      Execution sets executed=true BEFORE external call.
     */
    function confirmTransaction(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) notConfirmed(txId) {
        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmationCount++;
        emit TransactionConfirmed(txId, msg.sender);
        
        // Auto-execute if threshold reached - atomic check
        if (transactions[txId].confirmationCount == requiredConfirmations) {
            _executeTransaction(txId);
        }
    }
    
    /**
     * @dev Fixed: Sets executed=true BEFORE external call to prevent re-execution.
     */
    function _executeTransaction(uint256 txId) internal {
        Transaction storage txn = transactions[txId];
        require(!txn.executed, "Already executed");
        require(txn.confirmationCount >= requiredConfirmations, "Not enough confirmations");
        
        // Mark as executed BEFORE external call (CEI pattern)
        txn.executed = true;
        
        (bool success, ) = txn.destination.call{value: txn.value}(txn.data);
        require(success, "Execution failed");
        
        emit TransactionExecuted(txId);
    }
    
    function executeTransaction(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        require(transactions[txId].confirmationCount >= requiredConfirmations, "Not enough confirmations");
        _executeTransaction(txId);
    }
    
    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }
}
