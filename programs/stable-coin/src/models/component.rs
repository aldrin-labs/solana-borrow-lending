use crate::prelude::*;

/// Represents a token and associates it with configuration. Against this token
/// users can borrow the stable coin. That is, users deposit their component
/// token mint and are minted stable coin.
#[account]
pub struct Component {
    /// Which stable coin root state does this component connect to.
    pub stable_coin: Pubkey,
    /// The mint of the token used as collateral.
    pub mint: Pubkey,
    /// The pubkey of the borrow lending program's reserve. We use this to get
    /// the current USD price (assuming the UAC is USD).
    pub blp_reserve: Pubkey,
    /// Where we store the tokens deposited as collateral. From here they're
    /// withdrawn on repay or liquidation.
    pub freeze_wallet: Pubkey,
    pub config: ComponentConfiguration,
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Default,
    Debug,
    Copy,
    Clone,
    PartialEq,
    Eq,
)]
pub struct ComponentConfiguration {
    /// Maximum amount of stable coin borrowed against the given amount of
    /// collateral is scaled down by this ratio. It must be in (0; 100].
    pub max_collateral_ratio: SDecimal,
    /// APR interest
    pub interest: SDecimal,
    /// The percentage that's taken from the borrower based on how much stable
    /// coin they want.
    pub borrow_fee: SDecimal,
    /// Percentage bonus on borrower's collateral that the liquidators get.
    pub liquidation_fee: SDecimal,
    /// How many more stable coin tokens can be minted with the collateral of
    /// this component.
    ///
    /// The admin can change this allowance at will, e.g. set it to 0 to
    /// disable any further minting. When a user repays their loan and
    /// withdraws their collateral, this gets increased.
    pub mint_allowance: u64,
}

impl Component {
    /// The component might represent either the liquidity mint, in which case
    /// the market price per component token is the liquidity market price,
    /// or the collateral token mint, in which case we need to first get an
    /// exchange ration from 1 collateral token to X liquidity tokens and then
    /// multiply by the liquidity market price.
    pub fn market_price(
        &self,
        reserve: &borrow_lending::models::Reserve,
    ) -> Result<Decimal> {
        if reserve.liquidity.mint == self.mint {
            Ok(reserve.liquidity.market_price.into())
        } else if reserve.collateral.mint == self.mint {
            let liquidity_amount = reserve
                .collateral_exchange_rate()
                .and_then(|rate| {
                    // since market price is per 1 token of the mint, we want
                    // 1 collateral to X liquidity
                    rate.decimal_collateral_to_liquidity(1u64.into())
                })
                .map_err(Error::from)?;
            liquidity_amount
                .try_mul(reserve.liquidity.market_price.to_dec())
                .map_err(From::from)
        } else {
            msg!(
                "Provided reserve's liquidity ({}) nor collateral ({}) mints \
                match components mint ({})",
                reserve.liquidity.mint,
                reserve.collateral.mint,
                self.mint
            );
            todo!()
        }
    }
}
