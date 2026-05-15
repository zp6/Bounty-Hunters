// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LiquidityPool
 * @dev Fixed: First-depositor price manipulation prevented via MINIMUM_LIQUIDITY lock.
 */
contract LiquidityPool {
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    
    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(address indexed user, uint256 amountIn, uint256 amountOut, bool token0In);
    
    /**
     * @dev Fixed: First depositor manipulation prevented.
     *      - Minimum liquidity is permanently locked on first deposit
     *      - LP tokens are minted fairly using geometric mean
     *      - Subsequent deposits use the standard formula
     */
    function addLiquidity(uint256 amount0, uint256 amount1) external returns (uint256 liquidity) {
        require(amount0 > 0 && amount1 > 0, "Amounts must be > 0");
        
        if (totalSupply == 0) {
            // First deposit: use geometric mean, lock MINIMUM_LIQUIDITY
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            require(liquidity > 0, "Insufficient initial liquidity");
            
            // Permanently lock minimum liquidity
            totalSupply += MINIMUM_LIQUIDITY;
            balanceOf[BURN_ADDRESS] = MINIMUM_LIQUIDITY;
        } else {
            // Subsequent deposits: proportional to existing reserves
            liquidity = min(
                (amount0 * totalSupply) / reserve0,
                (amount1 * totalSupply) / reserve1
            );
        }
        
        require(liquidity > 0, "Insufficient liquidity minted");
        
        balanceOf[msg.sender] += liquidity;
        totalSupply += liquidity;
        
        reserve0 += amount0;
        reserve1 += amount1;
        
        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }
    
    function removeLiquidity(uint256 liquidity) external returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "Cannot remove 0");
        require(balanceOf[msg.sender] >= liquidity, "Insufficient balance");
        
        amount0 = (liquidity * reserve0) / totalSupply;
        amount1 = (liquidity * reserve1) / totalSupply;
        
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");
        
        balanceOf[msg.sender] -= liquidity;
        totalSupply -= liquidity;
        reserve0 -= amount0;
        reserve1 -= amount1;
        
        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }
    
    function swap(uint256 amountIn, bool token0In) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        
        uint256 reserveIn = token0In ? reserve0 : reserve1;
        uint256 reserveOut = token0In ? reserve1 : reserve0;
        
        uint256 amountInWithFee = (amountIn * 997) / 1000;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
        
        require(amountOut > 0, "Insufficient output");
        
        if (token0In) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }
        
        emit Swap(msg.sender, amountIn, amountOut, token0In);
    }
    
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
