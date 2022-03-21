# Stable coin program

## Design

<details>
<summary markdown="span">
Diagram illustrating endpoints-accounts relationships
</summary>

![Overview of endpoints](docs/stable_coin_endpoints_accounts_relationship.png)

</details>

The admin inits new stable coin and then inits components, which are a way to
represent different token mints. A component is associated with BLp's reserve.
This allows us to use the oracle implementation from BLp without having to use
any of the oracle code. Another advantage is that we can use BLp's reserve
collateral mint for a component. It will be calculated with the exchange ratio
method on the reserve account.

A user first creates their own receipt for each different type of collateral
(component) they want to use to mint the stable coin. Then they deposit their
tokens into the program, them being transferred to a freeze wallet and the
receipt's collateral amount, and thereby allowance, increased.

User can borrow stable coin. The endpoint mints provided amount so long as the
receipt stays _healthy_, ie. the collateral market value scaled down by max
collateral ratio is larger than the loan.

Borrow fee is added and the whole amount undergoes interest accrual. The
interest is static and APR, that's why we store borrowed amount and interest
amount separately.

The user can then repay stable coin. The endpoint burns USP from user's wallet.
If partial repay is done, we first repay the interest and then the borrowed
amount.

In the end, the user can withdraw collateral as long as the receipt remains
healthy.


## Liquidation

The liquidator must liquidate the whole position at once, at the moment we
don't offer partial liquidation. The provide the program with USP, which is
burned, and in return receive collateral at a discounted market price. Part of
this additional collateral is transferred to a fee wallet owned by the admin.

### Example
Say a SOL component's receipt has deposited 4 SOL. Market price of SOL is $100.
The max collateral ratio is 90%. The user has borrowed $120 when the SOL market
price was more favorable. Now, their position is unhealthy.

The discounted market price is $87.5 (ie. liquidation bonus is 12.5%). The
position will be deducted $120/$87.5 ~= 1.37 SOL. Without the discount this
would be 1.2 SOL. The liquidator "wins" ~0.17 SOL. However, they must pay a
platform fee on this.

The liquidation acts as a repayment of sorts. At the end, the receipt will
contain ~2.63 SOL, the liquidator receives 0.153 SOL and the platform (us)
0.017 SOL (ie. liquidation fee is 10%).
