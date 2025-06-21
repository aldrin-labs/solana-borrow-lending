* Solana v1.7.17
* Anchor v0.24.2
* [Code coverage][project-code-coverage]
* [Rust docs][project-rust-docs]

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[🚀 Getting Started](#getting-started)** | Quick setup and first steps |
| **[📖 API Reference](docs/api-reference.md)** | Complete API documentation |
| **[🎓 User Tutorials](docs/user-tutorials.md)** | Step-by-step guides for common use cases |
| **[👨‍💻 Developer Guide](docs/developer-guide.md)** | Development setup and integration |
| **[🏗️ Architecture](docs/documentation.md)** | Comprehensive system documentation |
| **[USP docs](#usp)** | Stable coin program documentation |
| **[BLp docs](#borrow-lending)** | Borrow-lending program documentation |
| **[USP changelog][scp-changelog]** | Stable coin program changelog |
| **[BLp changelog][blp-changelog]** | Borrow-lending program changelog |

## 🚀 Getting Started

### For Users
1. **[User Tutorials](docs/user-tutorials.md)** - Learn how to lend, borrow, and manage positions
2. **[Common Use Cases](docs/user-tutorials.md#common-use-cases)** - Real-world examples

### For Developers
1. **[Developer Guide](docs/developer-guide.md)** - Environment setup and architecture
2. **[API Reference](docs/api-reference.md)** - Complete function reference
3. **[Integration Examples](docs/developer-guide.md#integration-examples)** - SDK usage patterns

### For Integrators
1. **[API Reference](docs/api-reference.md#typescript-sdk)** - TypeScript SDK documentation
2. **[CLI Commands](docs/api-reference.md#cli-commands)** - Command-line interface

# Borrow-lending

A decentralized lending platform on Solana where users can lend and borrow tokens with dynamic interest rates, collateralized positions, and advanced features like flash loans and leveraged yield farming.

## ⚡ Quick Start

```bash
# Clone and install
git clone https://github.com/aldrin-labs/solana-borrow-lending.git
cd solana-borrow-lending
yarn install

# For UI development (requires Node.js v20.x LTS)
cd ui
npm install --legacy-peer-deps

# Build
anchor build

# Test
anchor test
```

**New to the protocol?** Start with [User Tutorials](docs/user-tutorials.md)  
**Building an integration?** Check the [Developer Guide](docs/developer-guide.md)  
**Need API details?** See the [API Reference](docs/api-reference.md)

## Overview

A lending platform is a tool where users lend and borrow tokens. A user either
gets an interest on lent tokens or they get a loan and pay interest.

* When lending tokens a funder gets an interest on their tokens. The interest
  accumulates and they can withdraw it. (The interest is changing according to
  the different market conditions.)

* A borrower can only borrow a specific number of tokens. That's limited by the
  amount of lent tokens by that user. For example, they cannot borrow more than
  150% of their funded value as another tokens. The borrowing interest rate for
  each token is always higher than the lending interest rate.

### Example use case
Let's say Jimmy needs $3,000 for an emergency. He already has $6,000 in ETH.
Jimmy could use his ETH as collateral to borrow a stablecoin like USDC, that
way he can count on the value of his borrowed asset to be more stable when he
pays back the loan and he doesn't have to sell his ETH.

Even though he has to pay back the loan + interest, he is still earning
interest on his deposited collateral in the background too which helps to
balance it out more.

In our example, Jimmy used ETH as collateral since he thinks it will increase
in value and he doesn’t want to sell it. He borrowed USDC and used it to buy
assets that he thinks will also increase. If that happens he can pay back his
debt and still keep the ETH as well as keep some of the assets he borrowed as
profit.  Otherwise, he could just use the USDC to buy more ETH to "leverage" it
and increase his profit.  Or he could just use the money for an emergency and
pay it back when ETH is higher so he would sell less of his ETH to pay his debt
then.

Overall, stablecoins are mostly used for borrowing, while volatile assets which
users are long on are mostly used as collateral. Hence, the users of the
protocol still gain great benefits from the addition of these stablecoins.

## Design

<details>
<summary markdown="span">
Diagram illustrating endpoints-accounts relationships
</summary>

![Overview of endpoints](docs/endpoints_accounts_relationship.png)

</details>

The Borrow-Lending program (BLp) is a set of actions (endpoints) each belonging
to one of 4 permission levels. BLp operates on 3 kinds of owned accounts, 2
kinds of oracle accounts and 2 kinds of token accounts.

The permission levels are: _(i)_ market owner who controls what assets
(reserves) are available to borrow and various configuration such as fees,
interest rates, etc; _(ii)_ funder who deposits liquidity into one or more of
market's reserves; _(iii)_ borrower who collateralizes their assets in exchange
for another; _(iv)_ public, i.e. anyone can call a public action without
signing the transaction.

The owned accounts are: _(i)_ lending market which is a "root" account in the
sense that all other accounts reference it. Created and owned by the market
owner permission level. It contains information about the _universal asset
currency_ (UAC) which serves as a common denominator when appreciating
liquidities.  All reserves must use token for which the oracle has market
price. An example of UAC is USD. _(ii)_ Reserve which is a token listing. By
adding reserves to a market we allow funders to deposit their liquidity and
borrowers to then borrow this liquidity.  Reserve is associated with some
external liquidity token mint and owns a token wallet of that liquidity mint.
Reserve creates its own mint for collateral and owns a token wallet of that
collateral mint. _(iii)_ Obligation which is a borrower's receipt about what
assets they deposited as collateral and what assets they borrowed. The market
value in UAC is periodically recalculated in a public action.

The oracle accounts maintained by [Pyth][pyth-network] are: _(i)_ product
settings which holds basic information about two currencies, one of which is
UAC and the other reserve token mint. In itself not very important account.
_(ii)_ Exchange price which is frequently updated by the oracle program. For
example, should the market owner add a reserve SRM, then the oracle provides
[information about SRM/USD price][pyth-srm-usd].

The token accounts are: _(i)_ mint some of which are owned by the BLp (reserve
collateral) and some of which are referenced only via pubkey (liquidity);
_(ii)_ wallet which are used to transfer and hold funds.

Let's have a look at BLp from the user's perspective.

A funder deposits reserve liquidity by transferring tokens from their source
wallet to the reserve's supply wallet which holds funds of all funders
together. In return, BLp mints appropriate amount of reserve's collateral
tokens into funder's destination collateral wallet. The exchange rate between
liquidity and collateral starts at 1:5 when no collateral is minted, and given
by [eq. (2)](#equations) when the circulating amount of collateral is not 0.
Because borrowers pay interest on their loans, the amount of liquidity in the
reserve's supply wallet increases which makes the ratio more favorable for the
minted collateral. Eventually, the funder redeems their minted collateral for
more liquidity than they deposited. BLp burns the redeemed collateral tokens.

A user becomes a borrower upon creating a new obligation account. In order to
borrow the obligation collateral market value in UAC must be higher (by a
configurable percentage) than the obligation liquidity market value in UAC. In
order to deposit collateral to the obligation, the borrower must first obtain a
collateral token of one of available reserves listed for the market. The most
straightforward way to obtain some collateral token is to become a funder. In
short, a borrower funds liquidity A for which they receive collateral A'. They
deposit A' to the obligation and then they can borrow liquidity B. The borrower
is able to withdraw A' as long as they deposit yet another collateral or repay
B.

A liquidator is a user who actions on under-collateralized obligations. It's a
public action, therefore any block-chain user can be a liquidator. Not the
whole obligation can be liquidated at once. With each liquidation call only
half of the obligation is liquidated in such a manner that the market value of
collateral approaches market value of liquidity plus the necessary
over-collateralized percentage. The liquidator pays a liquidity which is
borrowed by an obligation and receives collateral in exchange. To make this
profitable for the liquidator, the market price of the liquidity is multiplied
by a liquidation bonus configurable value. In another words, the liquidator
seeks an unhealthy obligation and picks a borrow reserve and a collateral
reserve from this obligation. They repay the borrow reserve's liquidity token
and receive a collateral token at a discounted price.

Not all of obligation's value can be liquidated at once. The [eq.
(8)](#equations) sets a limit on how much of the obligation's borrow value can
be liquidated at once.


### Flash loan
Flash Loans are special uncollateralised loans that allow the borrowing of an
asset, as long as the borrowed amount (and a fee) is returned before the end of
the transaction. There is no real world analogy to Flash Loans, so it requires
some basic understanding of how state is managed within blocks in blockchains.
(Source: [Aave dev docs][aave-flash-loans])

Flash loans are frequent target of vulnerabilities, for example [the
CREAM attack][podcast-coinsec-ep-46].

To use the flash loan endpoint, one can provide additional data and accounts
which will be passed to a target program. The target program is the program
called by BLp after depositing requested funds into the user's wallet.

The data which are passed into the target program starts at 9th byte (0th byte
is bump seed, 1st - 8th is `u64` liquidity amount).

BLp doesn't pass any accounts by default, all must be specified as
additional/remaining accounts.

```typescript
program.rpc.flashLoan(
  lendingMarketBumpSeed,
  new BN(liquidityAmountToBorrow),
  bufferWhichWillBePassedIntoTheTargetProgram,
  {
    accounts: { ... },
    remainingAccounts: [
      // ... list of accounts which will be passed to the target program
    ],
    ...
  }
);
```

Flash loans are disabled by default. A market owner can toggle the flash loan
feature on and off. This is useful in case we need swift reaction to a
vulnerability.

### Reserve configuration
When market owner creates a reserve, they supply configuration with (not only)
following information:


* `optimal_utilization_rate` is $`R^*_u`$.
Utilization rate is an indicator of the availability of capital in the pool.
The interest rate model is used to manage liquidity risk through user
incentivizes to support liquidity:

    * When capital is available: low interest rates to encourage loans.
    * When capital is scarce: high interest rates to encourage repayments of
      loans and additional deposits.

Liquidity risk materializes when utilization is high, its becomes more
problematic as  gets closer to 100%. To tailor the model to this constraint,
the interest rate curve is split in two parts around an optimal utilization
rate. Before the slope is small, after it starts rising sharply. See eq. (3)
for more information.

* `optimal_borrow_rate` is $`R^*_b`$, see below;

* `loan_to_value_ratio` is the ratio between the maximum allowed borrow value
  and the collateral value. Set to 0 to disable use as a collateral.

Say that a user deposit 100 USD worth of SOL, according to the currently LTV of
85% for Solana the users are able to borrow up to 85 USD worth of assets.

* `liquidation_threshold` is an unhealthy loan to value ratio at which an
obligation can be liquidated.

In another words, liquidation threshold is the ratio between borrow amount and
the collateral value at which the users are subject to liquidation.

Say that a user deposit 100 USD worth of SOL and borrow 85 USD worth of assets,
according to the currently liquidation threshold of 90%, the user is subject to
liquidation if the value of the assets that they borrow has increased 90 USD.
Liquidation threshold is always greater than `loan_to_value_ratio`.

* `liquidation_bonus` is a bonus a liquidator gets when repaying part of an
  unhealthy obligation.

If the user has put in 100 USD worth of SOL and borrow 85 USD. If the value of
the borrowed asset has reached 90 USD. The liquidator can comes in and pay 50
USD worth of SOL and it will be able to get back `50 * (1 + 2%) = 51` USD worth
of SOL.

* `min_borrow_rate` is $`R_{minb}`$, see below;

* `max_borrow_rate` is $`R_{maxb}`$, see below;

#### Fees
Upon calling the borrow action the caller can provide up to two wallets which
are used for fee collection.

The main fee receiver wallet is mandatory and its pubkey is configured on
reserve's initialization. When liquidity is borrowed this wallet receives a
fraction of that borrow defined by `borrow_fee` reserve configuration
percentage value.

An optional host fee receiver wallet is defined as a remaining account and can
be any valid borrowed liquidity wallet (pubkey not conditioned by reserve's
config). If provided it receives a fraction of the borrow defined by `host_fee`
reserve configuration percentage value.

The minimum fee is 1 liquidity token's smallest divisible part (e.g. 1 sat for
XBT).

### Borrow rate
Borrow rate ($`R_b`$) is a key concept for interest calculation.  When $`R_u <
R^*_u`$, the rate increases slowly with utilization. Otherwise the borrow
interest rate increases sharply to incentivize more deposit and avoid liquidity
risk. See the [Aave borrow interest rate documentation][aave-borrow-rate] for
more information. We use the same interest rate curve. [This
article][aave-borrow-rate-2] does also a good job explaining the pros of the
model.

<details>
<summary markdown="span">Model for borrow rate calculation (eq. 3)</summary>

[![Desmos borrow lending view](docs/borrow_rate_model.png)][desmos-borrow-rate]

_Legend_: subscript `o` in the image means optimal while in this document we
use superscript `*`; the x axis represents $`R_u`$.

</details>

### Health factor
Health factor is the numeric representation of the safety of your deposited
assets against the borrowed assets and its underlying value.  The higher the
factor is, the safer the state of your funds are against a liquidation
scenario.

Depending on the value fluctuation of your deposits, the health factor will
increase or decrease. If your health factor increases, it will improve your
borrow position by making the liquidation threshold more unlikely to be
reached. In the case that the value of your collateralized assets against the
borrowed assets decreases instead, the health factor is also reduced, causing
the risk of liquidation to increase.

There is no fixed time period to pay back the loan. As long as your position is
safe, you can borrow for an undefined period. However, as time passes, the
accrued interest will grow making your health factor decrease, which might
result in your deposited assets becoming more likely to be liquidated.

We calculate unhealthy borrow value which is similar to the health factor. See
[eq. (9)](#equations) for the formula. Once an obligation borrow value exceeds
$`V_u`$, it is eligible for liquidation.


<details>
<summary markdown="span">Liquidation process chart</summary>

[![Chart showing the liquidation process](docs/liquidation.jpg)][aave-risk-params]

</details>


### Leverage yield farming
Also referred to as L-Farming, LYF or leveraged position, is a special type of
borrow enabled by staking algorithms of AMMs. A user can perform borrow
undercollateralized borrow because BLp makes sure the borrowed funds are
deposited into AMM and never touch a user's wallet. A leverage is a ratio of
total loan to the collateralized part. With e.g. 3x leverage, a user can borrow
300 USD with only 100 USD worth of collateral.

A leveraged position can be repaid using the same endpoint as vanilla loan. The
liquidation endpoint also works for a leveraged position. There are 3 endpoints
for LYF:
1. `open` creates a new position. A user can borrow either base or quote
   currency and then has an option to swap one into another, or provide their
   own funds to the position. We track only the loan, as when they close the
   position all extra funds besides the loan are left to the borrower.
2. `close` unstakes LP tokens and with swaps ends up only with tokens of the
   mint of the reserve which the loan was opened for. If we _opened_ the
   position with loan of 1 BTC and swapped half of them into ETH, then on
   _closing_ the ETH would be swapped back into BTC and loan repaid. Usually,
   this endpoint has to be called by the borrower. However, in a pathological
   case of liquidation where the borrower has no more collateral of any kind in
   their obligation, this endpoint can be called by anyone as it works like
   liquidation.
3. `compound` harvests farmed tokens of an AMM's farming ticket. It calculates
   the price of those harvested token because the caller must provide a reserve
   of this mint with a valid oracle. Then it calculates the price of an LP
   token of the AMM's pool that's being farmed. Then it stakes appropriate
   amount of LP tokens in a new farming ticket, and leaves the harvested
   rewards in the caller's wallet. Only Aldrin's compound bot is allowed to
   call this endpoint.

To summarize, the first part of the liquidation process works the same way as
with vanilla BL. The second part, once there is nothing more to liquidate, is
to call the `close` endpoint as a liquidator.

To get an overview of all open leveraged positions, search the blockchain for
accounts of type `FarmingReceipt` owned by the BLp. This type contains
additional information such as leverage, borrow reserve and obligation.

At the moment, we only work with Aldrin's AMM. However, plan is to support
other platforms, such as Orca, in future.

#### PDA
The AMM's APIs allow us to set authority over a farming ticket which relates
the staked funds to an owner. The authority we set is a PDA with 4 seeds:
lending market pubkey, borrowed reserve pubkey, obligation pubkey and leverage
`u64` as 8 little-endian bytes.

We have the lending market in the seed to not conflate them. We have the
obligation in the seed to know which borrower has access to the farming ticket.
We have the reserve in the seed to know which resource was lent to stake the
LPs. We have the leverage in the seed because that uniquely identifies loans.

Without the leverage info a user could create two leveraged position in the
same reserve, one small and other large. And then close the small position with
the farming ticket from the large one, thereby running away with the
difference. Using this PDA helps us associate the specific loan
([`ObligationLiquidity`]) exactly.

### Emissions
Emissions, also known as liquidity farming/mining, is a feature which allows
lenders and borrowers to claim extra rewards on their positions in the form of
tokens. A market owner creates a new emission strategy and configures which
tokens will be emitted over time, how many tokens per second for lenders and
how many for borrowers. They must provide wallets with enough funds, or
transfer funds over time into the wallets. The wallets are taken from their
authority under the programs PDA and then when the strategy ends (configurable
during the creation) the market owner gets the ownership of those wallets back.

An emission strategy is always tied to a reserve. We keep track of how much can
a user claim with an obligation's field `emissions_claimable_from_slot`. Each
loan or deposit has this field. It's updated to current slot on deposit or loan
for a particular position. This implies that e.g. if a user borrowed USDC and
wants to borrow it again after a day, they must claim their rewards first,
otherwise they lose them, because the field will be updated to latest slot.

When claiming rewards, the user must provide wallets in the same order as
defined in the strategy account, as remaining accounts. For example, if
emission is from mints A, B and C, then 6 wallets are at play. 3 wallets owner
by the borrower into which emissions are transferred, and 3 wallets defined in
the strategy account owned by the PDA that tokens are transferred from. So,
in this example, remaining accounts would be an array of 6 accounts:
1. emission supply wallet A
2. borrower wallet A
3. emission supply wallet B
4. borrower wallet B
5. emission supply wallet C
6. borrower wallet C

To distribute more fairly, we periodically take reserve snapshots with admin
bot and store them into `ReserveCapSnapshots` account associated with a reserve.
Using the information on when a user last claimed their emissions, we average
over deposit/borrowed amount since then to calculate their current share.

### Refreshing reserves and obligations
Before performing most obligation actions, you must refresh the obligation,
which accrues interest on loans. In order to refresh an obligation, all the
reserves which concern it (as loans or deposits) must be refreshed too. This
guarantees latest market prices and interest accrual. Some endpoints have
constraint for obligation or reserve staleness, which means they require the
refresh.

The leverage yield farming feature is a bit of an outlier. We allow extra
generous refresh there. That is because the funds never reach the user, but at
the same time we are limited by the transaction size and cannot provide many
additional accounts.



# USP

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

## Leverage
We have action for following otherwise laborious process:
1. user deposits collateral
2. user borrows USP
3. user swaps USP into USDC
4. user swaps USDC into collateral
5. user goes back to step 1.

The process above can be repeated by the user several times, depending on
what's the maximum collateral ratio for the component. The
`leverage_via_aldrin_amm` endpoint calculates how much USP would be minted for
how much collateral, and performs all of the above in a single instruction.

The user gives us collateral ratio at which they want to perform this
operation, where maximum they can provide is the maximum set in the component's
config. The closer to the configured maximum, the higher is the risk of
liquidation for the user. Second argument is the initial amount. The user must
already have deposited enough collateral to cover the initial amount. The user
also provides slippage information for both swaps.



# Equations
Search for `ref. eq. (x)` to find an equation _x_ in the codebase.

| Symbol       | Description |
|---           |--- |
| $`L_b`$      | total borrowed liquidity (of reserve or obligation) |
| $`L_s`$      | total deposited liquidity supply |
| $`L_o`$      | borrowed liquidity for obligation |
| $`L_v`$      | UAC value of borrowed liquidity |
| $`L_{maxl}`$ | maximum liquidity amount to liquidate |
| $`C_s`$      | total minted collateral supply |
| $`C_d`$      | deposited collateral |
| $`S_e`$      | elapsed slots |
| $`S_a`$      | number of slots in a calendar year |
| $`R_u`$      | utilization rate |
| $`R_x`$      | exchange rate |
| $`R_b`$      | borrow rate/APY |
| $`R_d`$      | deposit rate/APY |
| $`R_c`$      | cumulative borrow rate |
| $`R_i`$      | compound interest rate |
| $`R^*_u`$    | optimal utilization rate (configurable) |
| $`R^*_b`$    | optimal borrow rate (configurable) |
| $`R_{minb}`$ | minimum $`R_b`$ (configurable) |
| $`R_{maxb}`$ | maximum $`R_b`$ (configurable) |
| $`V_d`$      | UAC value of deposited collateral |
| $`V_b`$      | UAC value of borrowed liquidity |
| $`V_u`$      | unhealthy borrow value |
| $`V_{maxw}`$ | maximum withdrawable UAC value |
| $`V_{maxb}`$ | maximum borrowable UAC value (against deposited collateral) |
| $`E`$        | emission tokens which a user can claim |
| $`\omega`$   | emitted tokens per slot |
| $`\kappa`$   | constant liquidity close factor |
| $`\epsilon`$ | liquidation threshold in \[0; 1) |
| $`\phi`$     | leverage |


⌐

```math
R_u = \dfrac{L_b}{L_s}
\tag{1}
```

⊢

Exchange rate is simply ratio of collateral to liquidity in the supply. However,
if there's no liquidity or collateral in the supply, the ratio defaults to a
compiled-in value.

```math
R_x = \dfrac{C_s}{L_s}
\tag{2}
```

⊢

See the docs in [borrow rate section](#borrow-rate).

```math
R_b =
\begin{cases}
    \dfrac{R_u}{R^*_u} (R^*_b - R_{minb}) + R_{minb},
    & \text{if } R_u < R^*_u\\[3.5ex]
    \dfrac{R_u - R^*_u}{1 - R^*_u} (R_{maxb} - R^*_b) + R^*_b,
    & \text{otherwise}
\end{cases}
\tag{3}
```

⊢

We define the compound interest period to equal one slot. To get the `i`
parameter of the standard [compound interest formula][compound-interest-formula]
we divide borrow rate by the number of slots per year:

```math
R_i = (1 + \dfrac{R_b}{S_a})^{S_e}
\tag{4}
```

⊢

Once per slot we update the liquidity supply with interest rate:

```math
L^{'}_s = L_s R_i
\tag{5}
```

⊢

Eq. (6) describes how interest accrues on borrowed liquidity. $`R^{'}_c`$ is
the latest cum. borrow rate at time of update while $`R_c`$ is the cum. borrow
rate at time of last interest accrual.

```math
L^{'}_o = \dfrac{R^{'}_c}{R_c} L_o
\tag{6}
```

⊢

Maximum UAC value to withdraw from an obligation is given by a ratio of
borrowed value to maximum allowed borrow value:

```math
V_{maxw} = V_d - \dfrac{V_b}{V_{maxb}} V_d
\tag{7}
```

⊢

Eq. (8) gives us maximum liquidation amount of liquidity which a liquidator
cannot go over. (Although they can liquidate less than that.) The close factor
$`κ`$ is 50% (compiled into the program) and puts a limit on how much borrowed
value can be liquidated at once.

```math
L_{maxl} = \dfrac{\min\{V_b * \kappa, L_v\}}{L_v} L_b
\tag{8}
```

⊢

Calculates obligation's unhealthy borrow value by summing over each borrowed
reserve. See the [health factor docs](#health-factor).

```math
V_u = \sum C^r_b \epsilon^r
\tag{9}
```

⊢

Supply APY is derived from the borrow rate by scaling it down by utilization
rate:

```math
R_d = R_u R_b
\tag{10}
```

⊢

Emission are distributed between the users based on their share in a particular
reserve's pool. Following equations differ by parameters and are for borrowers
and lenders respectively:

```math
E = \omega^{b} S_e \dfrac{L^{u}_b}{L^{r}_b}
\tag{11}
```

```math
E = \omega^{s} S_e \dfrac{L^{u}_s}{L^{r}_s}
\tag{12}
```

⊢

The leverage is a number which multiplies the initial user's deposit to find
the end amount of USP which will be minted, added to user's borrow amount and
then swapped into collateral.
```math
\phi_{max} = \dfrac{1 - V_{maxb}^30}{1 - V_{maxb}}
\tag{13}
```

⌙

# Commands
Use following anchor command to build the `borrow-lending` program:

```
anchor build
```

To install test npm dependencies, use `$ yarn`.

Use testing script to build dependencies for testing (such as `shmem`)
and run the tests:

```
./bin/test.sh [--detach] [--skip-build]
```

When debugging or working on a new feature, use
[mocha's `only`][mocha-exclusive-tests] functionality to avoid running all tests
every time.

To generate unit test code coverage which can then be accessed at
`target/debug/coverage/index.html` (requires nightly):

```
./bin/codecov.sh
```


# CLI
To ease BLp setup on devnet and mainnet, this repository provides a simple CLI
which can be configured to call actions on the chain.

First, you must build the CLI binary. (You will need to have `libssl-dev` and
`libudev-dev` installed.)

```
cargo build --bin cli --release
```

Then you can either setup an .env file by cloning and editing the example:

```
cp cli/.env.example .env
```

or you can view help for command line configuration options:

```
./target/release/cli help
```

A handy command to generate new keypair for setting up new accounts:

```
solana-keygen new -o [file-name].json
```

To try the CLI locally you run the test ledger and configure localnet either
with `--cluster` flag or `CLUSTER` environment variable.

```
solana-test-validator
```

For example, after creating necessary keypairs and setting up .env, one can
create a new lending market with:

```
./target/release/cli init-market \
  --keypair market-keypair.json \
  --owner owner-keypair.json \
  --usd
```


# PDA and bump seed
To obtain bump seed and PDA for a specific market, you can use following method
on the web3's `PublicKey` type:

```typescript
const [lendingMarketPda, lendingMarketBumpSeed] =
  await PublicKey.findProgramAddress(
    [Buffer.from(lendingMarketPublicKey.toBytes())],
    borrowLendingProgramId
  );
```


## Obligation custom parsing logic
Unfortunately, anchor doesn't correctly parse array of enums serialized data if
they are repr(packed), which is a must for zero copy. We therefore provide a
custom method for parsing the data.

See the `obligation.ts` module in tests and its method
`fromBytesSkipDiscriminatorCheck`.


# `u192`
For decimal representation we use `u192` type which consists of 3 `u64`
integers. That is, `u192` is an unsigned integer of 24 bytes. A unit
representing one is a [wad][wiki-significand] and its value is $`10^{18}`$.
Therefore, first eighteen decimal digits represent fraction.

What follows are some snippets which illustrate how to convert between types in
typescript.

```typescript
import { BN } from "@project-serum/anchor";

type U192 = [BN, BN, BN];
const ONE_WAD = new BN(10).pow(new BN(18));
```

```typescript
function numberToU192(n: number): U192 {
  if (n < 0) {
    throw new Error("u192 is unsigned, number cannot be less than zero");
  }

  const wad = n < 1 ? ONE_WAD.div(new BN(1 / n)) : ONE_WAD.mul(new BN(n));
  const bytes = wad.toArray("le", 3 * 8); // 3 * u64

  const nextU64 = () => new BN(bytes.splice(0, 8), "le");
  return [nextU64(), nextU64(), nextU64()];
}
```

```typescript
function u192ToBN(u192: U192 | BN[] | { u192: U192 | BN[] }): BN {
  // flatten the input
  u192 = Array.isArray(u192) ? u192 : u192.u192;

  if (u192.length !== 3) {
    throw new Error("u192 must have exactly 3 u64 BN");
  }

  const ordering = "le";
  return new BN(
    [
      ...u192[0].toArray(ordering, 8),
      ...u192[1].toArray(ordering, 8),
      ...u192[2].toArray(ordering, 8),
    ],
    ordering
  );
}
```

## 🛠️ Troubleshooting

### UI Build Issues with Sharp

The UI uses Next.js which includes Sharp for image optimization. If you encounter Sharp-related errors during development or CI/CD:

**Common errors:**
- `Error loading sharp: Cannot dynamically require "../src/build/Release/sharp-linux-x64.node"`
- `Cannot find module sharp-wasm32.node`

**Solutions:**

1. **Use Node.js v20.x LTS** (recommended for optimal compatibility):
   ```bash
   nvm use 20  # or install Node.js v20.x LTS
   ```

2. **Rebuild Sharp for your environment:**
   ```bash
   cd ui
   npm rebuild sharp
   ```

3. **Clean install:**
   ```bash
   cd ui
   rm -rf node_modules package-lock.json
   npm install --legacy-peer-deps
   ```

4. **For CI/CD environments**, ensure your workflow uses Node.js v20.x:
   ```yaml
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: '20.x'
   ```

The project configuration includes fallbacks to disable image optimization during static export to prevent Sharp-related build failures in production.

<!-- References -->

[desmos-borrow-rate]: https://www.desmos.com/calculator/1002gfizz0
[compound-interest-formula]: https://en.wikipedia.org/wiki/Compound_interest#Periodic_compounding
[mocha-exclusive-tests]: https://mochajs.org/#exclusive-tests
[pyth-network]: https://pyth.network
[pyth-srm-usd]: https://pyth.network/markets/#SRM/USD
[project-rust-docs]: https://crypto_project.gitlab.io/perk/borrow-lending/borrow_lending
[aave-borrow-rate]: https://docs.aave.com/risk/liquidity-risk/borrow-interest-rate#interest-rate-model
[aave-borrow-rate-2]: https://medium.com/aave/aave-borrowing-rates-upgraded-f6c8b27973a7
[port-finance]: https://port.finance
[solaris]: https://solarisprotocol.com
[equalizer]: https://equalizer.finance
[aave-flash-loans]: https://docs.aave.com/developers/guides/flash-loans
[podcast-coinsec-ep-46]: https://podcastaddict.com/episode/130756978
[aave-risk-params]: https://docs.aave.com/risk/asset-risk/risk-parameters
[project-code-coverage]: https://crypto_project.gitlab.io/perk/borrow-lending/coverage
[wiki-significand]: https://en.wikipedia.org/wiki/Significand
[blp-changelog]: https://crypto_project.gitlab.io/perk/borrow-lending/blp.changelog.html
[scp-changelog]: https://crypto_project.gitlab.io/perk/borrow-lending/scp.changelog.html
