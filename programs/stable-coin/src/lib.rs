mod endpoints;
mod models;
mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("9oiokTQXJSgbzLcmvsGXMvw8SM2a6vRTnthYhRycnP18");

#[program]
pub mod stable_coin {
    use super::*;

    pub fn test(
        ctx: Context<Test>,
    ) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Test<'info> {
    pub acc: Account<'info, Reserve>,
}
