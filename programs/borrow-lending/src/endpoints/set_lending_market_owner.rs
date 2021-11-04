use crate::prelude::*;

#[derive(Accounts)]
pub struct SetLendingMarketOwner<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    pub new_owner: AccountInfo<'info>,
    #[account(mut, has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(ctx: Context<SetLendingMarketOwner>) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.lending_market.owner = accounts.new_owner.key();

    Ok(())
}
