// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CrossChainBridge is Ownable {
    address public validator;
    uint256 public immutable deployedChainId;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public processedHashes;

    event TransferProcessed(address sender, address recipient, uint256 amount, uint256 nonce);

    constructor(address _v) { require(_v != address(0)); validator = _v; deployedChainId = block.chainid; }

    function processTransfer(address recipient, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        require(recipient != address(0) && amount > 0);
        uint256 nonce = nonces[msg.sender]++;
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Transfer(address sender,address recipient,uint256 amount,uint256 nonce,address contractAddr)"),
            msg.sender, recipient, amount, nonce, address(this)
        ));
        bytes32 domainSep = keccak256(abi.encode(
            keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"),
            block.chainid, address(this)
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid sig");
        require(signer == validator, "Unauthorized");
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, recipient, amount, nonce, block.chainid));
        require(!processedHashes[hash], "Replay");
        processedHashes[hash] = true;
        emit TransferProcessed(msg.sender, recipient, amount, nonce);
    }

    function updateValidator(address _v) external onlyOwner { require(_v != address(0)); validator = _v; }
}