* [Code coverage][project-code-coverage]
* [Rust docs][project-rust-docs]

A lending platform is a tool where users lend and borrow tokens. A user either
gets an interest on lent tokens or they get a loan and pay interest.

* When lending tokens a funder gets an interest on their tokens. The interest
  accumulates and they can withdraw it. (The interest is changing according to
  the different market conditions.)

* A borrower can only borrow a specific number of tokens. That's limited by the
  amount of lent tokens by that user. For example, they cannot borrow more than
  150% of their funded value as another tokens. The borrowing interest rate for
  each token is always higher than the lending interest rate.

## Example use case
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

Flash loans are frequent target of vulnerabilities, a recent large one was [the
CREAM attack][podcast-coinsec-ep-46].

Some competitors who offer flash loans as a part of their borrow lending
offering are [Port Finance][port-finance], [Solaris][solaris] and
[Equalizer][equalizer] who, albeit on ETH, specializes on flash loans.

After searching through Port's transaction history it seems that flash loan is
a rarely used feature in their program. In the analysed timespan of ~24h, it
hasn't been used once.

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

* `liquidation_threshold` is loan to value ratio at which an obligation can be
  liquidated.

In another words, liquidation threshold is the ratio between borrow amount and
the collateral value at which the users are subject to liquidation.

Say that a user deposit 100 USD worth of SOL and borrow 85 USD worth of assets,
according to the currently liquidation threshold of 90%, the user is subject to
liquidation if the value of the assets that they borrow has increased 90 USD.

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


### Equations
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
| $`R_b`$      | borrow rate |
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
| $`\kappa`$   | constant liquidity close factor |
| $`\epsilon`$ | liquidation threshold in \[0; 1) |


```math
R_u = \dfrac{L_b}{L_s}
\tag{1}
```


Exchange rate is simply ratio of collateral to liquidity in the supply. However,
if there's no liquidity or collateral in the supply, the ratio defaults to a
compiled-in value.

```math
R_x = \dfrac{C_s}{L_s}
\tag{2}
```


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


We define the compound interest period to equal one slot. To get the `i`
parameter of the standard [compound interest formula][compound-interest-formula]
we divide borrow rate by the number of slots per year:

```math
R_i = (1 + \dfrac{R_b}{S_a})^{S_e}
\tag{4}
```


Once per slot we update the liquidity supply with interest rate:

```math
L^{'}_s = L_s R_i
\tag{5}
```


Eq. (6) describes how interest accrues on borrowed liquidity. $`R^{'}_c`$ is
the latest cum. borrow rate at time of update while $`R_c`$ is the cum. borrow
rate at time of last interest accrual.

```math
L^{'}_o = \dfrac{R^{'}_c}{R_c} L_o
\tag{6}
```


Maximum UAC value to withdraw from an obligation is given by a ratio of
borrowed value to maximum allowed borrow value:

```math
V_{maxw} = V_d - \dfrac{V_b}{V_{maxb}} V_d
\tag{7}
```


Eq. (8) gives us maximum liquidation amount of liquidity which a liquidator
cannot go over. (Although they can liquidate less than that.) The close factor
$`κ`$ is 50% (compiled into the program) and puts a limit on how much borrowed
value can be liquidated at once.

```math
L_{maxl} = \dfrac{\min\{V_b * \kappa, L_v\}}{L_v} L_b
\tag{8}
```


Calculates obligation's unhealthy borrow value by summing over each borrowed
reserve. See the [health factor docs](#health-factor).

```math
V_u = \sum C^r_b \epsilon^r
\tag{9}
```


## Commands
Use following anchor command to build the `borrow-lending` program:

```
anchor build
```

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


## CLI
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


[desmos-borrow-rate]: https://www.desmos.com/calculator/1002gfizz0
[compound-interest-formula]: https://en.wikipedia.org/wiki/Compound_interest#Periodic_compounding
[mocha-exclusive-tests]: https://mochajs.org/#exclusive-tests
[pyth-network]: https://pyth.network
[pyth-srm-usd]: https://pyth.network/markets/#SRM/USD
[project-rust-docs]: https://crypto_project.gitlab.io/defi/borrow-lending/borrow_lending
[aave-borrow-rate]: https://docs.aave.com/risk/liquidity-risk/borrow-interest-rate#interest-rate-model
[aave-borrow-rate-2]: https://medium.com/aave/aave-borrowing-rates-upgraded-f6c8b27973a7
[port-finance]: https://port.finance
[solaris]: https://solarisprotocol.com
[equalizer]: https://equalizer.finance
[aave-flash-loans]: https://docs.aave.com/developers/guides/flash-loans
[podcast-coinsec-ep-46]: https://podcastaddict.com/episode/130756978
[aave-risk-params]: https://docs.aave.com/risk/asset-risk/risk-parameters
[project-code-coverage]: https://crypto_project.gitlab.io/defi/borrow-lending/coverage
