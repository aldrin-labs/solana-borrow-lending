use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

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
    #[account(mut)]
    pub freeze_wallet: Account<'info, TokenAccount>,
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
    /// Mint tokens in here, but all of them will be used to swap, so in the
    /// end the amount should not change.
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<LeverageOnAldrinAmm>,
    stable_coin_bump_seed: u8,
    leverage: SDecimal,
    initial_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let stable_coin_amount_to_mint: u64 =
        todo!("calculate how much stable coin to mint");

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

    let initial_freeze_wallet_collateral = accounts.freeze_wallet.amount;

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

    // TODO: swap stable coin into collateral

    // read collateral amount in freeze wallet after the swaps
    accounts.freeze_wallet.reload()?;
    let final_freeze_wallet_collateral = accounts.freeze_wallet.amount;
    // how much collateral was added to the freeze wallet
    let collateral_gained = final_freeze_wallet_collateral
        .checked_sub(initial_freeze_wallet_collateral)
        .ok_or(ErrorCode::MathOverflow)?;
    // add this amount to the receipt
    accounts.receipt.collateral_amount = accounts
        .receipt
        .collateral_amount
        .checked_add(collateral_gained)
        .ok_or(ErrorCode::MathOverflow)?;

    let token_market_price = accounts
        .component
        .smallest_unit_market_price(&accounts.reserve)?;
    if !accounts.receipt.is_healthy(
        token_market_price,
        accounts.component.config.max_collateral_ratio.into(),
    )? {
        msg!("Cannot leverage because position would become unhealthy");
        return Err(ErrorCode::BorrowTooLarge.into());
    }

    Ok(())
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
}
