# Function Reference
Reference documentation for all public functions in the protocol.
Total public functions: **168**
## endpoints/amm/aldrin/close_leveraged_position_on_aldrin.rs
### handle
**Location**: `endpoints/amm/aldrin/close_leveraged_position_on_aldrin.rs:153`
**Signature**: `fn handle(
    ctx: Context<CloseLeveragedPositionOnAldrin>,
    market_obligation_bump_seed: u8,
    leverage: Leverage,
) -> Result<()>`
**Parameters**:
- `ctx: Context<CloseLeveragedPositionOnAldrin>`
- `market_obligation_bump_seed: u8`
- `leverage: Leverage`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/close_vault_position_on_aldrin.rs
### handle
**Location**: `endpoints/amm/aldrin/close_vault_position_on_aldrin.rs:64`
**Signature**: `fn handle(
    ctx: Context<CloseVaultPositionOnAldrin>,
    bump_seed: u8,
) -> Result<()>`
**Parameters**:
- `ctx: Context<CloseVaultPositionOnAldrin>`
- `bump_seed: u8`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/compound_position_on_aldrin.rs
### handle
**Location**: `endpoints/amm/aldrin/compound_position_on_aldrin.rs:104`
**Signature**: `fn handle(
    mut ctx: Context<CompoundPositionOnAldrin>,
    stake_lp_amount: u64,
    seeds: Vec<Vec<u8>>,
) -> Result<()>`
**Parameters**:
- `ctx: Context<CompoundPositionOnAldrin>`
- `stake_lp_amount: u64`
- `seeds: Vec<Vec<u8>>`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/init_reserve_aldrin_unstable_lp_token.rs
### handle
**Location**: `endpoints/amm/aldrin/init_reserve_aldrin_unstable_lp_token.rs:112`
**Signature**: `fn handle(
    ctx: Context<InitReserveAldrinUnstableLpToken>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    config: InputReserveConfig,
    is_oracle_for_base_vault: bool,
) -> Result<()>`
**Parameters**:
- `ctx: Context<InitReserveAldrinUnstableLpToken>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `config: InputReserveConfig`
- `is_oracle_for_base_vault: bool`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/open_leveraged_position_on_aldrin.rs
### handle
**Location**: `endpoints/amm/aldrin/open_leveraged_position_on_aldrin.rs:144`
**Signature**: `fn handle(
    ctx: Context<OpenLeveragedPositionOnAldrin>,
    lending_market_bump_seed: u8,
    market_obligation_bump_seed: u8,
    stake_lp_amount: u64,
    liquidity_amount: u64,
    swap_amount: u64,
    min_swap_return: u64,
    leverage: Leverage,
) -> Result<()>`
**Parameters**:
- `ctx: Context<OpenLeveragedPositionOnAldrin>`
- `lending_market_bump_seed: u8`
- `market_obligation_bump_seed: u8`
- `stake_lp_amount: u64`
- `liquidity_amount: u64`
- `swap_amount: u64`
- `min_swap_return: u64`
- `leverage: Leverage`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/open_vault_position_on_aldrin.rs
### handle
**Location**: `endpoints/amm/aldrin/open_vault_position_on_aldrin.rs:54`
**Signature**: `fn handle(
    ctx: Context<OpenVaultPositionOnAldrin>,
    bump_seed: u8,
    stake_lp_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<OpenVaultPositionOnAldrin>`
- `bump_seed: u8`
- `stake_lp_amount: u64`
**Returns**: `Result<()>`

## endpoints/amm/aldrin/refresh_reserve_aldrin_unstable_lp_token.rs
### handle
**Location**: `endpoints/amm/aldrin/refresh_reserve_aldrin_unstable_lp_token.rs:25`
**Signature**: `fn handle(ctx: Context<RefreshReserveAldrinUnstableLpToken>) -> Result<()>`
**Parameters**:
- `ctx: Context<RefreshReserveAldrinUnstableLpToken>`
**Returns**: `Result<()>`

## endpoints/borrow_obligation_liquidity.rs
### handle
**Location**: `endpoints/borrow_obligation_liquidity.rs:63`
**Signature**: `fn handle(
    ctx: Context<'_, '_, '_, 'info, BorrowObligationLiquidity<'info>>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### as_borrow_liquidity_context
**Location**: `endpoints/borrow_obligation_liquidity.rs:174`
**Signature**: `fn as_borrow_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

### as_pay_fee_context
**Location**: `endpoints/borrow_obligation_liquidity.rs:185`
**Signature**: `fn as_pay_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

### as_pay_host_fee_context
**Location**: `endpoints/borrow_obligation_liquidity.rs:197`
**Signature**: `fn as_pay_host_fee_context(
        &self,
        host_fee_receiver: &AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Parameters**:
- `host_fee_receiver: &AccountInfo<'info>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/deposit_obligation_collateral.rs
### handle
**Location**: `endpoints/deposit_obligation_collateral.rs:39`
**Signature**: `fn handle(
    ctx: Context<DepositObligationCollateral>,
    collateral_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<DepositObligationCollateral>`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### to_deposit_collateral_context
**Location**: `endpoints/deposit_obligation_collateral.rs:76`
**Signature**: `fn to_deposit_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/deposit_reserve_liquidity.rs
### handle
**Location**: `endpoints/deposit_reserve_liquidity.rs:57`
**Signature**: `fn handle(
    ctx: Context<DepositReserveLiquidity>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<DepositReserveLiquidity>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### as_mint_collateral_for_liquidity_context
**Location**: `endpoints/deposit_reserve_liquidity.rs:91`
**Signature**: `fn as_mint_collateral_for_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::MintTo<'info>>`

### as_deposit_liquidity_context
**Location**: `endpoints/deposit_reserve_liquidity.rs:102`
**Signature**: `fn as_deposit_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/emit/claim_emission.rs
### handle
**Location**: `endpoints/emit/claim_emission.rs:51`
**Signature**: `fn handle(
    ctx: Context<'_, '_, '_, 'info, ClaimEmission<'info>>,
    lending_market_bump_seed: u8,
    reserve_index: u8,
) -> Result<()>`
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
- `reserve_index: u8`
**Returns**: `Result<()>`

### as_claim_tokens_context
**Location**: `endpoints/emit/claim_emission.rs:211`
**Signature**: `fn as_claim_tokens_context(
        &self,
        source_wallet: AccountInfo<'info>,
        destination_wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Parameters**:
- `source_wallet: AccountInfo<'info>`
- `destination_wallet: AccountInfo<'info>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/emit/close_emission.rs
### handle
**Location**: `endpoints/emit/close_emission.rs:26`
**Signature**: `fn handle(
    ctx: Context<'_, '_, '_, 'info, CloseEmission<'info>>,
    _lending_market_bump_seed: u8,
) -> Result<()>`
**Parameters**:
- `ctx: Context<'_`
- `_lending_market_bump_seed: u8`
**Returns**: `Result<()>`

### as_set_wallet_authority_to_owner_context
**Location**: `endpoints/emit/close_emission.rs:76`
**Signature**: `fn as_set_wallet_authority_to_owner_context(
        &self,
        wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>>`
**Parameters**:
- `wallet: AccountInfo<'info>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>>`

## endpoints/emit/create_emission.rs
### handle
**Location**: `endpoints/emit/create_emission.rs:32`
**Signature**: `fn handle(
    ctx: Context<'_, '_, '_, 'info, CreateEmission<'info>>,
    _lending_market_bump_seed: u8,
    starts_at_slot: u64,
    ends_at_slot: u64,
    min_slots_elapsed_before_claim: u64,
    tokens: Vec<EmittedToken>,
) -> Result<()>`
**Parameters**:
- `ctx: Context<'_`
- `_lending_market_bump_seed: u8`
- `starts_at_slot: u64`
- `ends_at_slot: u64`
- `min_slots_elapsed_before_claim: u64`
- `tokens: Vec<EmittedToken>`
**Returns**: `Result<()>`

### as_set_wallet_authority_to_pda_context
**Location**: `endpoints/emit/create_emission.rs:103`
**Signature**: `fn as_set_wallet_authority_to_pda_context(
        &self,
        wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>>`
**Parameters**:
- `wallet: AccountInfo<'info>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>>`

## endpoints/emit/take_reserve_cap_snapshot.rs
### handle
**Location**: `endpoints/emit/take_reserve_cap_snapshot.rs:27`
**Signature**: `fn handle(ctx: Context<TakeReserveCapSnapshot>) -> Result<()>`
**Parameters**:
- `ctx: Context<TakeReserveCapSnapshot>`
**Returns**: `Result<()>`

## endpoints/flash_loan.rs
### handle
**Location**: `endpoints/flash_loan.rs:59`
**Signature**: `fn handle(
    ctx: Context<FlashLoan>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    target_data_prefix: Vec<u8>,
) -> Result<()>`
**Parameters**:
- `ctx: Context<FlashLoan>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `target_data_prefix: Vec<u8>`
**Returns**: `Result<()>`

### as_flash_loan_context
**Location**: `endpoints/flash_loan.rs:195`
**Signature**: `fn as_flash_loan_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

### as_pay_flash_loan_fee_context
**Location**: `endpoints/flash_loan.rs:206`
**Signature**: `fn as_pay_flash_loan_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/init_lending_market.rs
### handle
**Location**: `endpoints/init_lending_market.rs:20`
**Signature**: `fn handle(
    ctx: Context<InitLendingMarket>,
    currency: UniversalAssetCurrency,
    leveraged_compound_fee: PercentageInt,
    vault_compound_fee: PercentageInt,
    min_collateral_uac_value_for_leverage: SDecimal,
) -> Result<()>`
**Parameters**:
- `ctx: Context<InitLendingMarket>`
- `currency: UniversalAssetCurrency`
- `leveraged_compound_fee: PercentageInt`
- `vault_compound_fee: PercentageInt`
- `min_collateral_uac_value_for_leverage: SDecimal`
**Returns**: `Result<()>`

## endpoints/init_obligation.rs
### handle
**Location**: `endpoints/init_obligation.rs:11`
**Signature**: `fn handle(ctx: Context<InitObligation>) -> Result<()>`
**Parameters**:
- `ctx: Context<InitObligation>`
**Returns**: `Result<()>`

## endpoints/init_reserve.rs
### handle
**Location**: `endpoints/init_reserve.rs:96`
**Signature**: `fn handle(
    ctx: Context<InitReserve>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    config: InputReserveConfig,
) -> Result<()>`
**Parameters**:
- `ctx: Context<InitReserve>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `config: InputReserveConfig`
**Returns**: `Result<()>`

### as_init_collateral_mint_context
**Location**: `endpoints/init_reserve.rs:231`
**Signature**: `fn as_init_collateral_mint_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeMint<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::InitializeMint<'info>>`

### as_init_fee_recv_wallet_context
**Location**: `endpoints/init_reserve.rs:241`
**Signature**: `fn as_init_fee_recv_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`

### as_init_liquidity_wallet_context
**Location**: `endpoints/init_reserve.rs:254`
**Signature**: `fn as_init_liquidity_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`

### as_init_reserve_collateral_wallet_context
**Location**: `endpoints/init_reserve.rs:267`
**Signature**: `fn as_init_reserve_collateral_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`

### as_init_destination_collateral_wallet_context
**Location**: `endpoints/init_reserve.rs:280`
**Signature**: `fn as_init_destination_collateral_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>>`

### as_liquidity_deposit_context
**Location**: `endpoints/init_reserve.rs:293`
**Signature**: `fn as_liquidity_deposit_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

### as_mint_collateral_for_liquidity_context
**Location**: `endpoints/init_reserve.rs:305`
**Signature**: `fn as_mint_collateral_for_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::MintTo<'info>>`

## endpoints/liquidate_obligation.rs
### handle
**Location**: `endpoints/liquidate_obligation.rs:107`
**Signature**: `fn handle(
    ctx: Context<LiquidateObligation>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    loan_kind: LoanKind,
) -> Result<()>`
**Parameters**:
- `ctx: Context<LiquidateObligation>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `loan_kind: LoanKind`
**Returns**: `Result<()>`

### as_repay_liquidity_context
**Location**: `endpoints/liquidate_obligation.rs:371`
**Signature**: `fn as_repay_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

### as_withdraw_collateral_context
**Location**: `endpoints/liquidate_obligation.rs:382`
**Signature**: `fn as_withdraw_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/redeem_reserve_collateral.rs
### handle
**Location**: `endpoints/redeem_reserve_collateral.rs:74`
**Signature**: `fn handle(
    ctx: Context<RedeemReserveCollateral>,
    lending_market_bump_seed: u8,
    collateral_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<RedeemReserveCollateral>`
- `lending_market_bump_seed: u8`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### as_burn_collateral_token_context
**Location**: `endpoints/redeem_reserve_collateral.rs:111`
**Signature**: `fn as_burn_collateral_token_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Burn<'info>>`

### as_return_funders_liquidity_context
**Location**: `endpoints/redeem_reserve_collateral.rs:122`
**Signature**: `fn as_return_funders_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/refresh_obligation.rs
### handle
**Location**: `endpoints/refresh_obligation.rs:9`
**Signature**: `fn handle(ctx: Context<RefreshObligation>) -> Result<()>`
**Parameters**:
- `ctx: Context<RefreshObligation>`
**Returns**: `Result<()>`

## endpoints/refresh_reserve.rs
### handle
**Location**: `endpoints/refresh_reserve.rs:18`
**Signature**: `fn handle(ctx: Context<RefreshReserve>) -> Result<()>`
**Parameters**:
- `ctx: Context<RefreshReserve>`
**Returns**: `Result<()>`

## endpoints/repay_obligation_liquidity.rs
### handle
**Location**: `endpoints/repay_obligation_liquidity.rs:42`
**Signature**: `fn handle(
    ctx: Context<RepayObligationLiquidity>,
    liquidity_amount: u64,
    loan_kind: LoanKind,
) -> Result<()>`
**Parameters**:
- `ctx: Context<RepayObligationLiquidity>`
- `liquidity_amount: u64`
- `loan_kind: LoanKind`
**Returns**: `Result<()>`

### as_repay_liquidity_context
**Location**: `endpoints/repay_obligation_liquidity.rs:107`
**Signature**: `fn as_repay_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## endpoints/set_lending_market_owner.rs
### handle
**Location**: `endpoints/set_lending_market_owner.rs:10`
**Signature**: `fn handle(ctx: Context<SetLendingMarketOwner>) -> Result<()>`
**Parameters**:
- `ctx: Context<SetLendingMarketOwner>`
**Returns**: `Result<()>`

## endpoints/toggle_flash_loans.rs
### handle
**Location**: `endpoints/toggle_flash_loans.rs:11`
**Signature**: `fn handle(ctx: Context<ToggleFlashLoans>) -> Result<()>`
**Parameters**:
- `ctx: Context<ToggleFlashLoans>`
**Returns**: `Result<()>`

## endpoints/update_lending_market.rs
### handle
**Location**: `endpoints/update_lending_market.rs:12`
**Signature**: `fn handle(
    ctx: Context<UpdateLendingMarket>,
    leveraged_compound_fee: PercentageInt,
    vault_compound_fee: PercentageInt,
    min_collateral_uac_value_for_leverage: SDecimal,
) -> Result<()>`
**Parameters**:
- `ctx: Context<UpdateLendingMarket>`
- `leveraged_compound_fee: PercentageInt`
- `vault_compound_fee: PercentageInt`
- `min_collateral_uac_value_for_leverage: SDecimal`
**Returns**: `Result<()>`

## endpoints/update_reserve_config.rs
### handle
**Location**: `endpoints/update_reserve_config.rs:11`
**Signature**: `fn handle(
    ctx: Context<UpdateReserveConfig>,
    config: InputReserveConfig,
) -> Result<()>`
**Parameters**:
- `ctx: Context<UpdateReserveConfig>`
- `config: InputReserveConfig`
**Returns**: `Result<()>`

## endpoints/withdraw_obligation_collateral.rs
### handle
**Location**: `endpoints/withdraw_obligation_collateral.rs:50`
**Signature**: `fn handle(
    ctx: Context<WithdrawObligationCollateral>,
    lending_market_bump_seed: u8,
    collateral_amount: u64,
) -> Result<()>`
**Parameters**:
- `ctx: Context<WithdrawObligationCollateral>`
- `lending_market_bump_seed: u8`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### as_withdraw_collateral_context
**Location**: `endpoints/withdraw_obligation_collateral.rs:158`
**Signature**: `fn as_withdraw_collateral_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`
**Returns**: `CpiContext<'_, '_, '_, 'info, token::Transfer<'info>>`

## err.rs
### illegal_owner
**Location**: `err.rs:119`
**Signature**: `fn illegal_owner(msg: impl AsRef<str>) -> ErrorCode`
**Parameters**:
- `msg: impl AsRef<str>`
**Returns**: `ErrorCode`

### acc
**Location**: `err.rs:125`
**Signature**: `fn acc(msg: impl AsRef<str>) -> ErrorCode`
**Parameters**:
- `msg: impl AsRef<str>`
**Returns**: `ErrorCode`

### aldrin_amm_program_mismatch
**Location**: `err.rs:131`
**Signature**: `fn aldrin_amm_program_mismatch() -> ErrorCode`
**Returns**: `ErrorCode`

### reserve_stale
**Location**: `err.rs:135`
**Signature**: `fn reserve_stale() -> ErrorCode`
**Returns**: `ErrorCode`

### obligation_stale
**Location**: `err.rs:141`
**Signature**: `fn obligation_stale() -> ErrorCode`
**Returns**: `ErrorCode`

### cannot_use_as_collateral
**Location**: `err.rs:147`
**Signature**: `fn cannot_use_as_collateral() -> ErrorCode`
**Returns**: `ErrorCode`

### market_mismatch
**Location**: `err.rs:156`
**Signature**: `fn market_mismatch() -> ErrorCode`
**Returns**: `ErrorCode`

### obligation_healthy
**Location**: `err.rs:165`
**Signature**: `fn obligation_healthy() -> ErrorCode`
**Returns**: `ErrorCode`

### empty_liquidity
**Location**: `err.rs:174`
**Signature**: `fn empty_liquidity(msg: impl AsRef<str>) -> ErrorCode`
**Parameters**:
- `msg: impl AsRef<str>`
**Returns**: `ErrorCode`

### empty_collateral
**Location**: `err.rs:180`
**Signature**: `fn empty_collateral(msg: impl AsRef<str>) -> ErrorCode`
**Parameters**:
- `msg: impl AsRef<str>`
**Returns**: `ErrorCode`

### insufficient_funds
**Location**: `err.rs:186`
**Signature**: `fn insufficient_funds(
    required: impl Display,
    got: impl Display,
) -> ErrorCode`
**Parameters**:
- `required: impl Display`
- `got: impl Display`
**Returns**: `ErrorCode`

### oracle
**Location**: `err.rs:195`
**Signature**: `fn oracle(msg: impl AsRef<str>) -> ErrorCode`
**Parameters**:
- `msg: impl AsRef<str>`
**Returns**: `ErrorCode`

### flash_loans_disabled
**Location**: `err.rs:201`
**Signature**: `fn flash_loans_disabled() -> ErrorCode`
**Returns**: `ErrorCode`

## lib.rs
### init_lending_market
**Location**: `lib.rs:51`
**Signature**: `fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        currency: UniversalAssetCurrency,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> Result<()>`
```
**Parameters**:
- `ctx: Context<InitLendingMarket>`
- `currency: UniversalAssetCurrency`
- `leveraged_compound_fee: PercentageInt`
- `vault_compound_fee: PercentageInt`
- `min_collateral_uac_value_for_leverage: SDecimal`
**Returns**: `Result<()>`

### update_lending_market
**Location**: `lib.rs:76`
**Signature**: `fn update_lending_market(
        ctx: Context<UpdateLendingMarket>,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> Result<()>`
* `min_collateral_uac_value_for_leverage` - Updated minimum collateral requirement
**Parameters**:
- `ctx: Context<UpdateLendingMarket>`
- `leveraged_compound_fee: PercentageInt`
- `vault_compound_fee: PercentageInt`
- `min_collateral_uac_value_for_leverage: SDecimal`
**Returns**: `Result<()>`

### set_lending_market_owner
**Location**: `lib.rs:94`
**Signature**: `fn set_lending_market_owner(
        ctx: Context<SetLendingMarketOwner>,
    ) -> Result<()>`
who has control over the market configuration.
**Parameters**:
- `ctx: Context<SetLendingMarketOwner>`
**Returns**: `Result<()>`

### init_reserve
**Location**: `lib.rs:119`
**Signature**: `fn init_reserve(
        ctx: Context<InitReserve>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
    ) -> Result<()>`
- Fee structure (borrow fees, flash loan fees, host fees)
**Parameters**:
- `ctx: Context<InitReserve>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `config: InputReserveConfig`
**Returns**: `Result<()>`

### init_reserve_aldrin_unstable_lp_token
**Location**: `lib.rs:136`
**Signature**: `fn init_reserve_aldrin_unstable_lp_token(
        ctx: Context<InitReserveAldrinUnstableLpToken>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
        is_oracle_for_base_vault: bool,
    ) -> Result<()>`
in which the amount of tokens in both vaults is of equal value.
**Parameters**:
- `ctx: Context<InitReserveAldrinUnstableLpToken>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `config: InputReserveConfig`
- `is_oracle_for_base_vault: bool`
**Returns**: `Result<()>`

### update_reserve_config
**Location**: `lib.rs:159`
**Signature**: `fn update_reserve_config(
        ctx: Context<UpdateReserveConfig>,
        config: InputReserveConfig,
    ) -> Result<()>`
* `config` - New reserve configuration to apply
**Parameters**:
- `ctx: Context<UpdateReserveConfig>`
- `config: InputReserveConfig`
**Returns**: `Result<()>`

### refresh_reserve
**Location**: `lib.rs:175`
**Signature**: `fn refresh_reserve(ctx: Context<RefreshReserve>) -> Result<()>`
market price, which affects collateral valuations and health calculations.
**Parameters**:
- `ctx: Context<RefreshReserve>`
**Returns**: `Result<()>`

### refresh_reserve_aldrin_unstable_lp_token
**Location**: `lib.rs:183`
**Signature**: `fn refresh_reserve_aldrin_unstable_lp_token(
        ctx: Context<RefreshReserveAldrinUnstableLpToken>,
    ) -> Result<()>`
the value of LP tokens based on the underlying pool assets.
**Parameters**:
- `ctx: Context<RefreshReserveAldrinUnstableLpToken>`
**Returns**: `Result<()>`

### deposit_reserve_liquidity
**Location**: `lib.rs:209`
**Signature**: `fn deposit_reserve_liquidity(
        ctx: Context<DepositReserveLiquidity>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> Result<()>`
as interest accumulates in the reserve's liquidity supply.
**Parameters**:
- `ctx: Context<DepositReserveLiquidity>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### redeem_reserve_collateral
**Location**: `lib.rs:220`
**Signature**: `fn redeem_reserve_collateral(
        ctx: Context<RedeemReserveCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> Result<()>`
**Parameters**:
- `ctx: Context<RedeemReserveCollateral>`
- `lending_market_bump_seed: u8`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### init_obligation_r10
**Location**: `lib.rs:235`
**Signature**: `fn init_obligation_r10(ctx: Context<InitObligation>) -> Result<()>`
which to borrow or to which to deposit.
**Parameters**:
- `ctx: Context<InitObligation>`
**Returns**: `Result<()>`

### refresh_obligation
**Location**: `lib.rs:238`
**Signature**: `fn refresh_obligation(ctx: Context<RefreshObligation>) -> Result<()>`
**Parameters**:
- `ctx: Context<RefreshObligation>`
**Returns**: `Result<()>`

### deposit_obligation_collateral
**Location**: `lib.rs:242`
**Signature**: `fn deposit_obligation_collateral(
        ctx: Context<DepositObligationCollateral>,
        collateral_amount: u64,
    ) -> Result<()>`
**Parameters**:
- `ctx: Context<DepositObligationCollateral>`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### withdraw_obligation_collateral
**Location**: `lib.rs:252`
**Signature**: `fn withdraw_obligation_collateral(
        ctx: Context<WithdrawObligationCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> Result<()>`
amount of collateral from a specific reserve.
**Parameters**:
- `ctx: Context<WithdrawObligationCollateral>`
- `lending_market_bump_seed: u8`
- `collateral_amount: u64`
**Returns**: `Result<()>`

### borrow_obligation_liquidity
**Location**: `lib.rs:266`
**Signature**: `fn borrow_obligation_liquidity(
        ctx: Context<'_, '_, '_, 'info, BorrowObligationLiquidity<'info>>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> Result<()>`
collateral they deposited.
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### repay_obligation_liquidity
**Location**: `lib.rs:279`
**Signature**: `fn repay_obligation_liquidity(
        ctx: Context<RepayObligationLiquidity>,
        liquidity_amount: u64,
        loan_kind: LoanKind,
    ) -> Result<()>`
Borrowed repays part or all of their loan of a specific reserve.
**Parameters**:
- `ctx: Context<RepayObligationLiquidity>`
- `liquidity_amount: u64`
- `loan_kind: LoanKind`
**Returns**: `Result<()>`

### liquidate_obligation
**Location**: `lib.rs:293`
**Signature**: `fn liquidate_obligation(
        ctx: Context<LiquidateObligation>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        loan_kind: LoanKind,
    ) -> Result<()>`
market value and receive collateral in lieu.
**Parameters**:
- `ctx: Context<LiquidateObligation>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `loan_kind: LoanKind`
**Returns**: `Result<()>`

### flash_loan
**Location**: `lib.rs:311`
**Signature**: `fn flash_loan(
        ctx: Context<FlashLoan>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        target_data_prefix: Vec<u8>,
    ) -> Result<()>`
only, it won't show in the UI.
**Parameters**:
- `ctx: Context<FlashLoan>`
- `lending_market_bump_seed: u8`
- `liquidity_amount: u64`
- `target_data_prefix: Vec<u8>`
**Returns**: `Result<()>`

### toggle_flash_loans
**Location**: `lib.rs:326`
**Signature**: `fn toggle_flash_loans(ctx: Context<ToggleFlashLoans>) -> Result<()>`
Used by the market owner to conditionally turn off/on flash loans.
**Parameters**:
- `ctx: Context<ToggleFlashLoans>`
**Returns**: `Result<()>`

### open_leveraged_position_on_aldrin
**Location**: `lib.rs:347`
**Signature**: `fn open_leveraged_position_on_aldrin(
        ctx: Context<OpenLeveragedPositionOnAldrin>,
        lending_market_bump_seed: u8,
        market_obligation_bump_seed: u8,
        stake_lp_amount: u64,
        liquidity_amount: u64,
        swap_amount: u64,
        min_swap_return: u64,
        leverage: Leverage,
    ) -> Result<()>`
**Parameters**:
- `ctx: Context<OpenLeveragedPositionOnAldrin>`
- `lending_market_bump_seed: u8`
- `market_obligation_bump_seed: u8`
- `stake_lp_amount: u64`
- `liquidity_amount: u64`
- `swap_amount: u64`
- `min_swap_return: u64`
- `leverage: Leverage`
**Returns**: `Result<()>`

### close_leveraged_position_on_aldrin
**Location**: `lib.rs:368`
**Signature**: `fn close_leveraged_position_on_aldrin(
        ctx: Context<CloseLeveragedPositionOnAldrin>,
        market_obligation_bump_seed: u8,
        leverage: Leverage,
    ) -> Result<()>`
**Parameters**:
- `ctx: Context<CloseLeveragedPositionOnAldrin>`
- `market_obligation_bump_seed: u8`
- `leverage: Leverage`
**Returns**: `Result<()>`

### compound_position_on_aldrin
**Location**: `lib.rs:385`
**Signature**: `fn compound_position_on_aldrin(
        ctx: Context<CompoundPositionOnAldrin>,
        stake_lp_amount: u64,
        seeds: Vec<Vec<u8>>,
    ) -> Result<()>`
liquidation.
**Parameters**:
- `ctx: Context<CompoundPositionOnAldrin>`
- `stake_lp_amount: u64`
- `seeds: Vec<Vec<u8>>`
**Returns**: `Result<()>`

### take_reserve_cap_snapshot
**Location**: `lib.rs:399`
**Signature**: `fn take_reserve_cap_snapshot(
        ctx: Context<TakeReserveCapSnapshot>,
    ) -> Result<()>`
at present time for a reserve.
**Parameters**:
- `ctx: Context<TakeReserveCapSnapshot>`
**Returns**: `Result<()>`

### close_emission
**Location**: `lib.rs:407`
**Signature**: `fn close_emission(
        ctx: Context<'_, '_, '_, 'info, CloseEmission<'info>>,
        lending_market_bump_seed: u8,
    ) -> Result<()>`
were not collected back to the market owner.
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
**Returns**: `Result<()>`

### create_emission
**Location**: `lib.rs:418`
**Signature**: `fn create_emission(
        ctx: Context<'_, '_, '_, 'info, CreateEmission<'info>>,
        lending_market_bump_seed: u8,
        starts_at_slot: u64,
        ends_at_slot: u64,
        min_slots_elapsed_before_claim: u64,
        tokens: Vec<EmittedToken>,
    ) -> Result<()>`
vector.
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
- `starts_at_slot: u64`
- `ends_at_slot: u64`
- `min_slots_elapsed_before_claim: u64`
- `tokens: Vec<EmittedToken>`
**Returns**: `Result<()>`

### claim_emission
**Location**: `lib.rs:438`
**Signature**: `fn claim_emission(
        ctx: Context<'_, '_, '_, 'info, ClaimEmission<'info>>,
        lending_market_bump_seed: u8,
        reserve_index: u8,
    ) -> Result<()>`
borrows or deposits.
**Parameters**:
- `ctx: Context<'_`
- `lending_market_bump_seed: u8`
- `reserve_index: u8`
**Returns**: `Result<()>`

### open_vault_position_on_aldrin
**Location**: `lib.rs:454`
**Signature**: `fn open_vault_position_on_aldrin(
        ctx: Context<OpenVaultPositionOnAldrin>,
        bump_seed: u8,
        stake_lp_amount: u64,
    ) -> Result<()>`
The user pubkey is in the PDA of the ticket authority.
**Parameters**:
- `ctx: Context<OpenVaultPositionOnAldrin>`
- `bump_seed: u8`
- `stake_lp_amount: u64`
**Returns**: `Result<()>`

### close_vault_position_on_aldrin
**Location**: `lib.rs:469`
**Signature**: `fn close_vault_position_on_aldrin(
        ctx: Context<CloseVaultPositionOnAldrin>,
        bump_seed: u8,
    ) -> Result<()>`
in the PDA seed of the ticket owner.
**Parameters**:
- `ctx: Context<CloseVaultPositionOnAldrin>`
- `bump_seed: u8`
**Returns**: `Result<()>`

## math/mod.rs
### new
**Location**: `math/mod.rs:82`
**Signature**: `fn new(percent: u64) -> Self`
**Parameters**:
- `percent: u64`
**Returns**: `Self`

## math/sdecimal.rs
### to_dec
**Location**: `math/sdecimal.rs:73`
**Signature**: `fn to_dec(self) -> Decimal`
**Returns**: `Decimal`

### fill
**Location**: `math/sdecimal.rs:78`
**Signature**: `fn fill(with: u64) -> Self`
**Parameters**:
- `with: u64`
**Returns**: `Self`

## models.rs
### validate
**Location**: `models.rs:26`
**Signature**: `fn validate(self) -> Result<T>`
**Returns**: `Result<T>`

### new
**Location**: `models.rs:34`
**Signature**: `fn new(inner: T) -> Self`
**Parameters**:
- `inner: T`
**Returns**: `Self`

## models/aldrin_amm.rs
### load
**Location**: `models/aldrin_amm.rs:35`
**Signature**: `fn load(account_data: &[u8]) -> Result<&Self>
    where
        Self: Sized,`
**Parameters**:
- `account_data: &[u8]`
**Returns**: `Result<&Self>
    where
        Self: Sized,`

### is_ask
**Location**: `models/aldrin_amm.rs:67`
**Signature**: `fn is_ask(self) -> bool`
**Returns**: `bool`

### try_from
**Location**: `models/aldrin_amm.rs:70`
**Signature**: `fn try_from(
        reserve: &Reserve,
        base_token: &Account<'_, TokenAccount>,
        quote_token: &Account<'_, TokenAccount>,
    ) -> Result<Self>`
**Parameters**:
- `reserve: &Reserve`
- `base_token: &Account<'_`
- `quote_token: &Account<'_`
**Returns**: `Result<Self>`

### lp_token_market_price
**Location**: `models/aldrin_amm.rs:91`
**Signature**: `fn lp_token_market_price(
    lp_tokens_supply: u64,
    base_market_price: Decimal,
    base_tokens_deposited: u64,
    quote_market_price: Decimal,
    quote_tokens_deposited: u64,
) -> Result<Decimal>`
**Parameters**:
- `lp_tokens_supply: u64`
- `base_market_price: Decimal`
- `base_tokens_deposited: u64`
- `quote_market_price: Decimal`
- `quote_tokens_deposited: u64`
**Returns**: `Result<Decimal>`

### unstable_lp_token_market_price
**Location**: `models/aldrin_amm.rs:110`
**Signature**: `fn unstable_lp_token_market_price(
    lp_tokens_supply: u64,
    constituent_token_market_price: Decimal,
    constituent_tokens_deposited: u64,
) -> Result<Decimal>`
**Parameters**:
- `lp_tokens_supply: u64`
- `constituent_token_market_price: Decimal`
- `constituent_tokens_deposited: u64`
**Returns**: `Result<Decimal>`

## models/emissions.rs
### tokens
**Location**: `models/emissions.rs:115`
**Signature**: `fn tokens(&self) -> Vec<&EmittedToken>`
**Returns**: `Vec<&EmittedToken>`

### empty
**Location**: `models/emissions.rs:126`
**Signature**: `fn empty() -> Self`
**Returns**: `Self`

### space
**Location**: `models/emissions.rs:136`
**Signature**: `fn space() -> usize`
**Returns**: `usize`

### average_borrowed_amount
**Location**: `models/emissions.rs:141`
**Signature**: `fn average_borrowed_amount(&self, since: u64) -> Result<Decimal>`
**Parameters**:
- `since: u64`
**Returns**: `Result<Decimal>`

### average_cap
**Location**: `models/emissions.rs:154`
**Signature**: `fn average_cap(&self, since: u64) -> Result<Decimal>`
**Parameters**:
- `since: u64`
**Returns**: `Result<Decimal>`

## models/last_update.rs
### new
**Location**: `models/last_update.rs:9`
**Signature**: `fn new(slot: u64) -> Self`
**Parameters**:
- `slot: u64`
**Returns**: `Self`

### slots_elapsed
**Location**: `models/last_update.rs:12`
**Signature**: `fn slots_elapsed(&self, slot: u64) -> Result<u64>`
**Parameters**:
- `slot: u64`
**Returns**: `Result<u64>`

### update_slot
**Location**: `models/last_update.rs:18`
**Signature**: `fn update_slot(&mut self, slot: u64) -> ()`
**Parameters**:
- `slot: u64`
**Returns**: `()`

### mark_stale
**Location**: `models/last_update.rs:23`
**Signature**: `fn mark_stale(&mut self) -> ()`
**Returns**: `()`

### is_stale
**Location**: `models/last_update.rs:27`
**Signature**: `fn is_stale(&self, slot: u64) -> Result<bool>`
**Parameters**:
- `slot: u64`
**Returns**: `Result<bool>`

## models/lending_market.rs
### space
**Location**: `models/lending_market.rs:29`
**Signature**: `fn space() -> usize`
**Returns**: `usize`

## models/obligation.rs
### is_stale
**Location**: `models/obligation.rs:148`
**Signature**: `fn is_stale(&self, clock: &Clock) -> bool`
**Parameters**:
- `clock: &Clock`
**Returns**: `bool`

### is_stale_for_leverage
**Location**: `models/obligation.rs:151`
**Signature**: `fn is_stale_for_leverage(&self, clock: &Clock) -> bool`
**Parameters**:
- `clock: &Clock`
**Returns**: `bool`

### withdraw
**Location**: `models/obligation.rs:162`
**Signature**: `fn withdraw(
        &mut self,
        withdraw_amount: u64,
        collateral_index: usize,
        slot: u64,
    ) -> Result<()>`
Withdraw collateral and remove it from deposits if zeroed out
**Parameters**:
- `withdraw_amount: u64`
- `collateral_index: usize`
- `slot: u64`
**Returns**: `Result<()>`

### has_borrows
**Location**: `models/obligation.rs:190`
**Signature**: `fn has_borrows(&self) -> bool`
**Returns**: `bool`

### has_deposits
**Location**: `models/obligation.rs:196`
**Signature**: `fn has_deposits(&self) -> bool`
**Returns**: `bool`

### is_deposited_value_zero
**Location**: `models/obligation.rs:202`
**Signature**: `fn is_deposited_value_zero(&self) -> bool`
**Returns**: `bool`

### is_borrowed_value_zero
**Location**: `models/obligation.rs:206`
**Signature**: `fn is_borrowed_value_zero(&self) -> bool`
**Returns**: `bool`

### is_healthy
**Location**: `models/obligation.rs:212`
**Signature**: `fn is_healthy(&self) -> bool`
**Returns**: `bool`

### max_withdraw_value
**Location**: `models/obligation.rs:221`
**Signature**: `fn max_withdraw_value(&self) -> Result<Decimal>`
**Returns**: `Result<Decimal>`

### get_collateral
**Location**: `models/obligation.rs:237`
**Signature**: `fn get_collateral(
        &self,
        key: Pubkey,
    ) -> Result<(usize, &ObligationCollateral)>`
**Parameters**:
- `key: Pubkey`
**Returns**: `Result<(usize, &ObligationCollateral)>`

### get_liquidity
**Location**: `models/obligation.rs:258`
**Signature**: `fn get_liquidity(
        &self,
        key: Pubkey,
        loan_kind: LoanKind,
    ) -> Result<(usize, &ObligationLiquidity)>`
**Parameters**:
- `key: Pubkey`
- `loan_kind: LoanKind`
**Returns**: `Result<(usize, &ObligationLiquidity)>`

### deposit
**Location**: `models/obligation.rs:281`
**Signature**: `fn deposit(
        &mut self,
        reserve_key: Pubkey,
        collateral_amount: u64,
        slot: u64,
    ) -> Result<()>`
**Parameters**:
- `reserve_key: Pubkey`
- `collateral_amount: u64`
- `slot: u64`
**Returns**: `Result<()>`

### borrow
**Location**: `models/obligation.rs:320`
**Signature**: `fn borrow(
        &mut self,
        reserve_key: Pubkey,
        liquidity_amount: Decimal,
        loan_kind: LoanKind,
        slot: u64,
    ) -> Result<()>`
**Parameters**:
- `reserve_key: Pubkey`
- `liquidity_amount: Decimal`
- `loan_kind: LoanKind`
- `slot: u64`
**Returns**: `Result<()>`

### repay
**Location**: `models/obligation.rs:365`
**Signature**: `fn repay(
        &mut self,
        settle_amount: Decimal,
        liquidity_index: usize,
        slot: u64,
    ) -> Result<()>`
Repay liquidity and remove it from borrows if zeroed out
**Parameters**:
- `settle_amount: Decimal`
- `liquidity_index: usize`
- `slot: u64`
**Returns**: `Result<()>`

### remaining_collateralized_borrow_value
**Location**: `models/obligation.rs:397`
**Signature**: `fn remaining_collateralized_borrow_value(&self) -> Decimal`
needs to be collateralized.
**Returns**: `Decimal`

### new
**Location**: `models/obligation.rs:412`
**Signature**: `fn new(borrow_reserve: Pubkey, loan_kind: LoanKind) -> Self`
**Parameters**:
- `borrow_reserve: Pubkey`
- `loan_kind: LoanKind`
**Returns**: `Self`

### accrue_interest
**Location**: `models/obligation.rs:426`
**Signature**: `fn accrue_interest(
        &mut self,
        cumulative_borrow_rate: Decimal,
    ) -> Result<()>`
ref. eq. (6)
**Parameters**:
- `cumulative_borrow_rate: Decimal`
**Returns**: `Result<()>`

### max_liquidation_amount
**Location**: `models/obligation.rs:457`
**Signature**: `fn max_liquidation_amount(
        &self,
        obligation_borrowed_value: Decimal,
    ) -> Result<Decimal>`
ref. eq. (8)
**Parameters**:
- `obligation_borrowed_value: Decimal`
**Returns**: `Result<Decimal>`

### new
**Location**: `models/obligation.rs:490`
**Signature**: `fn new(deposit_reserve: Pubkey) -> Self`
**Parameters**:
- `deposit_reserve: Pubkey`
**Returns**: `Self`

### calculate_repay_amounts
**Location**: `models/obligation.rs:534`
**Signature**: `fn calculate_repay_amounts(
    liquidity_amount: u64,
    borrowed_amount: Decimal,
) -> Result<(u64, Decimal)>`
**Parameters**:
- `liquidity_amount: u64`
- `borrowed_amount: Decimal`
**Returns**: `Result<(u64, Decimal)>`

## models/oracle.rs
### simple_pyth
**Location**: `models/oracle.rs:33`
**Signature**: `fn simple_pyth(price: Pubkey) -> Self`
**Parameters**:
- `price: Pubkey`
**Returns**: `Self`

### is_simple_pyth_price
**Location**: `models/oracle.rs:36`
**Signature**: `fn is_simple_pyth_price(&self, input_price: &Pubkey) -> bool`
**Parameters**:
- `input_price: &Pubkey`
**Returns**: `bool`

### is_aldrin_amm_lp_pyth
**Location**: `models/oracle.rs:40`
**Signature**: `fn is_aldrin_amm_lp_pyth(
        &self,
        input_vault: Pubkey,
        input_lp_token_mint: Pubkey,
        input_price: Pubkey,
    ) -> bool`
**Parameters**:
- `input_vault: Pubkey`
- `input_lp_token_mint: Pubkey`
- `input_price: Pubkey`
**Returns**: `bool`

## models/pyth.rs
### token_market_price
**Location**: `models/pyth.rs:118`
**Signature**: `fn token_market_price(
    clock: &Clock,
    uac: UniversalAssetCurrency,
    product_data: Ref<'info, &mut [u8]>,
    price_key: Pubkey,
    price_data: Ref<'info, &mut [u8]>,
) -> Result<Decimal>`
Returns the market price in the UAC of 1 token described by the product
data.
**Parameters**:
- `clock: &Clock`
- `uac: UniversalAssetCurrency`
- `product_data: Ref<'info`
- `price_key: Pubkey`
- `price_data: Ref<'info`
**Returns**: `Result<Decimal>`

### calculate_market_price
**Location**: `models/pyth.rs:148`
**Signature**: `fn calculate_market_price(pyth: &Price, clock: &Clock) -> Result<Decimal>`
**Parameters**:
- `pyth: &Price`
- `clock: &Clock`
**Returns**: `Result<Decimal>`

## models/reserve.rs
### space
**Location**: `models/reserve.rs:263`
**Signature**: `fn space() -> usize`
**Returns**: `usize`

### is_stale
**Location**: `models/reserve.rs:266`
**Signature**: `fn is_stale(&self, clock: &Clock) -> bool`
**Parameters**:
- `clock: &Clock`
**Returns**: `bool`

### deposit_liquidity
**Location**: `models/reserve.rs:273`
**Signature**: `fn deposit_liquidity(&mut self, liquidity_amount: u64) -> Result<u64>`
mint in exchange for it.
**Parameters**:
- `liquidity_amount: u64`
**Returns**: `Result<u64>`

### redeem_collateral
**Location**: `models/reserve.rs:288`
**Signature**: `fn redeem_collateral(&mut self, collateral_amount: u64) -> Result<u64>`
[`anchor_spl::token::burn`].
**Parameters**:
- `collateral_amount: u64`
**Returns**: `Result<u64>`

### collateral_exchange_rate
**Location**: `models/reserve.rs:298`
**Signature**: `fn collateral_exchange_rate(&self) -> Result<CollateralExchangeRate>`
**Returns**: `Result<CollateralExchangeRate>`

### accrue_interest
**Location**: `models/reserve.rs:306`
**Signature**: `fn accrue_interest(&mut self, current_slot: u64) -> Result<()>`
are presently borrowed.
**Parameters**:
- `current_slot: u64`
**Returns**: `Result<()>`

### current_borrow_rate
**Location**: `models/reserve.rs:317`
**Signature**: `fn current_borrow_rate(&self) -> Result<Decimal>`
ref. eq. (3)
**Returns**: `Result<Decimal>`

### borrow_amount_with_fees
**Location**: `models/reserve.rs:358`
**Signature**: `fn borrow_amount_with_fees(
        &self,
        borrow_amount: u64,
        max_borrow_value: Decimal,
        loan_kind: LoanKind,
    ) -> Result<(Decimal, FeesCalculation)>`
**Parameters**:
- `borrow_amount: u64`
- `max_borrow_value: Decimal`
- `loan_kind: LoanKind`
**Returns**: `Result<(Decimal, FeesCalculation)>`

### total_supply
**Location**: `models/reserve.rs:397`
**Signature**: `fn total_supply(&self) -> Result<Decimal>`
Calculate the total reserve supply including active loans.
**Returns**: `Result<Decimal>`

### deposit
**Location**: `models/reserve.rs:402`
**Signature**: `fn deposit(&mut self, liquidity_amount: u64) -> Result<()>`
**Parameters**:
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### utilization_rate
**Location**: `models/reserve.rs:412`
**Signature**: `fn utilization_rate(&self) -> Result<Decimal>`
ref. eq. (1)
**Returns**: `Result<Decimal>`

### withdraw
**Location**: `models/reserve.rs:420`
**Signature**: `fn withdraw(&mut self, liquidity_amount: u64) -> Result<()>`
**Parameters**:
- `liquidity_amount: u64`
**Returns**: `Result<()>`

### repay
**Location**: `models/reserve.rs:439`
**Signature**: `fn repay(
        &mut self,
        repay_amount: u64,
        settle_amount: Decimal,
    ) -> Result<()>`
total borrows.
**Parameters**:
- `repay_amount: u64`
- `settle_amount: Decimal`
**Returns**: `Result<()>`

### borrow
**Location**: `models/reserve.rs:515`
**Signature**: `fn borrow(&mut self, borrow_decimal: Decimal) -> Result<()>`
Subtract borrow amount from available liquidity and add to borrows.
**Parameters**:
- `borrow_decimal: Decimal`
**Returns**: `Result<()>`

### burn
**Location**: `models/reserve.rs:575`
**Signature**: `fn burn(&mut self, collateral_amount: u64) -> Result<()>`
**Parameters**:
- `collateral_amount: u64`
**Returns**: `Result<()>`

### liquidity_to_collateral
**Location**: `models/reserve.rs:586`
**Signature**: `fn liquidity_to_collateral(
        &self,
        liquidity_amount: u64,
    ) -> Result<u64>`
**Parameters**:
- `liquidity_amount: u64`
**Returns**: `Result<u64>`

### collateral_to_liquidity
**Location**: `models/reserve.rs:595`
**Signature**: `fn collateral_to_liquidity(
        &self,
        collateral_amount: u64,
    ) -> Result<u64>`
**Parameters**:
- `collateral_amount: u64`
**Returns**: `Result<u64>`

### decimal_collateral_to_liquidity
**Location**: `models/reserve.rs:605`
**Signature**: `fn decimal_collateral_to_liquidity(
        &self,
        collateral_amount: Decimal,
    ) -> Result<Decimal>`
**Parameters**:
- `collateral_amount: Decimal`
**Returns**: `Result<Decimal>`

### validate
**Location**: `models/reserve.rs:615`
**Signature**: `fn validate(self) -> Result<ReserveConfig>`
**Returns**: `Result<ReserveConfig>`

### new
**Location**: `models/reserve.rs:620`
**Signature**: `fn new(conf: ReserveConfig) -> Self`
**Parameters**:
- `conf: ReserveConfig`
**Returns**: `Self`

### flash_loan_fee
**Location**: `models/reserve.rs:627`
**Signature**: `fn flash_loan_fee(&self, borrow_amount: Decimal) -> Result<u64>`
**Parameters**:
- `borrow_amount: Decimal`
**Returns**: `Result<u64>`

## zero_copy_utils.rs
### load_and_validate
**Location**: `zero_copy_utils.rs:133`
**Signature**: `fn load_and_validate(
        account_loader: &AccountLoader<T>
    ) -> Result<Ref<T>>`
Safely load a zero-copy account with validation.
**Parameters**:
- `account_loader: &AccountLoader<T>`
**Returns**: `Result<Ref<T>>`

### load_mut_and_validate
**Location**: `zero_copy_utils.rs:145`
**Signature**: `fn load_mut_and_validate(
        account_loader: &AccountLoader<T>
    ) -> Result<RefMut<T>>`
Safely load a mutable zero-copy account with validation.
**Parameters**:
- `account_loader: &AccountLoader<T>`
**Returns**: `Result<RefMut<T>>`

### calculate_rent_exempt_balance
**Location**: `zero_copy_utils.rs:157`
**Signature**: `fn calculate_rent_exempt_balance(
        rent: &Rent
    ) -> u64`
Calculate the rent-exempt minimum balance for a zero-copy account.
**Parameters**:
- `rent: &Rent`
**Returns**: `u64`

### validate_rent_exempt
**Location**: `zero_copy_utils.rs:164`
**Signature**: `fn validate_rent_exempt(
        account_info: &AccountInfo,
        rent: &Rent
    ) -> Result<()>`
Validate that an account has sufficient balance for rent exemption.
**Parameters**:
- `account_info: &AccountInfo`
- `rent: &Rent`
**Returns**: `Result<()>`

### measure_load_cost
**Location**: `zero_copy_utils.rs:206`
**Signature**: `fn measure_load_cost(operation: F) -> (R, u64)
    where
        F: FnOnce() -> R,`
Measure compute units used for account loading.
**Parameters**:
- `operation: F`
**Returns**: `(R, u64)
    where
        F: FnOnce() -> R,`

### log_memory_stats
**Location**: `zero_copy_utils.rs:227`
**Signature**: `fn log_memory_stats(name: &str) -> ()`
Log memory usage statistics for zero-copy structures.
**Parameters**:
- `name: &str`
**Returns**: `()`

### lower_bound
**Location**: `zero_copy_utils.rs:242`
**Signature**: `fn lower_bound(slice: &[T], target: &T, compare: F) -> usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,`
Binary search for the first element greater than or equal to target.
**Parameters**:
- `slice: &[T]`
- `target: &T`
- `compare: F`
**Returns**: `usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,`

### upper_bound
**Location**: `zero_copy_utils.rs:261`
**Signature**: `fn upper_bound(slice: &[T], target: &T, compare: F) -> usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,`
Binary search for the last element less than or equal to target.
**Parameters**:
- `slice: &[T]`
- `target: &T`
- `compare: F`
**Returns**: `usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,`

