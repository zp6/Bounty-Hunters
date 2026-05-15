// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MultiSigWallet {
    struct Transaction { address to; uint256 value; bytes data; bool executed; uint256 numConfirmations; }
    struct Confirmation { bool confirmed; uint256 timestamp; }

    mapping(uint256 => mapping(address => Confirmation)) public confirmations;
    Transaction[] public transactions;
    uint256 public requiredConfirmations;
    address[] public owners;
    mapping(address => bool) public isOwner;

    event TxSubmitted(uint256 indexed id, address to, uint256 value);
    event TxConfirmed(uint256 indexed id, address owner);
    event TxExecuted(uint256 indexed id);

    modifier onlyOwner() { require(isOwner[msg.sender], "Not owner"); _; }
    modifier txExists(uint256 id) { require(id < transactions.length, "No tx"); _; }
    modifier notExecuted(uint256 id) { require(!transactions[id].executed, "Done"); _; }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0 && _required > 0 && _required <= _owners.length);
        for (uint256 i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0) && !isOwner[_owners[i]]);
            isOwner[_owners[i]] = true; owners.push(_owners[i]);
        }
        requiredConfirmations = _required;
    }

    function submitTransaction(address to, uint256 value, bytes memory data) external onlyOwner returns (uint256) {
        require(to != address(0), "Invalid target");
        uint256 id = transactions.length;
        transactions.push(Transaction(to, value, data, false, 0));
        emit TxSubmitted(id, to, value);
        return id;
    }

    function confirmTransaction(uint256 id) external onlyOwner txExists(id) notExecuted(id) {
        require(!confirmations[id][msg.sender].confirmed, "Done");
        confirmations[id][msg.sender] = Confirmation(true, block.timestamp);
        transactions[id].numConfirmations++;
        emit TxConfirmed(id, msg.sender);
    }

    function executeTransaction(uint256 id) external onlyOwner txExists(id) notExecuted(id) {
        require(transactions[id].numConfirmations >= requiredConfirmations, "Need more");
        transactions[id].executed = true;
        uint256 valid = _countValid(id);
        require(valid >= requiredConfirmations, "Confirmations changed");
        Transaction storage t = transactions[id];
        (bool ok, ) = t.to.call{value: t.value}(t.data);
        require(ok, "Failed");
        emit TxExecuted(id);
    }

    function _countValid(uint256 id) internal view returns (uint256 c) {
        for (uint256 i = 0; i < owners.length; i++)
            if (confirmations[id][owners[i]].confirmed) c++;
    }

    receive() external payable {}
}