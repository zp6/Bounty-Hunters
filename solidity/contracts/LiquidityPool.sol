// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LiquidityPool is ERC20 {
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    IERC20 public tokenA;
    IERC20 public tokenB;
    uint256 internal _reserveA;
    uint256 internal _reserveB;

    event LiquidityAdded(address provider, uint256 a, uint256 b, uint256 lp);
    event Sync(uint256 rA, uint256 rB);

    constructor(address a, address b) ERC20("LiquidityPool", "LP") { tokenA = IERC20(a); tokenB = IERC20(b); }

    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 lp) {
        require(amountA > 0 && amountB > 0, "Zero");
        uint256 ts = totalSupply();
        if (ts == 0) {
            lp = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            require(lp > 0, "Low deposit");
            _mint(address(0), MINIMUM_LIQUIDITY);
        } else {
            lp = _min((amountA * ts) / _reserveA, (amountB * ts) / _reserveB);
        }
        require(lp > 0);
        _mint(msg.sender, lp);
        _reserveA += amountA; _reserveB += amountB;
        require(tokenA.transferFrom(msg.sender, address(this), amountA));
        require(tokenB.transferFrom(msg.sender, address(this), amountB));
        emit LiquidityAdded(msg.sender, amountA, amountB, lp);
    }

    function removeLiquidity(uint256 lp) external returns (uint256 a, uint256 b) {
        require(lp > 0 && balanceOf(msg.sender) >= lp);
        uint256 ts = totalSupply();
        a = (lp * _reserveA) / ts; b = (lp * _reserveB) / ts;
        require(a > 0 && b > 0);
        _burn(msg.sender, lp);
        _reserveA -= a; _reserveB -= b;
        require(tokenA.transfer(msg.sender, a) && tokenB.transfer(msg.sender, b));
    }

    function sync() external {
        _reserveA = tokenA.balanceOf(address(this));
        _reserveB = tokenB.balanceOf(address(this));
        emit Sync(_reserveA, _reserveB);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) z = 1;
    }
    function _min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}