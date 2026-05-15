// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CrossChainBridge
 * @dev Fixed: Cross-chain replay attack prevented via chain ID + nonce in message hash.
 */
contract CrossChainBridge {
    address public admin;
    uint256 public sourceChainId;
    uint256 public nonce;
    
    mapping(bytes32 => bool) public processedMessages;
    mapping(uint256 => bool) public supportedChains;
    
    event BridgeInitiated(address indexed sender, uint256 destChain, bytes32 messageId, uint256 nonce);
    event BridgeCompleted(bytes32 messageId, address indexed recipient);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor(uint256 _sourceChainId) {
        admin = msg.sender;
        sourceChainId = _sourceChainId;
    }
    
    /**
     * @dev Fixed: Message hash includes source chain ID, destination chain ID, and nonce.
     *      This prevents replay attacks across different chains.
     */
    function initiateBridge(uint256 destChainId, address recipient, bytes calldata data) external returns (bytes32) {
        require(supportedChains[destChainId], "Unsupported destination chain");
        require(recipient != address(0), "Invalid recipient");
        
        uint256 currentNonce = nonce++;
        
        // Fix: Include chain IDs and nonce in message hash
        bytes32 messageId = keccak256(abi.encodePacked(
            sourceChainId,       // Source chain prevents cross-chain replay
            destChainId,         // Destination chain for exact targeting
            currentNonce,        // Nonce prevents same-chain replay
            msg.sender,
            recipient,
            data,
            block.timestamp
        ));
        
        processedMessages[messageId] = true;
        
        emit BridgeInitiated(msg.sender, destChainId, messageId, currentNonce);
        return messageId;
    }
    
    /**
     * @dev Fixed: Verify message includes source chain ID to prevent replay from other chains.
     */
    function completeBridge(
        uint256 fromChainId,
        bytes32 messageId,
        address recipient,
        bytes calldata data,
        bytes calldata signature
    ) external {
        require(supportedChains[fromChainId], "Unsupported source chain");
        require(!processedMessages[messageId], "Already processed");
        
        // Reconstruct message hash with chain IDs
        bytes32 messageHash = keccak256(abi.encodePacked(
            fromChainId,
            sourceChainId,
            messageId,
            recipient,
            data
        ));
        
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        // Verify signature
        address signer = recoverSigner(ethSignedHash, signature);
        require(signer == admin, "Invalid signature");
        
        processedMessages[messageId] = true;
        
        emit BridgeCompleted(messageId, recipient);
    }
    
    function addSupportedChain(uint256 chainId) external onlyAdmin {
        supportedChains[chainId] = true;
    }
    
    function removeSupportedChain(uint256 chainId) external onlyAdmin {
        supportedChains[chainId] = false;
    }
    
    function recoverSigner(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        return ecrecover(hash, v, r, s);
    }
}
