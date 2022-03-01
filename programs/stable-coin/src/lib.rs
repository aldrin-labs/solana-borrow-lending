mod endpoints;
mod models;
mod prelude;

use endpoints::*;
use prelude::*;

declare_id!("9oiokTQXJSgbzLcmvsGXMvw8SM2a6vRTnthYhRycnP18");

#[program]
pub mod stable_coin {
    use super::*;

    pub fn init_stable_coin(ctx: Context<InitStableCoin>) -> ProgramResult {
        endpoints::init_stable_coin::handle(ctx)
    }
}
