// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/**
 * @title CurveYield System Component
 * @notice CurveYield is a decentralized NGO building optimized DeFi systems for the good of all.
 *
 * @dev CurveYield integrates specialized AMM infrastructure, tokenized yield strategies, credit
 * markets, and protocol-owned liquidity into a unified, capital-efficient liquidity stack governed
 * by an open, international DAO community.
 *
 * Protocol operations are enhanced by cross-chain bridging and messaging, MEV capture systems,
 * off-chain to on-chain automation, and peer-to-peer data networks.
 *
 * This contract is one component of the CurveYield system.
 *
 * CurveYield uses proven DeFi primitives where possible and adds targeted coordination and
 * capital-efficiency-enhancing contracts where needed. Users and integrators must review
 * CurveYield documentation before use.
 *
 * Learn more:
 * Documentation: https://docs.curveyield.com
 * dApp: https://curveyield.online
 * GitHub: https://github.com/curveyield
 *
 * Decentralized links may have limited or delayed availability during periods of high network activity:
 * https://curveyield.eth.limo
 * https://curveyield.dao
 *
 * Note: curveyield.dao may require a Brave Browser or an Unstoppable Domains browser plugin to use.
 */

interface IERC20RewardConverterV27 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address account, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IYbCrvUsdPoolV27 {
    function coins(uint256 index) external view returns (address);
    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256);
    function price_oracle() external view returns (uint256);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external returns (uint256);
}

interface ISdYbYbPoolRewardV27 {
    function coins(uint256 index) external view returns (address);
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);
    function price_oracle(uint256 index) external view returns (uint256);
    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external returns (uint256);
}

library SafeTokenRewardConverterV27 {
    error TokenCallFailed(address token);

    function safeTransfer(IERC20RewardConverterV27 token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transfer, (to, amount)));
    }

    function safeTransferFrom(
        IERC20RewardConverterV27 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        _call(token, abi.encodeCall(token.transferFrom, (from, to, amount)));
    }

    function forceApprove(IERC20RewardConverterV27 token, address spender, uint256 amount) internal {
        uint256 current = token.allowance(address(this), spender);
        if (current != 0) _call(token, abi.encodeCall(token.approve, (spender, 0)));
        if (amount != 0) _call(token, abi.encodeCall(token.approve, (spender, amount)));
    }

    function _call(IERC20RewardConverterV27 token, bytes memory data) private {
        (bool ok, bytes memory result) = address(token).call(data);
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenCallFailed(address(token));
        }
    }
}

contract CurveYieldSdYBRewardConverterV27 {
    string public constant converterVersion = "v27";

    using SafeTokenRewardConverterV27 for IERC20RewardConverterV27;

    address public constant CRVUSD = 0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E;
    address public constant YB = 0x01791F726B4103694969820be083196cC7c045fF;
    address public constant SDYB = 0x0c057598dcE1891688829581f890DD2a3685a43f;
    address public constant SDYB_YB_POOL = 0x98b540fa89690969D111D045afCa575C91519B1A;

    uint256 private constant MAX_BPS = 10_000;
    uint256 private constant MAX_DEVIATION_BPS = 1_000;
    uint256 private constant MIN_PROTECTED_OUTPUT_BPS = 9_000;
    int128 private constant YB_INDEX = 0;
    int128 private constant SDYB_INDEX = 1;

    IERC20RewardConverterV27 private immutable crvUsdToken;
    IERC20RewardConverterV27 private immutable ybToken;
    IERC20RewardConverterV27 private immutable sdYbToken;
    IYbCrvUsdPoolV27 public immutable ybCrvUsdPool;
    ISdYbYbPoolRewardV27 private immutable mainPool;

    event RewardConverted(
        address indexed caller,
        address indexed receiver,
        uint256 crvUsdIn,
        uint256 ybIntermediate,
        uint256 sdYBOut
    );

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineExpired();
    error InvalidIntegration();
    error InvalidProtection();
    error InvalidOracle();
    error ExcessiveDeviation(uint256 observed, uint256 referenceValue);
    error ProtectedMinimumTooLow(uint256 supplied, uint256 required);

    constructor(address ybCrvUsdPool_) {
        if (ybCrvUsdPool_ == address(0)) revert ZeroAddress();
        IYbCrvUsdPoolV27 rewardPool = IYbCrvUsdPoolV27(ybCrvUsdPool_);
        ISdYbYbPoolRewardV27 fixedPool = ISdYbYbPoolRewardV27(SDYB_YB_POOL);
        if (
            rewardPool.coins(0) != CRVUSD || rewardPool.coins(1) != YB
                || fixedPool.coins(uint256(uint128(YB_INDEX))) != YB
                || fixedPool.coins(uint256(uint128(SDYB_INDEX))) != SDYB
        ) revert InvalidIntegration();

        crvUsdToken = IERC20RewardConverterV27(CRVUSD);
        ybToken = IERC20RewardConverterV27(YB);
        sdYbToken = IERC20RewardConverterV27(SDYB);
        ybCrvUsdPool = rewardPool;
        mainPool = fixedPool;
    }

    function convertCrvUsdToSdYB(
        uint256 amount,
        uint256 minYbOut,
        uint256 minSdYBOut,
        uint256 maxDeviationBps,
        uint256 deadline,
        address receiver
    ) external returns (uint256 sdYBOut) {
        if (amount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (maxDeviationBps > MAX_DEVIATION_BPS) revert InvalidProtection();

        uint256 beforeCrvUsd = crvUsdToken.balanceOf(address(this));
        crvUsdToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 crvUsdIn = crvUsdToken.balanceOf(address(this)) - beforeCrvUsd;
        if (crvUsdIn == 0) revert ZeroAmount();

        (uint256 ybSpot, uint256 ybOracle) = _crvUsdToYbReferences(crvUsdIn);
        _checkDeviation(ybSpot, ybOracle, maxDeviationBps);
        uint256 protectedYbMinimum = _min(ybSpot, ybOracle) * MIN_PROTECTED_OUTPUT_BPS / MAX_BPS;
        if (minYbOut < protectedYbMinimum) revert ProtectedMinimumTooLow(minYbOut, protectedYbMinimum);

        uint256 ybBefore = ybToken.balanceOf(address(this));
        crvUsdToken.forceApprove(address(ybCrvUsdPool), crvUsdIn);
        ybCrvUsdPool.exchange(0, 1, crvUsdIn, minYbOut);
        crvUsdToken.forceApprove(address(ybCrvUsdPool), 0);
        uint256 ybOut = ybToken.balanceOf(address(this)) - ybBefore;
        if (ybOut == 0) revert ZeroAmount();

        (uint256 sdYbSpot, uint256 sdYbOracle) = _ybToSdYbReferences(ybOut);
        _checkDeviation(sdYbSpot, sdYbOracle, maxDeviationBps);
        uint256 protectedSdYbMinimum = _min(sdYbSpot, sdYbOracle) * MIN_PROTECTED_OUTPUT_BPS / MAX_BPS;
        if (minSdYBOut < protectedSdYbMinimum) {
            revert ProtectedMinimumTooLow(minSdYBOut, protectedSdYbMinimum);
        }

        uint256 sdYbBefore = sdYbToken.balanceOf(address(this));
        ybToken.forceApprove(address(mainPool), ybOut);
        mainPool.exchange(YB_INDEX, SDYB_INDEX, ybOut, minSdYBOut);
        ybToken.forceApprove(address(mainPool), 0);
        sdYBOut = sdYbToken.balanceOf(address(this)) - sdYbBefore;
        if (sdYBOut == 0) revert ZeroAmount();

        sdYbToken.safeTransfer(receiver, sdYBOut);
        emit RewardConverted(msg.sender, receiver, crvUsdIn, ybOut, sdYBOut);
    }

    function quoteCrvUsdToSdYB(uint256 amount, bool strict) public view returns (uint256 quoted) {
        if (amount == 0) return 0;
        try this.quoteCrvUsdToYB(amount) returns (uint256 ybAmount) {
            try this.quoteYbToSdYB(ybAmount) returns (uint256 sdYbAmount) {
                return sdYbAmount;
            } catch {
                if (strict) revert InvalidOracle();
            }
        } catch {
            if (strict) revert InvalidOracle();
        }
    }

    function quoteCrvUsdToYB(uint256 amount) external view returns (uint256) {
        (uint256 spot, uint256 oracle) = _crvUsdToYbReferences(amount);
        return _min(spot, oracle);
    }

    function quoteYbToSdYB(uint256 amount) external view returns (uint256) {
        (uint256 spot, uint256 oracle) = _ybToSdYbReferences(amount);
        return _min(spot, oracle);
    }

    function _crvUsdToYbReferences(uint256 amount) internal view returns (uint256 spot, uint256 oracleValue) {
        if (amount == 0) return (0, 0);
        spot = ybCrvUsdPool.get_dy(0, 1, amount);
        uint256 oracle = ybCrvUsdPool.price_oracle();
        if (oracle == 0) revert InvalidOracle();
        oracleValue = amount * 1e18 / oracle;
        if (spot == 0 || oracleValue == 0) revert InvalidOracle();
    }

    function _ybToSdYbReferences(uint256 amount) internal view returns (uint256 spot, uint256 oracleValue) {
        if (amount == 0) return (0, 0);
        spot = mainPool.get_dy(YB_INDEX, SDYB_INDEX, amount);
        uint256 oracle = mainPool.price_oracle(0);
        if (oracle == 0) revert InvalidOracle();
        oracleValue = amount * 1e18 / oracle;
        if (spot == 0 || oracleValue == 0) revert InvalidOracle();
    }

    function _checkDeviation(uint256 observed, uint256 referenceValue, uint256 maxDeviationBps) internal pure {
        if (observed == 0 || referenceValue == 0) revert InvalidOracle();
        uint256 difference = observed > referenceValue ? observed - referenceValue : referenceValue - observed;
        if (difference * MAX_BPS > referenceValue * maxDeviationBps) {
            revert ExcessiveDeviation(observed, referenceValue);
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
