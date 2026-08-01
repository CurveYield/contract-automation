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

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
}

library SafeERC20 {
    error SafeERC20FailedOperation(address token);

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeCall(token.transferFrom, (from, to, value)));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        if (!success || (returndata.length != 0 && !abi.decode(returndata, (bool)))) {
            revert SafeERC20FailedOperation(address(token));
        }
    }
}

library AssetMetadataV27 {
    error ZeroAddress();
    function checkedDecimals(address token) internal view returns (uint8) {
        if (token == address(0)) revert ZeroAddress();
        return IERC20(token).decimals();
    }
}

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable2Step is Context {
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (owner() != _msgSender()) revert OwnableUnauthorizedAccount(_msgSender());
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function pendingOwner() public view returns (address) {
        return _pendingOwner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(_owner, newOwner);
    }

    function acceptOwnership() public {
        address sender = _msgSender();
        if (pendingOwner() != sender) revert OwnableUnauthorizedAccount(sender);
        address oldOwner = _owner;
        _owner = sender;
        delete _pendingOwner;
        emit OwnershipTransferred(oldOwner, sender);
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status = NOT_ENTERED;

    error ReentrancyGuardReentrantCall();

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrancyGuardReentrantCall();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

contract ERC20 is Context, IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name() public view returns (string memory) { return _name; }
    function symbol() public view returns (string memory) { return _symbol; }
    function decimals() public view override returns (uint8) { return _decimals; }
    function totalSupply() public view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }
    function allowance(address owner_, address spender) public view override returns (uint256) { return _allowances[owner_][spender]; }

    function transfer(address to, uint256 value) public override returns (bool) {
        _transfer(_msgSender(), to, value);
        return true;
    }

    function approve(address spender, uint256 value) public override returns (bool) {
        _approve(_msgSender(), spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        uint256 currentAllowance = _allowances[from][_msgSender()];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "ERC20: insufficient allowance");
            unchecked { _approve(from, _msgSender(), currentAllowance - value); }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal virtual {
        require(from != address(0), "ERC20: transfer from zero");
        require(to != address(0), "ERC20: transfer to zero");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "ERC20: transfer exceeds balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address account, uint256 value) internal virtual {
        require(account != address(0), "ERC20: mint to zero");
        _totalSupply += value;
        unchecked { _balances[account] += value; }
        emit Transfer(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal virtual {
        require(account != address(0), "ERC20: burn from zero");
        uint256 accountBalance = _balances[account];
        require(accountBalance >= value, "ERC20: burn exceeds balance");
        unchecked {
            _balances[account] = accountBalance - value;
            _totalSupply -= value;
        }
        emit Transfer(account, address(0), value);
    }

    function _approve(address owner_, address spender, uint256 value) internal virtual {
        require(owner_ != address(0), "ERC20: approve from zero");
        require(spender != address(0), "ERC20: approve to zero");
        _allowances[owner_][spender] = value;
        emit Approval(owner_, spender, value);
    }
}

interface IBoostHubVaultAnalyticsV27 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function withdraw_fee_bps() external view returns (uint256);
    function reward_rate(address token) external view returns (uint256);
    function reward_period_finish(address token) external view returns (uint256);
    function claimable_reward(address account, address token) external view returns (uint256);
}

interface IYearnVaultAnalyticsV27 {
    function balanceOf(address account) external view returns (uint256);
    function pricePerShare() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function performanceFee() external view returns (uint256);
    function managementFee() external view returns (uint256);
    function withdrawalQueue(uint256 index) external view returns (address);
    function strategies(address strategyAddress) external view returns (
        uint256 performanceFeeBps,
        uint256 activation,
        uint256 debtRatioBps,
        uint256 minDebtPerHarvest,
        uint256 maxDebtPerHarvest,
        uint256 lastReport,
        uint256 totalDebt,
        uint256 totalGain,
        uint256 totalLoss
    );
}

interface ICurvePoolVaultAnalyticsV27 {
    function calc_withdraw_one_coin(uint256 lpAmount, int128 index) external view returns (uint256);
}

interface IRewardConverterVaultAnalyticsV27 {
    function CRVUSD() external view returns (address);
    function YB() external view returns (address);
    function SDYB() external view returns (address);
    function SDYB_YB_POOL() external view returns (address);
    function quoteCrvUsdToSdYB(uint256 amount, bool strict) external view returns (uint256);
}

interface ISdYBHybridStrategy {
    function want() external view returns (address);
    function vault() external view returns (address);
    function beforeDeposit() external;
    function beforeWithdraw() external;
    function deposit() external;
    function depositVaultRetained(uint256 totalSdYBAmount, uint256 retainedSdYBAmount) external;
    function withdraw(uint256 amount) external returns (uint256 realizedLoss);
    function finalShareholderWithdraw() external returns (uint256 transferred);
    function harvest() external;
    function balanceOf() external view returns (uint256);
    function depositBacking() external view returns (uint256);
    function strategyConfig() external view returns (
        address converterAddress,
        address boostHubStakingAddress,
        address yearnVaultAddress,
        address curvePoolAddress,
        uint8 selectedDestination,
        address keeperAddress,
        address adminFeeReceiverAddress
    );
    function applyKeeper(address next) external;
    function applyConverter(address next) external;
    function applyAdminFeeReceiver(address next) external;
    function retainedTokenState() external view returns (
        uint256 currentReserveSdYB,
        uint256 totalRetainedSdYB,
        uint256 spentForMigrationSdYB,
        uint256 rescuedSdYB,
        uint256 currentlySpendableForMigrationSdYB
    );
    function retireStrat(address newStrategy) external returns (
        uint256 retainedReserve,
        uint256 totalRetained,
        uint256 spentForMigration,
        uint256 rescued
    );
    function acceptMigrationAccounting(
        uint256 retainedReserve,
        uint256 totalRetained,
        uint256 spentForMigration,
        uint256 rescued
    ) external;
}

contract CurveYieldSdYBHybridVaultV27 is ERC20, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant vaultVersion = "v27";

    IERC20 public immutable want;
    ISdYBHybridStrategy public strategy;
    ISdYBHybridStrategy private pendingStrategy;
    uint256 private pendingStrategyEta;
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant MAX_HARVEST_FEE_BPS = 1_500; // 15%
    uint256 internal constant MAX_WITHDRAW_FEE_BPS = 50; // 0.5%
    uint256 internal constant DEFAULT_WITHDRAW_MIN_BPS = 9_900; // 1% realizable-value tolerance
    uint256 internal constant RETAINED_REWARD_BPS = 400;
    uint256 internal constant FEE_CHANGE_DELAY = 3 days;
    uint256 internal constant STRATEGY_CHANGE_DELAY = 3 days;
    uint256 internal constant INITIAL_SETUP_WINDOW = 3 days;
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant DEFAULT_COMPOUNDS_PER_YEAR = 365;
    uint256 internal constant MAX_YEARN_STRATEGIES = 20;
    int128 internal constant SDYB_INDEX = 1;

    uint256 private immutable deployedAt;
    uint256 public harvestFeeBps;
    uint256 private withdrawFeeBps;
    address private feeRecipient;
    uint256 private accountedVaultWantBalance;

    uint256 private pendingHarvestFeeBps;
    uint256 private pendingWithdrawFeeBps;
    address private pendingFeeRecipient;
    uint256 private pendingFeeEta;

    struct AnalyticsConfig {
        address converter;
        address boostHub;
        address yearn;
        address curvePool;
    }

    struct PendingAddressChange {
        address value;
        address targetStrategy;
        uint256 readyAt;
    }

    PendingAddressChange private pendingKeeper;
    PendingAddressChange private pendingConverter;
    PendingAddressChange private pendingAdminFeeReceiver;

    struct WithdrawalState {
        uint256 supplyBefore;
        uint256 assetsBefore;
        uint256 grossEntitlement;
        uint256 available;
        uint256 feeAmount;
        uint256 retainedFeeAmount;
        uint256 ppsContributionAmount;
        uint256 userAmount;
    }

    event Deposit(address indexed user, uint256 wantAmount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 wantAmount, uint256 sharesBurned);
    event Earn(uint256 wantAmount);
    event StrategySet(address indexed strategy);
    event StrategyChangeQueued(address indexed strategy, uint256 eta);
    event StrategyChangeCancelled(address indexed strategy);
    event StrategyChanged(address indexed oldStrategy, address indexed newStrategy);
    event FeeConfigQueued(uint256 harvestFeeBps, uint256 withdrawFeeBps, address indexed feeRecipient, uint256 eta);
    event FeeConfigSet(uint256 harvestFeeBps, uint256 withdrawFeeBps, address indexed feeRecipient);
    event FeeConfigCancelled();
    event KeeperChangeQueued(address indexed strategyAddress, address indexed next, uint256 readyAt);
    event KeeperChangeCancelled(address indexed strategyAddress, address indexed cancelled);
    event ConverterChangeQueued(address indexed strategyAddress, address indexed next, uint256 readyAt);
    event ConverterChangeCancelled(address indexed strategyAddress, address indexed cancelled);
    event AdminFeeReceiverChangeQueued(address indexed strategyAddress, address indexed next, uint256 readyAt);
    event AdminFeeReceiverChangeCancelled(address indexed strategyAddress, address indexed cancelled);
    event WithdrawFeeSplit(
        address indexed user,
        uint256 totalFeeAmount,
        uint256 retainedFeeAmount,
        uint256 ppsContributionAmount
    );
    event DonationDeployed(address indexed strategy, uint256 donationAmount);
    event FinalWithdrawalFeePaid(address indexed receiver, uint256 amount);
    event PreDepositRewardCheckpointFailed();
    event PreWithdrawHarvestFailed();
    event RewardSettlementSkipped(address indexed user, uint256 shares);

    error ZeroAddress();
    error StrategyAlreadySet();
    error InvalidStrategy();
    error StrategyChangeNotReady();
    error ZeroShares();
    error InsufficientShares();
    error FeeTooHigh();
    error FeeChangeNotReady();
    error StrategyRequiredForRetainedCapital();
    error TransactionLossExceedsUserValue();
    error PricePerShareDecreased();
    error InsolventVault();
    error MinAssetsOutNotMet(uint256 assetsOut, uint256 minAssetsOut);
    error DeadlineExpired(uint256 deadline, uint256 currentTimestamp);
    error FinalBackingNotCleared();
    error RewardCheckpointUnavailable();
    error RewardCheckpointIncomplete(uint256 unresolvedFairValue);
    error PendingChangeExists();
    error PendingChangeNotReady();
    error NoPendingChange();
    error StrategyConfigTargetChanged();
    error InvalidCompoundingFrequency();

    constructor(
        address want_,
        string memory name_,
        address owner_
    ) ERC20(name_, "cysdYB-HV", AssetMetadataV27.checkedDecimals(want_)) Ownable2Step(owner_) {
        want = IERC20(want_);
        deployedAt = block.timestamp;
        feeRecipient = owner_;
    }

    function setStrategy(address strategy_) external onlyOwner nonReentrant {
        if (address(strategy) != address(0)) revert StrategyAlreadySet();
        _validateStrategy(strategy_);
        strategy = ISdYBHybridStrategy(strategy_);
        _syncLooseDonations();
        _syncAccountedBalance();
        emit StrategySet(strategy_);
    }

    function queueStrategyChange(address strategy_) external onlyOwner {
        _validateStrategy(strategy_);
        pendingStrategy = ISdYBHybridStrategy(strategy_);
        pendingStrategyEta = block.timestamp < deployedAt + INITIAL_SETUP_WINDOW
            ? block.timestamp
            : block.timestamp + STRATEGY_CHANGE_DELAY;
        emit StrategyChangeQueued(strategy_, pendingStrategyEta);
    }

    function executeStrategyChange() external onlyOwner nonReentrant {
        ISdYBHybridStrategy newStrategy = pendingStrategy;
        if (address(newStrategy) == address(0) || block.timestamp < pendingStrategyEta) revert StrategyChangeNotReady();
        _validateStrategy(address(newStrategy));

        _syncLooseDonations();
        uint256 assetsBeforeMigration = _depositBacking();

        ISdYBHybridStrategy oldStrategy = strategy;
        if (address(oldStrategy) != address(0)) {
            (
                uint256 retainedReserve,
                uint256 totalRetained,
                uint256 spentForMigration,
                uint256 rescued
            ) = oldStrategy.retireStrat(address(newStrategy));
            newStrategy.acceptMigrationAccounting(retainedReserve, totalRetained, spentForMigration, rescued);
        }

        strategy = newStrategy;
        delete pendingStrategy;
        pendingStrategyEta = 0;

        newStrategy.deposit();
        if (_depositBacking() < assetsBeforeMigration) revert PricePerShareDecreased();
        _syncAccountedBalance();
        emit StrategyChanged(address(oldStrategy), address(newStrategy));
    }


    function cancelStrategyChange() external onlyOwner {
        address strategy_ = address(pendingStrategy);
        delete pendingStrategy;
        pendingStrategyEta = 0;
        emit StrategyChangeCancelled(strategy_);
    }

    function _validateStrategy(address strategy_) internal view {
        if (strategy_ == address(0)) revert ZeroAddress();
        if (ISdYBHybridStrategy(strategy_).want() != address(want)) revert InvalidStrategy();
        if (ISdYBHybridStrategy(strategy_).vault() != address(this)) revert InvalidStrategy();
    }

    function setFeeConfig(uint256 newHarvestFeeBps, uint256 newWithdrawFeeBps, address newFeeRecipient) external onlyOwner {
        _validateFeeConfig(newHarvestFeeBps, newWithdrawFeeBps, newFeeRecipient);
        if (block.timestamp < deployedAt + INITIAL_SETUP_WINDOW) {
            _setFeeConfigNow(newHarvestFeeBps, newWithdrawFeeBps, newFeeRecipient);
            return;
        }
        pendingHarvestFeeBps = newHarvestFeeBps;
        pendingWithdrawFeeBps = newWithdrawFeeBps;
        pendingFeeRecipient = newFeeRecipient;
        pendingFeeEta = block.timestamp + FEE_CHANGE_DELAY;
        emit FeeConfigQueued(newHarvestFeeBps, newWithdrawFeeBps, newFeeRecipient, pendingFeeEta);
    }

    function executeFeeConfigChange() external onlyOwner {
        if (pendingFeeRecipient == address(0) || block.timestamp < pendingFeeEta) revert FeeChangeNotReady();
        _setFeeConfigNow(pendingHarvestFeeBps, pendingWithdrawFeeBps, pendingFeeRecipient);
        _clearPendingFeeConfig();
    }

    function cancelFeeConfigChange() external onlyOwner {
        _clearPendingFeeConfig();
        emit FeeConfigCancelled();
    }

    function setKeeper(address next) external onlyOwner {
        ISdYBHybridStrategy strat = _configuredStrategy();
        if (block.timestamp < deployedAt + INITIAL_SETUP_WINDOW) {
            strat.applyKeeper(next);
            return;
        }
        uint256 readyAt = _queueAddressChange(pendingKeeper, next, address(strat));
        emit KeeperChangeQueued(address(strat), next, readyAt);
    }

    function executeKeeperChange() external {
        (ISdYBHybridStrategy strat, address next) = _consumeAddressChange(pendingKeeper);
        strat.applyKeeper(next);
    }

    function cancelKeeperChange() external onlyOwner {
        (address target, address cancelled) = _cancelAddressChange(pendingKeeper);
        emit KeeperChangeCancelled(target, cancelled);
    }

    function pendingKeeperChange() external view returns (address next, uint256 readyAt) {
        return (pendingKeeper.value, pendingKeeper.readyAt);
    }

    function setConverter(address next) external onlyOwner {
        ISdYBHybridStrategy strat = _configuredStrategy();
        _validateConverterForStrategy(strat, next);
        if (block.timestamp < deployedAt + INITIAL_SETUP_WINDOW) {
            strat.applyConverter(next);
            return;
        }
        uint256 readyAt = _queueAddressChange(pendingConverter, next, address(strat));
        emit ConverterChangeQueued(address(strat), next, readyAt);
    }

    function executeConverterChange() external {
        (ISdYBHybridStrategy strat, address next) = _consumeAddressChange(pendingConverter);
        strat.applyConverter(next);
    }

    function cancelConverterChange() external onlyOwner {
        (address target, address cancelled) = _cancelAddressChange(pendingConverter);
        emit ConverterChangeCancelled(target, cancelled);
    }

    function pendingConverterChange() external view returns (address next, uint256 readyAt) {
        return (pendingConverter.value, pendingConverter.readyAt);
    }

    function setAdminFeeReceiver(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        ISdYBHybridStrategy strat = _configuredStrategy();
        if (block.timestamp < deployedAt + INITIAL_SETUP_WINDOW) {
            strat.applyAdminFeeReceiver(next);
            return;
        }
        uint256 readyAt = _queueAddressChange(pendingAdminFeeReceiver, next, address(strat));
        emit AdminFeeReceiverChangeQueued(address(strat), next, readyAt);
    }

    function executeAdminFeeReceiverChange() external {
        (ISdYBHybridStrategy strat, address next) = _consumeAddressChange(pendingAdminFeeReceiver);
        strat.applyAdminFeeReceiver(next);
    }

    function cancelAdminFeeReceiverChange() external onlyOwner {
        (address target, address cancelled) = _cancelAddressChange(pendingAdminFeeReceiver);
        emit AdminFeeReceiverChangeCancelled(target, cancelled);
    }

    function pendingAdminFeeReceiverChange() external view returns (address next, uint256 readyAt) {
        return (pendingAdminFeeReceiver.value, pendingAdminFeeReceiver.readyAt);
    }


    function deposit(uint256 amount) external nonReentrant {
        _deposit(amount, _msgSender(), false);
    }

    function depositAll() external nonReentrant {
        _deposit(want.balanceOf(_msgSender()), _msgSender(), false);
    }

    function depositProtected(uint256 amount) external nonReentrant {
        _deposit(amount, _msgSender(), true);
    }

    function depositAllProtected() external nonReentrant {
        _deposit(want.balanceOf(_msgSender()), _msgSender(), true);
    }

    function _deposit(uint256 amount, address receiver, bool requireRewardPricing) internal {
        require(amount != 0, "amount=0");
        _syncLooseDonations();
        ISdYBHybridStrategy strat = strategy;
        uint256 supplyBefore = totalSupply();
        uint256 pendingNetValue;
        if (address(strat) != address(0) && supplyBefore != 0) {
            uint256 assetsBeforeHarvest = _depositBacking();
            if (requireRewardPricing) {
                strat.beforeDeposit();
            } else {
                try strat.beforeDeposit() {} catch { emit PreDepositRewardCheckpointFailed(); }
            }
            if (_depositBacking() < assetsBeforeHarvest) revert PricePerShareDecreased();

            (bool priced, uint256 fairValue) = _tryPendingYieldValue();
            if (!priced) {
                if (requireRewardPricing) revert RewardCheckpointUnavailable();
                emit PreDepositRewardCheckpointFailed();
            } else {
                pendingNetValue = _netPendingRewardValue(fairValue);
            }
        }

        uint256 assetsBefore = _depositBacking();
        if (supplyBefore != 0 && assetsBefore == 0) revert InsolventVault();
        uint256 pricingAssetsBefore = assetsBefore + pendingNetValue;

        want.safeTransferFrom(_msgSender(), address(this), amount);
        _earn();
        uint256 assetsAfter = _depositBacking();
        if (assetsAfter <= assetsBefore) revert ZeroShares();
        uint256 netAssetsAdded = assetsAfter - assetsBefore;

        uint256 shares = supplyBefore == 0
            ? netAssetsAdded
            : netAssetsAdded * supplyBefore / pricingAssetsBefore;
        if (shares == 0) revert ZeroShares();

        _mint(receiver, shares);
        _requirePpsNotDecreased(
            pricingAssetsBefore,
            supplyBefore,
            assetsAfter + pendingNetValue,
            supplyBefore + shares
        );
        _syncAccountedBalance();
        emit Deposit(receiver, netAssetsAdded, shares);
    }

    function _tryPendingYieldValue() internal view returns (bool available, uint256 value) {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) return (true, 0);
        try this.pendingYield() returns (uint256, uint256 pendingSdYBValue) {
            return (true, pendingSdYBValue);
        } catch {
            return (false, 0);
        }
    }

    function _netPendingRewardValue(uint256 fairValue) internal view returns (uint256) {
        uint256 netValue = fairValue * (BPS_DENOMINATOR - harvestFeeBps) / BPS_DENOMINATOR;
        return netValue * (BPS_DENOMINATOR - RETAINED_REWARD_BPS) / BPS_DENOMINATOR;
    }

    function _checkpointAllRewardsStrict(ISdYBHybridStrategy strat) internal {
        (bool available, uint256 fairValue) = _tryPendingYieldValue();
        if (!available) revert RewardCheckpointUnavailable();
        if (fairValue == 0) return;
        strat.harvest();
        (available, fairValue) = _tryPendingYieldValue();
        if (!available) revert RewardCheckpointUnavailable();
        if (fairValue != 0) revert RewardCheckpointIncomplete(fairValue);
    }

    function _checkpointAllRewardsBestEffort(ISdYBHybridStrategy strat, uint256 shares) internal {
        (bool available, uint256 fairValue) = _tryPendingYieldValue();
        if (!available) {
            emit RewardSettlementSkipped(_msgSender(), shares);
            return;
        }
        if (fairValue == 0) return;
        try strat.harvest() {} catch {
            emit RewardSettlementSkipped(_msgSender(), shares);
            return;
        }
        (available, fairValue) = _tryPendingYieldValue();
        if (!available || fairValue != 0) emit RewardSettlementSkipped(_msgSender(), shares);
    }

    function earn() public nonReentrant {
        _syncLooseDonations();
        uint256 assetsBefore = _depositBacking();
        _earn();
        uint256 assetsAfter = _depositBacking();
        if (assetsAfter < assetsBefore) revert PricePerShareDecreased();
        _syncAccountedBalance();
    }

    function _earn() internal {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) {
            _syncAccountedLooseWant();
            return;
        }
        uint256 bal = _deployableAvailable();
        if (bal != 0) {
            want.safeTransfer(address(strat), bal);
            strat.deposit();
            emit Earn(bal);
        }
        _syncAccountedLooseWant();
    }

    function withdraw(uint256 shares) public nonReentrant {
        _withdraw(shares, 0, type(uint256).max, true, false);
    }

    function withdraw(uint256 shares, uint256 minAssetsOut) public nonReentrant {
        _withdraw(shares, minAssetsOut, type(uint256).max, false, false);
    }

    function withdraw(uint256 shares, uint256 minAssetsOut, uint256 deadline) public nonReentrant {
        _withdraw(shares, minAssetsOut, deadline, false, false);
    }

    function withdrawProtected(uint256 shares, uint256 minAssetsOut, uint256 deadline) external nonReentrant {
        _withdraw(shares, minAssetsOut, deadline, false, true);
    }

    function _withdraw(
        uint256 shares, uint256 minAssetsOut, uint256 deadline, bool useDefaultMin, bool requireCheckpoint
    ) internal {
        if (block.timestamp > deadline) revert DeadlineExpired(deadline, block.timestamp);
        if (shares == 0) revert ZeroShares();
        if (shares > balanceOf(_msgSender())) revert InsufficientShares();

        uint256 supplySnapshot = totalSupply();
        bool finalWithdrawal = shares == supplySnapshot;
        _syncLooseDonations();
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) != address(0)) {
            if (requireCheckpoint) {
                _checkpointAllRewardsStrict(strat);
            } else if (finalWithdrawal) {
                _checkpointAllRewardsBestEffort(strat, shares);
            } else {
                try strat.beforeWithdraw() {} catch { emit PreWithdrawHarvestFailed(); }
            }
        }
        WithdrawalState memory state;
        state.assetsBefore = _depositBacking();
        state.supplyBefore = totalSupply();
        if (useDefaultMin) {
            minAssetsOut = _defaultMinAssetsOut(shares, state.assetsBefore, state.supplyBefore);
        }
        if (shares == state.supplyBefore) {
            _finalWithdraw(shares, minAssetsOut, state.assetsBefore);
            return;
        }

        state.grossEntitlement = state.assetsBefore * shares / state.supplyBefore;
        state.available = _pullAssets(state.grossEntitlement);
        state.feeAmount = state.available * withdrawFeeBps / BPS_DENOMINATOR;
        state.retainedFeeAmount = state.feeAmount / 2;
        state.ppsContributionAmount = state.feeAmount - state.retainedFeeAmount;
        state.userAmount = state.available - state.feeAmount;
        if (state.userAmount == 0 || state.userAmount < minAssetsOut) {
            revert MinAssetsOutNotMet(state.userAmount, minAssetsOut);
        }

        _burn(_msgSender(), shares);
        if (state.feeAmount != 0) {
            if (address(strat) == address(0)) revert StrategyRequiredForRetainedCapital();
            want.safeTransfer(address(strat), state.feeAmount);
            strat.depositVaultRetained(state.feeAmount, state.retainedFeeAmount);
            emit WithdrawFeeSplit(
                _msgSender(), state.feeAmount, state.retainedFeeAmount, state.ppsContributionAmount
            );
        }
        want.safeTransfer(_msgSender(), state.userAmount);
        _requirePpsNotDecreased(
            state.assetsBefore, state.supplyBefore, _depositBacking(), state.supplyBefore - shares
        );
        _syncAccountedBalance();
        emit Withdraw(_msgSender(), state.userAmount, shares);
    }

    function _finalWithdraw(uint256 shares, uint256 minAssetsOut, uint256 accountingEntitlement) internal {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) != address(0)) strat.finalShareholderWithdraw();

        uint256 available = _deployableAvailable();
        uint256 lossAdjustedEntitlement = available < accountingEntitlement ? available : accountingEntitlement;
        uint256 executionSurplus = available > accountingEntitlement ? available - accountingEntitlement : 0;
        uint256 feeAmount = lossAdjustedEntitlement * withdrawFeeBps / BPS_DENOMINATOR;
        uint256 userAmount = lossAdjustedEntitlement - feeAmount + executionSurplus;
        if (userAmount == 0 || userAmount < minAssetsOut) revert MinAssetsOutNotMet(userAmount, minAssetsOut);

        if (feeAmount != 0) {
            want.safeTransfer(feeRecipient, feeAmount);
            emit FinalWithdrawalFeePaid(feeRecipient, feeAmount);
        }
        if (feeAmount != 0) emit WithdrawFeeSplit(_msgSender(), feeAmount, 0, feeAmount);
        want.safeTransfer(_msgSender(), userAmount);
        if (
            want.balanceOf(address(this)) != 0 || _deployableAvailable() != 0
                || (address(strat) != address(0) && strat.depositBacking() != 0)
        ) revert FinalBackingNotCleared();
        _burn(_msgSender(), shares);
        _syncAccountedBalance();
        emit Withdraw(_msgSender(), userAmount, shares);
    }

    function _pullAssets(uint256 grossEntitlement) internal returns (uint256 availableToUser) {
        uint256 looseBefore = _deployableAvailable();
        uint256 realizedLoss;
        if (looseBefore < grossEntitlement) {
            realizedLoss = strategy.withdraw(grossEntitlement - looseBefore);
        }
        if (realizedLoss > grossEntitlement) revert TransactionLossExceedsUserValue();
        availableToUser = _deployableAvailable();
        uint256 lossAdjustedEntitlement = grossEntitlement - realizedLoss;
        if (availableToUser > lossAdjustedEntitlement) availableToUser = lossAdjustedEntitlement;
    }

    function withdrawAll() external nonReentrant {
        _withdraw(balanceOf(_msgSender()), 0, type(uint256).max, true, false);
    }

    function withdrawAll(uint256 minAssetsOut) external nonReentrant {
        _withdraw(balanceOf(_msgSender()), minAssetsOut, type(uint256).max, false, false);
    }

    function withdrawAll(uint256 minAssetsOut, uint256 deadline) external nonReentrant {
        _withdraw(balanceOf(_msgSender()), minAssetsOut, deadline, false, false);
    }

    function withdrawAllProtected(uint256 minAssetsOut, uint256 deadline) external nonReentrant {
        _withdraw(balanceOf(_msgSender()), minAssetsOut, deadline, false, true);
    }

    function _defaultMinAssetsOut(uint256 shares, uint256 assets, uint256 supply) internal view returns (uint256) {
        if (shares == 0) return 0;
        uint256 gross = assets * shares / supply;
        uint256 net = gross - gross * withdrawFeeBps / BPS_DENOMINATOR;
        return net * DEFAULT_WITHDRAW_MIN_BPS / BPS_DENOMINATOR;
    }

    function harvest() external nonReentrant {
        _syncLooseDonations();
        strategy.harvest();
        _syncAccountedLooseWant();
    }

    function balance() public view returns (uint256) {
        ISdYBHybridStrategy strat = strategy;
        return _deployableAvailable() + (address(strat) == address(0) ? 0 : strat.balanceOf());
    }

    function depositBacking() public view returns (uint256) {
        return _depositBacking();
    }

    function _depositBacking() internal view returns (uint256) {
        ISdYBHybridStrategy strat = strategy;
        return _deployableAvailable() + (address(strat) == address(0) ? 0 : strat.depositBacking());
    }

    function _deployableAvailable() internal view returns (uint256) {
        return want.balanceOf(address(this));
    }

    function syncDonations() external nonReentrant returns (uint256 donationAmount) {
        donationAmount = _syncLooseDonations();
        _syncAccountedLooseWant();
    }

    function vaultConfig()
        external
        view
        returns (
            uint256 deployedTimestamp,
            uint256 currentHarvestFeeBps,
            uint256 currentWithdrawFeeBps,
            address currentFeeRecipient,
            uint256 maxHarvestFeeBps,
            uint256 maxWithdrawFeeBps,
            uint256 feeChangeDelay,
            uint256 strategyChangeDelay,
            uint256 initialSetupWindow
        )
    {
        return (
            deployedAt, harvestFeeBps, withdrawFeeBps, feeRecipient, MAX_HARVEST_FEE_BPS,
            MAX_WITHDRAW_FEE_BPS, FEE_CHANGE_DELAY, STRATEGY_CHANGE_DELAY, INITIAL_SETUP_WINDOW
        );
    }

    function vaultMetrics()
        external
        view
        returns (
            uint256 shareholderBackingSdYB,
            uint256 shareSupply,
            uint256 pricePerShare,
            uint256 retainedYieldBoostingSdYB
        )
    {
        ISdYBHybridStrategy strat = strategy;
        shareholderBackingSdYB = balance();
        shareSupply = totalSupply();
        pricePerShare = shareSupply == 0 ? 1e18 : shareholderBackingSdYB * 1e18 / shareSupply;
        if (address(strat) != address(0)) {
            (retainedYieldBoostingSdYB,,,,) = strat.retainedTokenState();
        }
    }

    function pendingYield() external view returns (uint256 pendingCrvUsd, uint256 pendingSdYBValue) {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) return (0, 0);
        return _pendingYield(strat);
    }

    function _pendingYield(ISdYBHybridStrategy strat)
        internal
        view
        returns (uint256 pendingCrvUsd, uint256 pendingSdYBValue)
    {
        AnalyticsConfig memory config = _analyticsConfig(strat);
        IRewardConverterVaultAnalyticsV27 converter = IRewardConverterVaultAnalyticsV27(config.converter);
        address crvUsd = converter.CRVUSD();
        pendingCrvUsd = IERC20(crvUsd).balanceOf(address(strat));
        try IBoostHubVaultAnalyticsV27(config.boostHub).claimable_reward(address(strat), crvUsd) returns (uint256 claimable) {
            pendingCrvUsd += claimable;
        } catch {}
        if (pendingCrvUsd != 0) {
            try converter.quoteCrvUsdToSdYB(pendingCrvUsd, false) returns (uint256 quoted) {
                pendingSdYBValue = quoted;
            } catch {}
        }
    }

    function yieldMetrics()
        external
        view
        returns (
            uint256 boostHubAprBps,
            uint256 yearnAprBps,
            uint256 grossVaultAprBps,
            uint256 netVaultAprBps,
            uint256 projectedVaultApyBps,
            uint256 boostHubBackingSdYB,
            uint256 yearnBackingSdYB,
            uint256 shareholderBackingSdYB,
            uint256 retainedYieldBoostingSdYB
        )
    {
        return _yieldMetrics();
    }

    function vaultApyBps() external view returns (uint256) {
        (,,,, uint256 projectedVaultApyBps,,,,) = _yieldMetrics();
        return projectedVaultApyBps;
    }

    function aprToApyBps(uint256 aprBps, uint256 compoundsPerYear) public pure returns (uint256) {
        if (compoundsPerYear == 0) revert InvalidCompoundingFrequency();
        if (aprBps == 0) return 0;
        uint256 annualRateWad = aprBps * 1e14;
        uint256 periodRateWad = annualRateWad / compoundsPerYear;
        uint256 growthWad = _rpow(WAD + periodRateWad, compoundsPerYear, WAD);
        return (growthWad - WAD) / 1e14;
    }

    function _yieldMetrics()
        internal
        view
        returns (
            uint256 boostHubAprBps,
            uint256 yearnAprBps,
            uint256 grossVaultAprBps,
            uint256 netVaultAprBps,
            uint256 projectedVaultApyBps,
            uint256 boostHubBackingSdYB,
            uint256 yearnBackingSdYB,
            uint256 shareholderBackingSdYB,
            uint256 retainedYieldBoostingSdYB
        )
    {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) return (0, 0, 0, 0, 0, 0, 0, 0, 0);
        AnalyticsConfig memory config = _analyticsConfig(strat);
        boostHubBackingSdYB = _boostHubBacking(config.boostHub, address(strat));
        uint256 yearnLp = _yearnUnderlyingLp(config.yearn, address(strat));
        if (yearnLp != 0) {
            try ICurvePoolVaultAnalyticsV27(config.curvePool).calc_withdraw_one_coin(yearnLp, SDYB_INDEX)
                returns (uint256 quoted)
            {
                yearnBackingSdYB = quoted;
            } catch {}
        }
        shareholderBackingSdYB = strat.balanceOf();
        (retainedYieldBoostingSdYB,,,,) = strat.retainedTokenState();
        boostHubAprBps = _boostHubAprBps(config.boostHub, config.converter);
        yearnAprBps = _yearnAprBps(config.yearn);
        if (shareholderBackingSdYB != 0) {
            grossVaultAprBps =
                (boostHubBackingSdYB * boostHubAprBps + yearnBackingSdYB * yearnAprBps)
                / shareholderBackingSdYB;
        }
        netVaultAprBps = grossVaultAprBps * (BPS_DENOMINATOR - harvestFeeBps) / BPS_DENOMINATOR;
        netVaultAprBps = netVaultAprBps * (BPS_DENOMINATOR - RETAINED_REWARD_BPS) / BPS_DENOMINATOR;
        projectedVaultApyBps = aprToApyBps(netVaultAprBps, DEFAULT_COMPOUNDS_PER_YEAR);
    }

    function _analyticsConfig(ISdYBHybridStrategy strat) internal view returns (AnalyticsConfig memory config) {
        (config.converter, config.boostHub, config.yearn, config.curvePool,,,) = strat.strategyConfig();
    }

    function _boostHubBacking(address boostHubAddress, address strategyAddress)
        internal
        view
        returns (uint256 backing)
    {
        IBoostHubVaultAnalyticsV27 boostHub = IBoostHubVaultAnalyticsV27(boostHubAddress);
        uint256 gaugeBalance;
        try boostHub.balanceOf(strategyAddress) returns (uint256 amount) { gaugeBalance = amount; } catch { return 0; }
        if (gaugeBalance == 0) return 0;
        uint256 feeBps = _boostWithdrawFeeBps(boostHub);
        if (feeBps >= BPS_DENOMINATOR) return 0;
        backing = gaugeBalance - gaugeBalance * feeBps / BPS_DENOMINATOR;
    }

    function _yearnUnderlyingLp(address yearnAddress, address strategyAddress)
        internal
        view
        returns (uint256 lpAmount)
    {
        IYearnVaultAnalyticsV27 yearn = IYearnVaultAnalyticsV27(yearnAddress);
        uint256 shares;
        uint256 pps;
        try yearn.balanceOf(strategyAddress) returns (uint256 amount) { shares = amount; } catch { return 0; }
        if (shares == 0) return 0;
        try yearn.pricePerShare() returns (uint256 value) { pps = value; } catch { return 0; }
        lpAmount = shares * pps / WAD;
    }

    function _boostWithdrawFeeBps(IBoostHubVaultAnalyticsV27 boostHub) internal view returns (uint256 feeBps) {
        try boostHub.withdraw_fee_bps() returns (uint256 value) { feeBps = value; }
        catch { feeBps = BPS_DENOMINATOR; }
    }

    function _boostHubAprBps(address boostHubAddress, address converterAddress) internal view returns (uint256) {
        IBoostHubVaultAnalyticsV27 boostHub = IBoostHubVaultAnalyticsV27(boostHubAddress);
        IRewardConverterVaultAnalyticsV27 converter = IRewardConverterVaultAnalyticsV27(converterAddress);
        address crvUsd = converter.CRVUSD();
        uint256 finish;
        try boostHub.reward_period_finish(crvUsd) returns (uint256 value) { finish = value; } catch { return 0; }
        if (finish <= block.timestamp) return 0;
        uint256 rate;
        uint256 supply;
        try boostHub.reward_rate(crvUsd) returns (uint256 value) { rate = value; } catch { return 0; }
        try boostHub.totalSupply() returns (uint256 value) { supply = value; } catch { return 0; }
        if (rate == 0 || supply == 0) return 0;
        uint256 annualRewardSdYB;
        try converter.quoteCrvUsdToSdYB(rate * SECONDS_PER_YEAR, false) returns (uint256 quoted) {
            annualRewardSdYB = quoted;
        } catch { return 0; }
        uint256 feeBps = _boostWithdrawFeeBps(boostHub);
        if (feeBps >= BPS_DENOMINATOR) return 0;
        uint256 realizableSupply = supply - supply * feeBps / BPS_DENOMINATOR;
        return realizableSupply == 0 ? 0 : annualRewardSdYB * BPS_DENOMINATOR / realizableSupply;
    }

    function _yearnAprBps(address yearnAddress) internal view returns (uint256) {
        IYearnVaultAnalyticsV27 yearn = IYearnVaultAnalyticsV27(yearnAddress);
        uint256 assets;
        try yearn.totalAssets() returns (uint256 value) { assets = value; } catch { return 0; }
        if (assets == 0) return 0;
        uint256 vaultPerformanceFee;
        uint256 managementFee;
        try yearn.performanceFee() returns (uint256 value) { vaultPerformanceFee = _capBps(value); } catch {}
        try yearn.managementFee() returns (uint256 value) { managementFee = _capBps(value); } catch {}
        uint256 annualGainsAfterFees;
        uint256 annualLosses;
        for (uint256 i; i < MAX_YEARN_STRATEGIES; ++i) {
            address strategyAddress;
            try yearn.withdrawalQueue(i) returns (address value) { strategyAddress = value; } catch { break; }
            if (strategyAddress == address(0)) break;
            try yearn.strategies(strategyAddress) returns (
                uint256 strategyPerformanceFee,
                uint256 activation,
                uint256,
                uint256,
                uint256,
                uint256 lastReport,
                uint256,
                uint256 totalGain,
                uint256 totalLoss
            ) {
                if (activation == 0 || lastReport <= activation) continue;
                uint256 duration = lastReport - activation;
                uint256 annualGain = totalGain * SECONDS_PER_YEAR / duration;
                uint256 annualLoss = totalLoss * SECONDS_PER_YEAR / duration;
                uint256 combinedPerformanceFee = _capBps(vaultPerformanceFee + strategyPerformanceFee);
                annualGainsAfterFees += annualGain * (BPS_DENOMINATOR - combinedPerformanceFee) / BPS_DENOMINATOR;
                annualLosses += annualLoss;
            } catch {}
        }
        if (annualGainsAfterFees <= annualLosses) return 0;
        uint256 annualNet = annualGainsAfterFees - annualLosses;
        uint256 annualManagementFee = assets * managementFee / BPS_DENOMINATOR;
        if (annualNet <= annualManagementFee) return 0;
        return (annualNet - annualManagementFee) * BPS_DENOMINATOR / assets;
    }

    function _rpow(uint256 x, uint256 n, uint256 scalar) internal pure returns (uint256 z) {
        z = n % 2 == 0 ? scalar : x;
        for (n /= 2; n != 0; n /= 2) {
            x = x * x / scalar;
            if (n % 2 != 0) z = z * x / scalar;
        }
    }

    function _capBps(uint256 value) internal pure returns (uint256) {
        return value > BPS_DENOMINATOR ? BPS_DENOMINATOR : value;
    }

    function retainedTokenState()
        external
        view
        returns (
            uint256 currentReserveSdYB,
            uint256 totalRetainedSdYB,
            uint256 spentForMigrationSdYB,
            uint256 rescuedSdYB,
            uint256 currentlySpendableForMigrationSdYB
        )
    {
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) return (0, 0, 0, 0, 0);
        return strat.retainedTokenState();
    }

    function _configuredStrategy() internal view returns (ISdYBHybridStrategy strat) {
        strat = strategy;
        if (address(strat) == address(0)) revert InvalidStrategy();
    }

    function _queueAddressChange(
        PendingAddressChange storage pending,
        address next,
        address targetStrategy
    ) internal returns (uint256 readyAt) {
        if (pending.readyAt != 0) revert PendingChangeExists();
        readyAt = block.timestamp + STRATEGY_CHANGE_DELAY;
        pending.value = next;
        pending.targetStrategy = targetStrategy;
        pending.readyAt = readyAt;
    }

    function _consumeAddressChange(PendingAddressChange storage pending)
        internal
        returns (ISdYBHybridStrategy strat, address next)
    {
        uint256 readyAt = pending.readyAt;
        if (readyAt == 0 || block.timestamp < readyAt) revert PendingChangeNotReady();
        if (pending.targetStrategy != address(strategy)) revert StrategyConfigTargetChanged();
        strat = strategy;
        next = pending.value;
        delete pending.value;
        delete pending.targetStrategy;
        delete pending.readyAt;
    }

    function _cancelAddressChange(PendingAddressChange storage pending)
        internal
        returns (address target, address cancelled)
    {
        if (pending.readyAt == 0) revert NoPendingChange();
        target = pending.targetStrategy;
        cancelled = pending.value;
        delete pending.value;
        delete pending.targetStrategy;
        delete pending.readyAt;
    }

    function _validateConverterForStrategy(ISdYBHybridStrategy strat, address next) internal view {
        if (next == address(0)) revert ZeroAddress();
        (address currentConverter,,,,,,) = strat.strategyConfig();
        IRewardConverterVaultAnalyticsV27 current = IRewardConverterVaultAnalyticsV27(currentConverter);
        IRewardConverterVaultAnalyticsV27 replacement = IRewardConverterVaultAnalyticsV27(next);
        if (
            replacement.CRVUSD() != current.CRVUSD() || replacement.YB() != current.YB()
                || replacement.SDYB() != current.SDYB()
                || replacement.SDYB_YB_POOL() != current.SDYB_YB_POOL()
        ) revert InvalidStrategy();
    }

    function _setFeeConfigNow(uint256 newHarvestFeeBps, uint256 newWithdrawFeeBps, address newFeeRecipient) internal {
        harvestFeeBps = newHarvestFeeBps;
        withdrawFeeBps = newWithdrawFeeBps;
        feeRecipient = newFeeRecipient;
        emit FeeConfigSet(newHarvestFeeBps, newWithdrawFeeBps, newFeeRecipient);
    }

    function _validateFeeConfig(uint256 newHarvestFeeBps, uint256 newWithdrawFeeBps, address newFeeRecipient) internal pure {
        if (newHarvestFeeBps > MAX_HARVEST_FEE_BPS) revert FeeTooHigh();
        if (newWithdrawFeeBps > MAX_WITHDRAW_FEE_BPS) revert FeeTooHigh();
        if (newFeeRecipient == address(0)) revert ZeroAddress();
    }

    function _clearPendingFeeConfig() internal {
        pendingHarvestFeeBps = 0;
        pendingWithdrawFeeBps = 0;
        pendingFeeRecipient = address(0);
        pendingFeeEta = 0;
    }

    function _syncLooseDonations() internal returns (uint256 donationAmount) {
        uint256 loose = want.balanceOf(address(this));
        if (loose <= accountedVaultWantBalance) return 0;

        donationAmount = loose - accountedVaultWantBalance;
        ISdYBHybridStrategy strat = strategy;
        if (address(strat) == address(0)) revert StrategyRequiredForRetainedCapital();
        want.safeTransfer(address(strat), donationAmount);
        strat.depositVaultRetained(donationAmount, donationAmount);
        emit DonationDeployed(address(strat), donationAmount);
    }

    function _syncAccountedLooseWant() internal {
        accountedVaultWantBalance = want.balanceOf(address(this));
    }

    function _syncAccountedBalance() internal {
        _syncAccountedLooseWant();
    }

    function _requirePpsNotDecreased(
        uint256 assetsBefore,
        uint256 supplyBefore,
        uint256 assetsAfter,
        uint256 supplyAfter
    ) internal pure {
        if (supplyBefore == 0 || supplyAfter == 0) return;
        if (assetsAfter * supplyBefore < assetsBefore * supplyAfter) revert PricePerShareDecreased();
    }
}
