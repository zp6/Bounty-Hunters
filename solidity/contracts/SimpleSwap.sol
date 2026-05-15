// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleSwap {
    uint256 public constant FEE_BPS = 30;
    mapping(address => uint256) public reserveA;
    mapping(address => uint256) public reserveB;
    address public tokenA;
    address public tokenB;
    event Swapped(address indexed sender, uint256 amountIn, uint256 amountOut);

    constructor(address _a, address _b) { tokenA = _a; tokenB = _b; }

    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, uint256 deadline) external returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Expired");
        require(amountIn > 0, "Zero input");
        bool isAToB = tokenIn == tokenA;
        uint256 rIn = isAToB ? reserveA[tokenA] : reserveB[tokenB];
        uint256 rOut = isAToB ? reserveB[tokenB] : reserveA[tokenA];
        uint256 fee = (amountIn * FEE_BPS) / 10000;
        uint256 afterFee = amountIn - fee;
        amountOut = (afterFee * rOut) / (rIn + afterFee);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        if (isAToB) { reserveA[tokenA] += amountIn; reserveB[tokenB] -= amountOut; }
        else { reserveB[tokenB] += amountIn; reserveA[tokenA] -= amountOut; }
        emit Swapped(msg.sender, amountIn, amountOut);
    }

    function addLiquidity(uint256 a, uint256 b) external { reserveA[tokenA] += a; reserveB[tokenB] += b; }
}