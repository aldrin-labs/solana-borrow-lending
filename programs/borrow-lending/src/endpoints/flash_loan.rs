//! To use the flash loan endpoint, one can provide additional data and accounts
//! which will be passed to a target program. The target program is the program
//! called by BLp after depositing requested funds into the user's wallet. The
//! data which are passed into the target program starts at 9th byte (0th byte
//! is bump seed, 1st - 8th is [`u64`] liquidity amount). BLp doesn't pass any
//! accounts by default, all must be specified as remaining accounts.
//!
//! By default, flash loans are disabled. Use the
//! [`crate::endpoints::toggle_flash_loans`] endpoint to enable it.

use crate::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke};
use anchor_spl::token::{self, Token, TokenAccount};
use std::mem;

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct FlashLoan<'info> {
    #[account(
        constraint = reserve.lending_market == lending_market.key()
            @ err::market_mismatch(),
        constraint = lending_market.enable_flash_loans
            @ err::flash_loans_disabled(),
    )]
    pub lending_market: Account<'info, LendingMarket>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        constraint = source_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Source liq. wallet must eq. reserve's liq. supply"),
    )]
    pub source_liquidity_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination_liquidity_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = fee_receiver.key() == reserve.liquidity.fee_receiver
            @ err::acc("Fee receiver doesn't match reserve's config"),
    )]
    pub fee_receiver: AccountInfo<'info>,
    #[account(executable)]
    pub target_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<FlashLoan>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    target_data_prefix: Vec<u8>,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if liquidity_amount == 0 {
        msg!("Liquidity amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    // The following condition in conjunction with the re-entrancy rule
    // guarantees that BLp cannot be called again between this point and end
    // of this flash loan action. This is a powerful constraint diminishing the
    // flash loan attack vector space.
    //
    // https://docs.solana.com/developing/programming-model/calling-between-programs#reentrancy
    if ctx.program_id == &accounts.target_program.key() {
        msg!(
            "Lending program cannot be used as the flash loan \
            receiver program provided"
        );
        return Err(ErrorCode::InvalidFlashLoanTargetProgram.into());
    }

    let flash_loan_amount = Decimal::from(liquidity_amount);
    let fee = accounts
        .reserve
        .config
        .fees
        .flash_loan_fee(flash_loan_amount)?;

    let balance_before_flash_loan = accounts.source_liquidity_wallet.amount;
    let expected_balance_after_flash_loan = balance_before_flash_loan
        .checked_add(fee)
        .ok_or(ErrorCode::MathOverflow)?;
    let returned_amount_required = liquidity_amount
        .checked_add(fee)
        .ok_or(ErrorCode::MathOverflow)?;

    accounts.reserve.liquidity.borrow(flash_loan_amount)?;

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::transfer(
        accounts
            .as_flash_loan_context()
            .with_signer(&[&pda_seeds[..]]),
        liquidity_amount,
    )?;

    let mut flash_loan_instruction_accounts = vec![];
    let mut flash_loan_instruction_account_infos = vec![];
    for account_info in ctx.remaining_accounts {
        flash_loan_instruction_accounts.push(AccountMeta {
            pubkey: *account_info.key,
            is_signer: account_info.is_signer,
            is_writable: account_info.is_writable,
        });
        flash_loan_instruction_account_infos.push(account_info.clone());
    }

    let mut data =
        Vec::with_capacity(target_data_prefix.len() + mem::size_of::<u64>());
    data.extend_from_slice(&target_data_prefix);
    data.extend_from_slice(&returned_amount_required.to_le_bytes());

    invoke(
        &Instruction {
            program_id: accounts.target_program.key(),
            accounts: flash_loan_instruction_accounts,
            data,
        },
        &flash_loan_instruction_account_infos[..],
    )?;

    // Refreshing reserve is not necessary as the borrow lending program cannot
    // be executed in the CPI. And since the borrow lending program is the only
    // authority which could edit the reserve's data, it follow that it cannot
    // have changed during the invocation.

    accounts
        .reserve
        .liquidity
        .repay(liquidity_amount, flash_loan_amount)?;

    // observe CPI transfer of funds
    accounts.source_liquidity_wallet.reload()?;

    let actual_balance_after_flash_loan =
        accounts.source_liquidity_wallet.amount;
    if actual_balance_after_flash_loan < expected_balance_after_flash_loan {
        msg!(
            "Insufficient reserve liquidity after flash loan, \
            expected {} but got {}",
            expected_balance_after_flash_loan,
            actual_balance_after_flash_loan
        );
        return Err(ProgramError::InsufficientFunds.into());
    }

    if fee > 0 {
        token::transfer(
            accounts
                .as_pay_flash_loan_fee_context()
                .with_signer(&[&pda_seeds[..]]),
            fee,
        )?;
    }

    Ok(())
}

impl<'info> FlashLoan<'info> {
    pub fn as_flash_loan_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.to_account_info(),
            to: self.destination_liquidity_wallet.to_account_info(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_flash_loan_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.to_account_info(),
            to: self.fee_receiver.to_account_info(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
