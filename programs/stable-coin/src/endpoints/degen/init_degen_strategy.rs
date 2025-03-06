use crate::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
#[instruction(degen_strategy_bump_seed: u8)]
pub struct InitDegenStrategy<'info> {
    pub admin: Signer<'info>,
    #[account(
        constraint = stable_coin.admin == admin.key() @ err::admin_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(zero)]
    pub degen_strategy: Account<'info, DegenStrategy>,
    #[account(
        constraint = ust_wallet.owner == degen_strategy_pda.key()
            @ err::acc("UST wallet owner must be a PDA"),
        constraint = ust_wallet.mint == consts::UST_MINT
            @ err::acc("UST wallet mint must be UST mint"),
        constraint = ust_wallet.close_authority.is_none()
            @ err::acc("UST wallet mustn't have a close authority"),
    )]
    pub ust_wallet: Box<Account<'info, TokenAccount>>,
    /// The owner of wallets associated with this component.
    #[account(
        seeds = [degen_strategy.to_account_info().key.as_ref()],
        bump = degen_strategy_bump_seed,
    )]
    pub degen_strategy_pda: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<InitDegenStrategy>,
    _degen_strategy_bump_seed: u8,
    aust_ratio: SDecimal,
    max_leverage: SDecimal,
    earned_interest_penalty: SDecimal,
) -> Result<()> {
    let accounts = ctx.accounts;

    accounts.degen_strategy.ust_wallet = accounts.ust_wallet.key();
    accounts.degen_strategy.admin = accounts.admin.key();
    accounts.degen_strategy.stable_coin = accounts.stable_coin.key();
    accounts.degen_strategy.aust_ratio = aust_ratio;
    accounts.degen_strategy.max_leverage = max_leverage;
    accounts.degen_strategy.earned_interest_penalty = earned_interest_penalty;

    Ok(())
}
