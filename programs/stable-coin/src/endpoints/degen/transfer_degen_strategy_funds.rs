use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(degen_strategy_bump_seed: u8)]
pub struct TransferDegenStrategyFunds<'info> {
    pub admin: Signer<'info>,
    #[account(
        constraint = degen_strategy.admin == admin.key()
            @ err::admin_mismatch(),
    )]
    pub degen_strategy: Account<'info, DegenStrategy>,
    /// The owner of wallets associated with this component.
    #[account(
        seeds = [degen_strategy.to_account_info().key.as_ref()],
        bump = degen_strategy_bump_seed,
    )]
    pub degen_strategy_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = ust_wallet.key() == degen_strategy.ust_wallet
            @ err::acc("UST wallet must match the one in the degen strategy"),
    )]
    pub ust_wallet: AccountInfo<'info>,
    /// Presumably wormhole's wallet which is used to bridge over funds
    #[account(mut)]
    pub target_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handle(
    ctx: Context<TransferDegenStrategyFunds>,
    degen_strategy_bump_seed: u8,
    amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let pda_seeds = &[
        &accounts.degen_strategy.key().to_bytes()[..],
        &[degen_strategy_bump_seed],
    ];
    token::transfer(
        accounts
            .as_transfer_degen_strategy_funds_context()
            .with_signer(&[&pda_seeds[..]]),
        amount,
    )?;

    Ok(())
}

impl<'info> TransferDegenStrategyFunds<'info> {
    pub fn as_transfer_degen_strategy_funds_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.ust_wallet.to_account_info(),
            to: self.target_wallet.to_account_info(),
            authority: self.degen_strategy_pda.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
