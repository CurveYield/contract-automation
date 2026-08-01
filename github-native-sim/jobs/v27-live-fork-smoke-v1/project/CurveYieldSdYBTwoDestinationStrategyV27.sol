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

interface IERC20StrategyV27 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address account, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

library SafeTokenStrategyV27 {
    error TokenCallFailed(address token);

    function safeTransfer(IERC20StrategyV27 token, address to, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transfer, (to, amount)));
    }

    function forceApprove(IERC20StrategyV27 token, address spender, uint256 amount) internal {
        uint256 current = token.allowance(address(this), spender);
        if (current != 0) _call(token, abi.encodeCall(token.approve, (spender, 0)));
        if (amount != 0) _call(token, abi.encodeCall(token.approve, (spender, amount)));
    }

    function _call(IERC20StrategyV27 token, bytes memory data) private {
        (bool ok, bytes memory result) = address(token).call(data);
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TokenCallFailed(address(token));
        }
    }
}

abstract contract OwnableTwoStepStrategyV27 {
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error UnauthorizedAccount(address account);
    error InvalidOwner(address account);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert InvalidOwner(address(0));
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != _owner) revert UnauthorizedAccount(msg.sender);
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function pendingOwner() public view returns (address) {
        return _pendingOwner;
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert InvalidOwner(address(0));
        _pendingOwner = next;
        emit OwnershipTransferStarted(_owner, next);
    }

    function acceptOwnership() external {
        if (msg.sender != _pendingOwner) revert UnauthorizedAccount(msg.sender);
        address previous = _owner;
        _owner = msg.sender;
        delete _pendingOwner;
        emit OwnershipTransferred(previous, msg.sender);
    }
}

abstract contract ReentrancyGuardStrategyV27 {
    uint256 private _status = 1;
    error ReentrantCall();

    modifier nonReentrant() {
        if (_status == 2) revert ReentrantCall();
        _status = 2;
        _;
        _status = 1;
    }
}

interface ISdYbYbPoolStrategyV27 {
    function coins(uint256 index) external view returns (address);
    function add_liquidity(uint256[] calldata amounts, uint256 minMintAmount) external returns (uint256);
    function remove_liquidity_one_coin(uint256 lpAmount, int128 index, uint256 minAmount)
        external
        returns (uint256);
    function calc_token_amount(uint256[] calldata amounts, bool isDeposit) external view returns (uint256);
    function calc_withdraw_one_coin(uint256 lpAmount, int128 index) external view returns (uint256);
    function get_virtual_price() external view returns (uint256);
    function price_oracle(uint256 index) external view returns (uint256);
}

interface IBoostHubStakingStrategyV27 {
    function lp_token() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function withdraw_fee_bps() external view returns (uint256);
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function harvest() external;
    function claim_rewards(address account) external;
    function claimable_reward(address account, address token) external view returns (uint256);
}

interface IYearnVaultStrategyV27 {
    function token() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function pricePerShare() external view returns (uint256);
    function deposit(uint256 amount, address recipient) external returns (uint256 shares);
    function withdraw(uint256 maxShares, address recipient, uint256 maxLoss) external returns (uint256 assets);
}

interface IHybridVaultStrategyV27 {
    function harvestFeeBps() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IRewardConverterStrategyV27 {
    function CRVUSD() external view returns (address);
    function YB() external view returns (address);
    function SDYB() external view returns (address);
    function SDYB_YB_POOL() external view returns (address);
    function quoteCrvUsdToYB(uint256 amount) external view returns (uint256);
    function quoteCrvUsdToSdYB(uint256 amount, bool strict) external view returns (uint256);
    function convertCrvUsdToSdYB(
        uint256 amount,
        uint256 minYbOut,
        uint256 minSdYBOut,
        uint256 maxDeviationBps,
        uint256 deadline,
        address receiver
    ) external returns (uint256 sdYBOut);

}

contract CurveYieldSdYBTwoDestinationStrategyV27 is OwnableTwoStepStrategyV27, ReentrancyGuardStrategyV27 {
    using SafeTokenStrategyV27 for IERC20StrategyV27;

    enum Destination { BoostHub, Yearn }

    address internal constant SDYB = 0x0c057598dcE1891688829581f890DD2a3685a43f;
    address internal constant YB = 0x01791F726B4103694969820be083196cC7c045fF;
    address internal constant CRVUSD = 0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E;
    address internal constant LP_AND_POOL = 0x98b540fa89690969D111D045afCa575C91519B1A;
    address internal constant YEARN_VAULT = 0xeC456f00E1f1a6A9097b723Ab979c27AB45C5906;

    int128 internal constant YB_INDEX = 0;
    int128 internal constant SDYB_INDEX = 1;
    uint256 internal constant MAX_BPS = 10_000;
    uint256 internal constant RETAINED_REWARD_BPS = 400;
    uint256 internal constant MAX_RETAINED_MIGRATION_SPEND_BPS = 4_000;
    uint256 internal constant WAD = 1e18;

    string public constant strategyVersion = "v27";
    address public immutable vault;

    IERC20StrategyV27 private immutable sdYbToken;
    IERC20StrategyV27 private immutable ybToken;
    IERC20StrategyV27 private immutable crvUsdToken;
    IERC20StrategyV27 private immutable lpToken;
    ISdYbYbPoolStrategyV27 private immutable curvePool;
    IBoostHubStakingStrategyV27 private immutable boostHubStaking;
    IYearnVaultStrategyV27 private immutable yearnVault;

    IRewardConverterStrategyV27 private converter;
    address private keeper;
    address private adminFeeReceiver;
    Destination private activeDestination;

    uint256 internal constant ADD_LIQUIDITY_MIN_BPS = 9_950;
    uint256 internal constant REMOVE_LIQUIDITY_MIN_BPS = 9_900;
    uint256 internal constant YEARN_MAX_LOSS_BPS = 50;
    uint256 internal constant CONVERSION_MIN_BPS = 9_950;
    uint256 internal constant MAX_ORACLE_DEVIATION_BPS = 300;
    uint256 internal constant MIN_HARVEST_SDYB = 1e18;

    uint256 private retainedSdYBReserve;
    uint256 private totalRetainedSdYB;
    uint256 private retainedSdYBSpentForMigration;
    uint256 private retainedSdYBRescued;

    bool public retired;


    event DepositDestinationSet(Destination indexed previous, Destination indexed next, address indexed caller);
    event KeeperSet(address indexed previous, address indexed next);
    event ConverterSet(address indexed previous, address indexed next);
    event AdminFeeReceiverSet(address indexed previous, address indexed next);
    event SdYBDeployed(Destination indexed destination, uint256 sdYBAmount, uint256 positionTokensReceived);
    event VaultWithdrawal(
        uint256 requestedSdYB,
        uint256 sentSdYB,
        uint256 realizedLossSdYB,
        Destination firstSource
    );
    event YearnMigratedToBoostHub(uint256 yearnShares, uint256 lpReceived, uint256 sdYBReceived);
    event BoostHubMigratedToYearn(uint256 gaugeAmount, uint256 sdYBReceived, uint256 lpReceived);
    event Harvested(uint256 grossSdYB, uint256 feeSdYB, uint256 retainedSdYB, bool complete);
    event RetainedMigrationLossCovered(uint256 amount, uint256 remainingReserve);
    event RetainedDeploymentLossRealized(uint256 amount, uint256 remainingReserve);
    event FinalShareholderWithdrawal(uint256 shareholderBackingSdYB, uint256 retainedSdYBSent);
    event VaultRetainedCapitalDeployed(
        uint256 totalSdYBAmount,
        uint256 shareholderContributionSdYB,
        uint256 creditedRetainedSdYB,
        uint256 retainedDeploymentLossSdYB
    );
    event StrategyRetired(address indexed nextStrategy, uint256 boostHubGaugeTokens, uint256 yearnShares);
    event RetirementRewardsSettled(uint256 grossSdYB, uint256 feeSdYB, uint256 retainedSdYB);

    error ZeroAddress();
    error NotVault();
    error NotOwnerOrKeeper();
    error NotSelf();
    error InvalidIntegration();
    error InvalidDestination();
    error InvalidProtection();
    error DeadlineExpired();
    error ZeroAmount();
    error InsufficientPosition();
    error PositionOperationFailed();
    error StrategyIsRetired();
    error RetirementIncomplete();
    error MigrationReducedUserBacking();
    error InsufficientRetainedMigrationReserve();
    error RetainedReserveExceedsBacking();
    error InvalidVaultRetainedDeposit();
    error InsufficientVaultRetainedDeposit();
    error VaultRetainedDepositReducedShareholderBacking();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert NotOwnerOrKeeper();
        _;
    }

    modifier active() {
        if (retired) revert StrategyIsRetired();
        _;
    }


    constructor(
        address vault_,
        address boostHubStaking_,
        address converter_,
        address adminFeeReceiver_,
        address keeper_,
        Destination initialDestination_,
        address owner_
    ) OwnableTwoStepStrategyV27(owner_) {
        if (
            vault_ == address(0) || boostHubStaking_ == address(0) || converter_ == address(0)
                || adminFeeReceiver_ == address(0)
        ) revert ZeroAddress();
        if (uint8(initialDestination_) > uint8(Destination.Yearn)) revert InvalidDestination();

        ISdYbYbPoolStrategyV27 pool = ISdYbYbPoolStrategyV27(LP_AND_POOL);
        IBoostHubStakingStrategyV27 boost = IBoostHubStakingStrategyV27(boostHubStaking_);
        IYearnVaultStrategyV27 yearn = IYearnVaultStrategyV27(YEARN_VAULT);
        IRewardConverterStrategyV27 rewardConverter = IRewardConverterStrategyV27(converter_);

        if (
            pool.coins(uint256(uint128(YB_INDEX))) != YB
                || pool.coins(uint256(uint128(SDYB_INDEX))) != SDYB
                || boost.lp_token() != SDYB || yearn.token() != LP_AND_POOL
                || rewardConverter.CRVUSD() != CRVUSD || rewardConverter.YB() != YB
                || rewardConverter.SDYB() != SDYB || rewardConverter.SDYB_YB_POOL() != LP_AND_POOL
        ) revert InvalidIntegration();

        vault = vault_;
        sdYbToken = IERC20StrategyV27(SDYB);
        ybToken = IERC20StrategyV27(YB);
        crvUsdToken = IERC20StrategyV27(CRVUSD);
        lpToken = IERC20StrategyV27(LP_AND_POOL);
        curvePool = pool;
        boostHubStaking = boost;
        yearnVault = yearn;
        converter = rewardConverter;
        adminFeeReceiver = adminFeeReceiver_;
        keeper = keeper_;
        activeDestination = initialDestination_;
        _giveAllowances();
    }

    function want() external pure returns (address) {
        return SDYB;
    }

    function beforeDeposit() external onlyVault active nonReentrant {
        _checkpointRewards();
    }

    function beforeWithdraw() external onlyVault active nonReentrant {
        _checkpointRewards();
    }

    function deposit() external onlyVault active nonReentrant {
        _depositAllLpToYearn();
        _deployAllSdYB(activeDestination);
    }

    function depositVaultRetained(uint256 totalSdYBAmount, uint256 retainedSdYBAmount)
        external
        onlyVault
        active
        nonReentrant
    {
        if (totalSdYBAmount == 0 || retainedSdYBAmount > totalSdYBAmount) {
            revert InvalidVaultRetainedDeposit();
        }

        uint256 looseSdYB = _looseSdYB();
        if (looseSdYB < totalSdYBAmount) revert InsufficientVaultRetainedDeposit();

        uint256 grossBackingWithDeposit = _grossBacking(true);
        if (grossBackingWithDeposit < totalSdYBAmount) revert InsufficientVaultRetainedDeposit();
        uint256 grossBackingBefore = grossBackingWithDeposit - totalSdYBAmount;
        uint256 shareholderContribution = totalSdYBAmount - retainedSdYBAmount;

        _deployAllSdYB(activeDestination);

        uint256 grossBackingAfter = _grossBacking(true);
        uint256 realizedAddedValue = grossBackingAfter > grossBackingBefore
            ? grossBackingAfter - grossBackingBefore
            : 0;
        if (realizedAddedValue < shareholderContribution) {
            revert VaultRetainedDepositReducedShareholderBacking();
        }

        uint256 creditedRetained = realizedAddedValue - shareholderContribution;
        if (creditedRetained > retainedSdYBAmount) creditedRetained = retainedSdYBAmount;
        uint256 retainedDeploymentLoss = retainedSdYBAmount - creditedRetained;
        if (creditedRetained != 0) {
            retainedSdYBReserve += creditedRetained;
            totalRetainedSdYB += creditedRetained;
        }

        emit VaultRetainedCapitalDeployed(
            totalSdYBAmount, shareholderContribution, creditedRetained, retainedDeploymentLoss
        );
    }

    function withdraw(uint256 amount) external onlyVault nonReentrant returns (uint256 realizedLoss) {
        return _withdrawForVault(amount);
    }

    function harvest() external active nonReentrant {
        _harvest(true, true);
    }

    function setDepositDestination(Destination next) external onlyOwnerOrKeeper active {
        if (uint8(next) > uint8(Destination.Yearn)) revert InvalidDestination();
        Destination previous = activeDestination;
        activeDestination = next;
        emit DepositDestinationSet(previous, next, msg.sender);
    }

    function migrateYearnToBoostHub(
        uint256 yearnShares,
        uint256 minSdYBOut,
        uint256 deadline
    ) external onlyOwnerOrKeeper active nonReentrant {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (yearnShares == 0) revert ZeroAmount();
        if (yearnShares > yearnVault.balanceOf(address(this))) revert InsufficientPosition();

        uint256 userBackingBefore = depositBacking();
        uint256 lpBefore = lpToken.balanceOf(address(this));
        yearnVault.withdraw(yearnShares, address(this), YEARN_MAX_LOSS_BPS);
        uint256 lpReceived = lpToken.balanceOf(address(this)) - lpBefore;
        if (lpReceived == 0) revert PositionOperationFailed();

        uint256 quote = curvePool.calc_withdraw_one_coin(lpReceived, SDYB_INDEX);
        uint256 protectedMinimum = quote * REMOVE_LIQUIDITY_MIN_BPS / MAX_BPS;
        if (minSdYBOut < protectedMinimum) revert InvalidProtection();

        uint256 sdYbBefore = sdYbToken.balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(lpReceived, SDYB_INDEX, minSdYBOut);
        uint256 sdYbReceived = sdYbToken.balanceOf(address(this)) - sdYbBefore;
        _depositAllBoostHub();
        _coverMigrationLoss(userBackingBefore);
        emit YearnMigratedToBoostHub(yearnShares, lpReceived, sdYbReceived);
    }

    function migrateBoostHubToYearn(
        uint256 gaugeAmount,
        uint256 minLpOut,
        uint256 deadline
    ) external onlyOwnerOrKeeper active nonReentrant {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (gaugeAmount == 0) revert ZeroAmount();
        if (gaugeAmount > boostHubStaking.balanceOf(address(this))) revert InsufficientPosition();

        uint256 userBackingBefore = depositBacking();
        uint256 sdYbBefore = sdYbToken.balanceOf(address(this));
        boostHubStaking.withdraw(gaugeAmount);
        uint256 sdYbReceived = sdYbToken.balanceOf(address(this)) - sdYbBefore;
        if (sdYbReceived == 0) revert PositionOperationFailed();

        uint256[] memory amounts = new uint256[](2);
        amounts[uint256(uint128(SDYB_INDEX))] = sdYbReceived;
        uint256 quote = curvePool.calc_token_amount(amounts, true);
        uint256 protectedMinimum = quote * ADD_LIQUIDITY_MIN_BPS / MAX_BPS;
        if (minLpOut < protectedMinimum) revert InvalidProtection();

        uint256 lpBefore = lpToken.balanceOf(address(this));
        curvePool.add_liquidity(amounts, minLpOut);
        uint256 lpReceived = lpToken.balanceOf(address(this)) - lpBefore;
        _enforceLpDeviation(lpReceived);
        _depositAllLpToYearn();
        _coverMigrationLoss(userBackingBefore);
        emit BoostHubMigratedToYearn(gaugeAmount, sdYbReceived, lpReceived);
    }

    function finalShareholderWithdraw() external onlyVault active nonReentrant returns (uint256 transferred) {
        uint256 boostBalance = boostHubStaking.balanceOf(address(this));
        if (boostBalance != 0) boostHubStaking.withdraw(boostBalance);

        uint256 yearnShares = yearnVault.balanceOf(address(this));
        if (yearnShares != 0) yearnVault.withdraw(yearnShares, address(this), YEARN_MAX_LOSS_BPS);

        uint256 lpBalance = lpToken.balanceOf(address(this));
        if (lpBalance != 0) {
            uint256 quote = _quoteLpAsSdYB(lpBalance);
            curvePool.remove_liquidity_one_coin(
                lpBalance, SDYB_INDEX, quote * REMOVE_LIQUIDITY_MIN_BPS / MAX_BPS
            );
        }
        if (
            boostHubStaking.balanceOf(address(this)) != 0
                || yearnVault.balanceOf(address(this)) != 0
                || lpToken.balanceOf(address(this)) != 0
        ) revert RetirementIncomplete();

        _realizeRetainedDeploymentLoss();
        uint256 gross = _looseSdYB();
        uint256 retained = retainedSdYBReserve;
        if (gross < retained) revert RetainedReserveExceedsBacking();

        transferred = gross - retained;
        if (transferred != 0) sdYbToken.safeTransfer(vault, transferred);
        if (retained != 0) sdYbToken.safeTransfer(adminFeeReceiver, retained);
        _transferAll(crvUsdToken, adminFeeReceiver);
        _transferAll(ybToken, adminFeeReceiver);
        retainedSdYBReserve = 0;

        if (
            boostHubStaking.balanceOf(address(this)) != 0
                || yearnVault.balanceOf(address(this)) != 0
                || lpToken.balanceOf(address(this)) != 0
                || _looseSdYB() != 0
                || crvUsdToken.balanceOf(address(this)) != 0
                || ybToken.balanceOf(address(this)) != 0
        ) revert RetirementIncomplete();
        emit FinalShareholderWithdrawal(transferred, retained);
    }


    function retireStrat(address newStrategy)
        external
        onlyVault
        active
        nonReentrant
        returns (uint256 reserve, uint256 total, uint256 spent, uint256 rescued)
    {
        if (newStrategy == address(0)) revert ZeroAddress();

        try boostHubStaking.harvest() {} catch {}
        try boostHubStaking.claim_rewards(address(this)) {} catch {}
        try this.settleRetirementRewards() {} catch {}

        uint256 boostGaugeTokens = boostHubStaking.balanceOf(address(this));
        uint256 yearnShares = yearnVault.balanceOf(address(this));
        if (boostGaugeTokens != 0) {
            IERC20StrategyV27(address(boostHubStaking)).safeTransfer(newStrategy, boostGaugeTokens);
        }
        if (yearnShares != 0) {
            IERC20StrategyV27(YEARN_VAULT).safeTransfer(newStrategy, yearnShares);
        }
        _transferAll(lpToken, newStrategy);
        _transferAll(sdYbToken, newStrategy);
        _transferAll(crvUsdToken, newStrategy);
        _transferAll(ybToken, newStrategy);

        reserve = retainedSdYBReserve;
        total = totalRetainedSdYB;
        spent = retainedSdYBSpentForMigration;
        rescued = retainedSdYBRescued;
        retainedSdYBReserve = 0;
        totalRetainedSdYB = 0;
        retainedSdYBSpentForMigration = 0;
        retainedSdYBRescued = 0;

        if (
            boostHubStaking.balanceOf(address(this)) != 0
                || yearnVault.balanceOf(address(this)) != 0
                || lpToken.balanceOf(address(this)) != 0
                || sdYbToken.balanceOf(address(this)) != 0
                || crvUsdToken.balanceOf(address(this)) != 0
                || ybToken.balanceOf(address(this)) != 0
        ) revert RetirementIncomplete();

        retired = true;
        _revokeAllowances();
        emit StrategyRetired(newStrategy, boostGaugeTokens, yearnShares);
    }

    function settleRetirementRewards()
        external
        returns (uint256 harvested, uint256 fee, uint256 retained)
    {
        if (msg.sender != address(this)) revert NotSelf();
        (harvested, fee, retained) = _settleConvertedRewards(false, true);
        emit RetirementRewardsSettled(harvested, fee, retained);
    }

    function acceptMigrationAccounting(
        uint256 reserve,
        uint256 total,
        uint256 spent,
        uint256 rescued
    ) external onlyVault active nonReentrant {
        if (spent + rescued > total || reserve > total) revert InvalidProtection();
        retainedSdYBReserve += reserve;
        totalRetainedSdYB += total;
        retainedSdYBSpentForMigration += spent;
        retainedSdYBRescued += rescued;
        uint256 userBackingBefore = depositBacking();
        _depositAllLpToYearn();
        _deployAllSdYB(activeDestination);
        _realizeRetainedDeploymentLoss();
        _coverMigrationLoss(userBackingBefore);
    }


    function _checkpointRewards() internal {
        uint256 pendingCrvUsd = crvUsdToken.balanceOf(address(this));
        pendingCrvUsd += boostHubStaking.claimable_reward(address(this), CRVUSD);
        uint256 expected = pendingCrvUsd == 0 ? 0 : converter.quoteCrvUsdToSdYB(pendingCrvUsd, true);
        if (expected > MIN_HARVEST_SDYB && !_harvest(true, true)) revert RetirementIncomplete();
    }

    function _harvest(bool redeposit, bool retainRewards) internal returns (bool complete) {
        bool harvestOk;
        bool claimOk;
        try boostHubStaking.harvest() { harvestOk = true; } catch {}
        try boostHubStaking.claim_rewards(address(this)) { claimOk = true; } catch {}

        (uint256 harvested, uint256 fee, uint256 retained) = _settleConvertedRewards(redeposit, retainRewards);
        complete = harvestOk && claimOk;
        emit Harvested(harvested, fee, retained, complete);
    }

    function _settleConvertedRewards(bool redeposit, bool retainRewards)
        internal
        returns (uint256 harvested, uint256 fee, uint256 retained)
    {
        uint256 grossBackingBefore = _grossBacking(true);
        uint256 sdYbBefore = _looseSdYB();
        uint256 crvUsdAmount = crvUsdToken.balanceOf(address(this));
        if (crvUsdAmount != 0) {
            uint256 ybQuote = converter.quoteCrvUsdToYB(crvUsdAmount);
            uint256 sdYbQuote = converter.quoteCrvUsdToSdYB(crvUsdAmount, true);
            crvUsdToken.forceApprove(address(converter), crvUsdAmount);
            converter.convertCrvUsdToSdYB(
                crvUsdAmount,
                ybQuote * CONVERSION_MIN_BPS / MAX_BPS,
                sdYbQuote * CONVERSION_MIN_BPS / MAX_BPS,
                MAX_ORACLE_DEVIATION_BPS,
                block.timestamp,
                address(this)
            );
            crvUsdToken.forceApprove(address(converter), 0);
        }

        uint256 currentSdYb = _looseSdYB();
        harvested = currentSdYb > sdYbBefore ? currentSdYb - sdYbBefore : 0;
        uint256 feeBps = IHybridVaultStrategyV27(vault).harvestFeeBps();
        if (feeBps > MAX_BPS) revert InvalidProtection();
        fee = harvested * feeBps / MAX_BPS;
        if (fee != 0) sdYbToken.safeTransfer(adminFeeReceiver, fee);

        uint256 netHarvest = harvested - fee;
        if (IHybridVaultStrategyV27(vault).totalSupply() == 0) {
            if (netHarvest != 0) sdYbToken.safeTransfer(adminFeeReceiver, netHarvest);
            return (harvested, fee, 0);
        }

        if (redeposit) _deployAllSdYB(activeDestination);
        uint256 grossBackingAfter = _grossBacking(true);
        uint256 realizedBackingGain = grossBackingAfter > grossBackingBefore
            ? grossBackingAfter - grossBackingBefore
            : 0;
        retained = retainRewards ? realizedBackingGain * RETAINED_REWARD_BPS / MAX_BPS : 0;
        if (retained != 0) {
            retainedSdYBReserve += retained;
            totalRetainedSdYB += retained;
        }
    }

    function _withdrawForVault(uint256 amount) internal returns (uint256 realizedLoss) {
        if (amount == 0) return 0;
        uint256 userBackingBefore = depositBacking();
        Destination first = _otherDestination(activeDestination);

        uint256 loose = _looseSdYB();
        if (loose < amount) {
            _tryWithdrawFromDestination(first, amount - loose);
            loose = _looseSdYB();
        }
        if (loose < amount) {
            _tryWithdrawFromDestination(activeDestination, amount - loose);
            loose = _looseSdYB();
        }

        uint256 sent = loose < amount ? loose : amount;
        if (sent != 0) sdYbToken.safeTransfer(vault, sent);
        _deployAllSdYB(activeDestination);

        uint256 userBackingAfter = depositBacking();
        uint256 accountedAfter = userBackingAfter + sent;
        if (userBackingBefore > accountedAfter) realizedLoss = userBackingBefore - accountedAfter;
        emit VaultWithdrawal(amount, sent, realizedLoss, first);
    }

    function withdrawFromDestinationForVault(Destination source, uint256 targetSdYB)
        external
        returns (uint256 received)
    {
        if (msg.sender != address(this)) revert NotSelf();
        return _withdrawFromDestination(source, targetSdYB);
    }

    function _tryWithdrawFromDestination(Destination source, uint256 targetSdYB)
        internal
        returns (uint256 received)
    {
        try this.withdrawFromDestinationForVault(source, targetSdYB) returns (uint256 amount) {
            received = amount;
        } catch {}
    }

    function _withdrawFromDestination(Destination source, uint256 targetSdYB) internal returns (uint256 received) {
        if (targetSdYB == 0) return 0;
        if (source == Destination.BoostHub) return _withdrawBoostHubForSdYB(targetSdYB);
        return _withdrawYearnForSdYB(targetSdYB);
    }

    function _withdrawBoostHubForSdYB(uint256 targetSdYB) internal returns (uint256 received) {
        uint256 gaugeBalance = boostHubStaking.balanceOf(address(this));
        if (gaugeBalance == 0) return 0;
        uint256 feeBps = _boostWithdrawFeeBps(true);
        if (feeBps >= MAX_BPS) revert InvalidProtection();

        uint256 gaugeNeeded = _ceilDiv(targetSdYB * MAX_BPS, MAX_BPS - feeBps);
        if (gaugeNeeded > gaugeBalance) gaugeNeeded = gaugeBalance;
        uint256 beforeBalance = _looseSdYB();
        boostHubStaking.withdraw(gaugeNeeded);
        received = _looseSdYB() - beforeBalance;
    }

    function _withdrawYearnForSdYB(uint256 targetSdYB) internal returns (uint256 received) {
        uint256 shareBalance = yearnVault.balanceOf(address(this));
        if (shareBalance == 0) return 0;
        uint256 pps = yearnVault.pricePerShare();
        if (pps == 0) revert PositionOperationFailed();

        uint256 totalLp = shareBalance * pps / WAD;
        uint256 maxSdYb = _quoteLpAsSdYB(totalLp);
        uint256 sharesNeeded;
        if (targetSdYB >= maxSdYb) {
            sharesNeeded = shareBalance;
        } else {
            uint256 lpNeeded = _lpNeededForSdYB(targetSdYB, totalLp);
            sharesNeeded = _ceilDiv(lpNeeded * WAD, pps);
            if (sharesNeeded > shareBalance) sharesNeeded = shareBalance;
        }

        uint256 lpBefore = lpToken.balanceOf(address(this));
        yearnVault.withdraw(sharesNeeded, address(this), YEARN_MAX_LOSS_BPS);
        uint256 lpReceived = lpToken.balanceOf(address(this)) - lpBefore;
        if (lpReceived == 0) return 0;
        uint256 quote = _quoteLpAsSdYB(lpReceived);
        uint256 minOut = quote * REMOVE_LIQUIDITY_MIN_BPS / MAX_BPS;
        uint256 beforeBalance = _looseSdYB();
        curvePool.remove_liquidity_one_coin(lpReceived, SDYB_INDEX, minOut);
        received = _looseSdYB() - beforeBalance;
    }

    function _deployAllSdYB(Destination destination) internal {
        if (destination == Destination.BoostHub) _depositAllBoostHub();
        else _depositAllYearn();
    }

    function _depositAllBoostHub() internal {
        uint256 amount = _looseSdYB();
        if (amount == 0) return;
        uint256 beforeGauge = boostHubStaking.balanceOf(address(this));
        boostHubStaking.deposit(amount);
        uint256 received = boostHubStaking.balanceOf(address(this)) - beforeGauge;
        if (_looseSdYB() != 0) revert PositionOperationFailed();
        emit SdYBDeployed(Destination.BoostHub, amount, received);
    }

    function _depositAllYearn() internal {
        uint256 amount = _looseSdYB();
        uint256 lpReceived;
        if (amount != 0) {
            uint256[] memory amounts = new uint256[](2);
            amounts[uint256(uint128(SDYB_INDEX))] = amount;
            uint256 quote = curvePool.calc_token_amount(amounts, true);
            uint256 minLp = quote * ADD_LIQUIDITY_MIN_BPS / MAX_BPS;
            uint256 beforeLp = lpToken.balanceOf(address(this));
            curvePool.add_liquidity(amounts, minLp);
            lpReceived = lpToken.balanceOf(address(this)) - beforeLp;
            _enforceLpDeviation(lpReceived);
        }
        uint256 sharesBefore = yearnVault.balanceOf(address(this));
        _depositAllLpToYearn();
        uint256 sharesReceived = yearnVault.balanceOf(address(this)) - sharesBefore;
        if (_looseSdYB() != 0 || lpToken.balanceOf(address(this)) != 0) revert PositionOperationFailed();
        if (amount != 0) emit SdYBDeployed(Destination.Yearn, amount, sharesReceived);
    }

    function _depositAllLpToYearn() internal {
        uint256 amount = lpToken.balanceOf(address(this));
        if (amount != 0) yearnVault.deposit(amount, address(this));
    }



    function _realizeRetainedDeploymentLoss() internal {
        uint256 gross = _grossBacking(true);
        if (gross >= retainedSdYBReserve) return;
        uint256 loss = retainedSdYBReserve - gross;
        retainedSdYBReserve = gross;
        retainedSdYBSpentForMigration += loss;
        emit RetainedDeploymentLossRealized(loss, gross);
    }

    function _coverMigrationLoss(uint256 userBackingBefore) internal {
        uint256 userBackingAfter = depositBacking();
        if (userBackingAfter >= userBackingBefore) return;
        uint256 loss = userBackingBefore - userBackingAfter;
        if (loss > _migrationFeeSpendableSdYB()) revert InsufficientRetainedMigrationReserve();
        retainedSdYBReserve -= loss;
        retainedSdYBSpentForMigration += loss;
        if (depositBacking() < userBackingBefore) revert MigrationReducedUserBacking();
        emit RetainedMigrationLossCovered(loss, retainedSdYBReserve);
    }

    function _migrationFeeSpendableSdYB() internal view returns (uint256) {
        uint256 maximumSpend = totalRetainedSdYB * MAX_RETAINED_MIGRATION_SPEND_BPS / MAX_BPS;
        uint256 remaining = maximumSpend > retainedSdYBSpentForMigration
            ? maximumSpend - retainedSdYBSpentForMigration
            : 0;
        return remaining < retainedSdYBReserve ? remaining : retainedSdYBReserve;
    }

    function balanceOf() public view returns (uint256) {
        uint256 gross = _grossBacking(false);
        return gross > retainedSdYBReserve ? gross - retainedSdYBReserve : 0;
    }

    function depositBacking() public view returns (uint256) {
        uint256 gross = _grossBacking(true);
        if (gross < retainedSdYBReserve) revert RetainedReserveExceedsBacking();
        return gross - retainedSdYBReserve;
    }

    function _grossBacking(bool strict) internal view returns (uint256 gross) {
        gross = _looseSdYB();
        gross += _boostHubBacking(strict);
        uint256 lpBacking = lpToken.balanceOf(address(this)) + _yearnUnderlyingLp(strict);
        if (lpBacking != 0) {
            if (strict) return gross + curvePool.calc_withdraw_one_coin(lpBacking, SDYB_INDEX);
            try curvePool.calc_withdraw_one_coin(lpBacking, SDYB_INDEX) returns (uint256 quoted) {
                gross += quoted;
            } catch {}
        }
    }

    function _boostHubBacking(bool strict) internal view returns (uint256 backing) {
        uint256 gaugeBalance;
        if (strict) gaugeBalance = boostHubStaking.balanceOf(address(this));
        else {
            try boostHubStaking.balanceOf(address(this)) returns (uint256 amount) {
                gaugeBalance = amount;
            } catch {
                return 0;
            }
        }
        if (gaugeBalance == 0) return 0;
        uint256 feeBps = _boostWithdrawFeeBps(strict);
        if (feeBps >= MAX_BPS) {
            if (strict) revert InvalidProtection();
            return 0;
        }
        backing = gaugeBalance - gaugeBalance * feeBps / MAX_BPS;
    }

    function _yearnUnderlyingLp(bool strict) internal view returns (uint256 lpAmount) {
        uint256 shares;
        uint256 pps;
        if (strict) {
            shares = yearnVault.balanceOf(address(this));
            if (shares == 0) return 0;
            pps = yearnVault.pricePerShare();
        } else {
            try yearnVault.balanceOf(address(this)) returns (uint256 amount) {
                shares = amount;
            } catch {
                return 0;
            }
            if (shares == 0) return 0;
            try yearnVault.pricePerShare() returns (uint256 value) {
                pps = value;
            } catch {
                return 0;
            }
        }
        lpAmount = shares * pps / WAD;
    }

    function _boostWithdrawFeeBps(bool strict) internal view returns (uint256 feeBps) {
        if (strict) return boostHubStaking.withdraw_fee_bps();
        try boostHubStaking.withdraw_fee_bps() returns (uint256 value) {
            feeBps = value;
        } catch {
            feeBps = MAX_BPS;
        }
    }

    function _quoteLpAsSdYB(uint256 lpAmount) internal view returns (uint256) {
        if (lpAmount == 0) return 0;
        return curvePool.calc_withdraw_one_coin(lpAmount, SDYB_INDEX);
    }

    function _enforceLpDeviation(uint256 lpAmount) internal view {
        if (lpAmount == 0) revert PositionOperationFailed();
        uint256 realizable = _quoteLpAsSdYB(lpAmount);
        uint256 virtualPrice = curvePool.get_virtual_price();
        uint256 oracle = curvePool.price_oracle(0);
        if (virtualPrice == 0 || oracle == 0) revert InvalidProtection();
        uint256 fairValue = lpAmount * virtualPrice / oracle;
        uint256 difference = realizable > fairValue ? realizable - fairValue : fairValue - realizable;
        if (difference * MAX_BPS > fairValue * MAX_ORACLE_DEVIATION_BPS) revert InvalidProtection();
    }

    function _lpNeededForSdYB(uint256 targetSdYB, uint256 maxLp) internal view returns (uint256) {
        if (targetSdYB == 0) return 0;
        uint256 maximumOut = _quoteLpAsSdYB(maxLp);
        if (maximumOut < targetSdYB) return maxLp;

        uint256 low = targetSdYB * maxLp / maximumOut;
        if (low > maxLp) low = maxLp;
        uint256 high = maxLp;
        for (uint256 i; i < 64 && low < high; ++i) {
            uint256 middle = low + (high - low) / 2;
            if (_quoteLpAsSdYB(middle) >= targetSdYB) high = middle;
            else low = middle + 1;
        }
        return high;
    }











    function applyKeeper(address next) external onlyVault active {
        _setKeeperNow(next);
    }

    function applyConverter(address next) external onlyVault active {
        _setConverterNow(next);
    }

    function applyAdminFeeReceiver(address next) external onlyVault active {
        _setAdminFeeReceiverNow(next);
    }

    function retainedTokenState()
        external
        view
        returns (uint256 reserve, uint256 total, uint256 spent, uint256 rescued, uint256 spendable)
    {
        return (
            retainedSdYBReserve,
            totalRetainedSdYB,
            retainedSdYBSpentForMigration,
            retainedSdYBRescued,
            _migrationFeeSpendableSdYB()
        );
    }


    function strategyConfig()
        external
        view
        returns (
            address converterAddress,
            address boostHubStakingAddress,
            address yearnVaultAddress,
            address curvePoolAddress,
            Destination selectedDestination,
            address keeperAddress,
            address adminFeeReceiverAddress
        )
    {
        return (
            address(converter), address(boostHubStaking), address(yearnVault), address(curvePool),
            activeDestination, keeper, adminFeeReceiver
        );
    }
















    function _setKeeperNow(address next) internal {
        address previous = keeper;
        keeper = next;
        emit KeeperSet(previous, next);
    }

    function _validateConverter(address next) internal view {
        if (next == address(0)) revert ZeroAddress();
        IRewardConverterStrategyV27 replacement = IRewardConverterStrategyV27(next);
        if (
            replacement.CRVUSD() != CRVUSD || replacement.YB() != YB
                || replacement.SDYB() != SDYB || replacement.SDYB_YB_POOL() != LP_AND_POOL
        ) revert InvalidIntegration();
    }

    function _setConverterNow(address next) internal {
        _validateConverter(next);
        address previous = address(converter);
        crvUsdToken.forceApprove(previous, 0);
        converter = IRewardConverterStrategyV27(next);
        emit ConverterSet(previous, next);
    }

    function _setAdminFeeReceiverNow(address next) internal {
        if (next == address(0)) revert ZeroAddress();
        address previous = adminFeeReceiver;
        adminFeeReceiver = next;
        emit AdminFeeReceiverSet(previous, next);
    }

    function _giveAllowances() internal {
        sdYbToken.forceApprove(address(boostHubStaking), type(uint256).max);
        sdYbToken.forceApprove(LP_AND_POOL, type(uint256).max);
        lpToken.forceApprove(YEARN_VAULT, type(uint256).max);
    }

    function _revokeAllowances() internal {
        sdYbToken.forceApprove(address(boostHubStaking), 0);
        sdYbToken.forceApprove(LP_AND_POOL, 0);
        lpToken.forceApprove(YEARN_VAULT, 0);
        crvUsdToken.forceApprove(address(converter), 0);
    }

    function _transferAll(IERC20StrategyV27 token, address receiver) internal {
        uint256 amount = token.balanceOf(address(this));
        if (amount != 0) token.safeTransfer(receiver, amount);
    }

    function _looseSdYB() internal view returns (uint256) {
        return sdYbToken.balanceOf(address(this));
    }

    function _otherDestination(Destination destination) internal pure returns (Destination) {
        return destination == Destination.BoostHub ? Destination.Yearn : Destination.BoostHub;
    }

    function _ceilDiv(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        if (numerator == 0) return 0;
        return (numerator - 1) / denominator + 1;
    }


}
