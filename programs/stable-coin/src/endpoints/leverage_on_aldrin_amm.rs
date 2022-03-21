use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use cpis::aldrin::SwapCpi;

#[derive(Accounts)]
#[instruction(stable_coin_bump_seed: u8)]
pub struct LeverageOnAldrinAmm<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(
        seeds = [component.stable_coin.as_ref()],
        bump = stable_coin_bump_seed,
    )]
    pub stable_coin_pda: AccountInfo<'info>,
    /// We need to mutate mint allowance in config.
    #[account(
        mut,
        constraint = freeze_wallet.key() == component.freeze_wallet
            @ err::freeze_wallet_mismatch(),
    )]
    pub component: Box<Account<'info, Component>>,
    #[account(
        constraint = reserve.key() == component.blp_reserve
            @ err::reserve_mismatch(),
        constraint = !reserve.is_stale(&clock)
            @ borrow_lending::err::reserve_stale(),
    )]
    pub reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
    /// The swapped collateral is eventually transferred here
    #[account(mut)]
    pub freeze_wallet: AccountInfo<'info>,
    /// Needed to mint new stable coin tokens
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
        constraint = receipt.borrower == borrower.key()
            @ err::acc("Receipt's borrower doesn't match"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Stable coin is minted here, but then swapped so in the end there're no
    /// extra tokens remaining
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    /// Collateral is swapped for stable coin into this wallet, but then it's
    /// transferred to freeze wallet so there're no extra tokens remaining
    #[account(mut)]
    pub borrower_collateral_wallet: Account<'info, TokenAccount>,
    // -------------- AMM Accounts ----------------
    #[account(
            executable,
            constraint = stable_coin.aldrin_amm == amm_program.key()
                @ err::aldrin_amm_program_mismatch(),
        )]
    pub amm_program: AccountInfo<'info>,
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    #[account(mut)]
    pub pool_mint: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_pool_wallet: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<LeverageOnAldrinAmm>,
    stable_coin_bump_seed: u8,
    collateral_ratio: SDecimal,
    initial_amount: u64,
    min_swap_return: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let max_collateral_ratio =
        accounts.component.config.max_collateral_ratio.to_dec();
    let collateral_ratio = collateral_ratio.to_dec();
    if collateral_ratio > max_collateral_ratio {
        return Err(ErrorCode::CannotGoOverMaxCollateralRatio.into());
    }

    let leverage = (Decimal::one()
        .try_sub(collateral_ratio.try_pow(consts::MAX_LEVERAGE_LOOPS)?)?)
    .try_div(Decimal::one().try_sub(collateral_ratio)?)?;

    let stable_coin_amount_to_mint: u64 = leverage
        .try_mul(Decimal::from(initial_amount))?
        .try_floor_u64()?;

    if stable_coin_amount_to_mint > accounts.component.config.mint_allowance {
        msg!(
            "This type of collateral can be presently used to
            mint at most {} stable coin tokens",
            accounts.component.config.mint_allowance
        );
        return Err(ErrorCode::MintAllowanceTooSmall.into());
    }

    accounts.receipt.accrue_interest(
        accounts.clock.slot,
        accounts.component.config.interest.to_dec(),
    )?;

    // add the stable coin amount that's minted and swapped as borrowed amount
    // and include borrow fee
    let borrow_fee = Decimal::from(stable_coin_amount_to_mint)
        .try_mul(accounts.component.config.borrow_fee.to_dec())?;
    accounts.receipt.borrowed_amount = accounts
        .receipt
        .borrowed_amount
        .to_dec()
        .try_add(Decimal::from(stable_coin_amount_to_mint))?
        .try_add(borrow_fee)?
        .into();

    let initial_borrower_collateral =
        accounts.borrower_collateral_wallet.amount;

    let pda_seeds = &[
        &accounts.component.stable_coin.to_bytes()[..],
        &[stable_coin_bump_seed],
    ];
    token::mint_to(
        accounts
            .as_mint_stable_coin_context()
            .with_signer(&[&pda_seeds[..]]),
        stable_coin_amount_to_mint,
    )?;

    // if the collateral token is base, then we want Bid because that swaps
    // quote into base
    let side = if accounts.base_token_vault.mint
        == accounts.borrower_collateral_wallet.mint
    {
        borrow_lending::models::aldrin_amm::Side::Bid
    } else {
        borrow_lending::models::aldrin_amm::Side::Ask
    };
    SwapCpi::from(&accounts).swap(
        stable_coin_amount_to_mint,
        min_swap_return,
        side.is_ask(),
    )?;

    // read collateral amount in freeze wallet after the swaps
    accounts.borrower_collateral_wallet.reload()?;
    let final_borrower_collateral = accounts.borrower_collateral_wallet.amount;
    // how much collateral was added to the freeze wallet
    let collateral_gained = final_borrower_collateral
        .checked_sub(initial_borrower_collateral)
        .ok_or(ErrorCode::MathOverflow)?;
    // add this amount to the receipt
    accounts.receipt.collateral_amount = accounts
        .receipt
        .collateral_amount
        .checked_add(collateral_gained)
        .ok_or(ErrorCode::MathOverflow)?;
    // and finally transfer it to freeze wallet
    token::transfer(
        accounts.as_swapped_collateral_to_freeze_wallet_context(),
        collateral_gained,
    )?;

    let token_market_price = accounts
        .component
        .smallest_unit_market_price(&accounts.reserve)?;
    // This shouldn't be necessary because the max collateral ratio
    // prevents the user from borrowing more than they can, and the funds never
    // end up in their wallet.
    // It's a nice sanity check tho and can prevent future bugs.
    if accounts.receipt.is_healthy(
        token_market_price,
        accounts.component.config.max_collateral_ratio.into(),
    )? {
        Ok(())
    } else {
        msg!("Cannot leverage because position would become unhealthy");
        Err(ErrorCode::BorrowTooLarge.into())
    }
}

impl<'info> LeverageOnAldrinAmm<'info> {
    pub fn as_mint_stable_coin_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        let cpi_accounts = token::MintTo {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.borrower_stable_coin_wallet.to_account_info(),
            authority: self.stable_coin_pda.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_swapped_collateral_to_freeze_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_collateral_wallet.to_account_info(),
            to: self.freeze_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

impl<'info> From<&&mut LeverageOnAldrinAmm<'info>> for SwapCpi<'info> {
    fn from(a: &&mut LeverageOnAldrinAmm<'info>) -> Self {
        let stable_coin_wallet =
            a.borrower_stable_coin_wallet.to_account_info();
        let col_wallet = a.borrower_collateral_wallet.to_account_info();
        let (user_base_wallet, user_quote_wallet) =
            if a.base_token_vault.mint == a.borrower_collateral_wallet.mint {
                (col_wallet, stable_coin_wallet)
            } else {
                (stable_coin_wallet, col_wallet)
            };

        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            pool_signer: a.pool_signer.to_account_info(),
            pool_mint: a.pool_mint.to_account_info(),
            fee_pool_wallet: a.fee_pool_wallet.to_account_info(),
            base_token_vault: a.base_token_vault.to_account_info(),
            quote_token_vault: a.quote_token_vault.to_account_info(),
            user_base_wallet: user_base_wallet,
            user_quote_wallet: user_quote_wallet,
            user: a.borrower.to_account_info(),
            token_program: a.token_program.to_account_info(),
        }
    }
}
