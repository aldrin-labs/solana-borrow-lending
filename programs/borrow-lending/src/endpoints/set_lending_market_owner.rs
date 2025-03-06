use crate::prelude::*;

#[derive(Accounts)]
pub struct SetLendingMarketOwner<'info> {
    pub owner: Signer<'info>,
    /// CHECK: UNSAFE_CODES.md#signer
    pub new_owner: AccountInfo<'info>,
    #[account(mut, has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(ctx: Context<SetLendingMarketOwner>) -> Result<()> {
    let accounts = ctx.accounts;

    accounts.lending_market.owner = accounts.new_owner.key();

    Ok(())
}
