// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleSwap {
    mapping(address => uint256) public reserves;
    uint256 public constant FEE_BPS = 30;
    uint256 public constant FEE_DENOMINATOR = 10000;

    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline) external returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(amountIn > 0, "Amount in must be > 0");
        uint256 reserveIn = reserves[tokenIn];
        uint256 reserveOut = reserves[tokenOut];
        require(reserveIn > 0 && reserveOut > 0, "No reserves");
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_BPS);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        reserves[tokenIn] += amountIn;
        reserves[tokenOut] -= amountOut;
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut);
    }

    function addLiquidity(address token, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        reserves[token] += amount;
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_BPS);
        return (amountInWithFee * reserves[tokenOut]) / (reserves[tokenIn] * FEE_DENOMINATOR + amountInWithFee);
    }
}
