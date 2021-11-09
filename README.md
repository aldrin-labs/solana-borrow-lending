# borrow-lending

## Design
<details>
<summary markdown="span">Diagram illustrating endpoints-accounts relationship</summary>

![Overview of endpoints](docs/endpoints-accounts-relationship.png)

</details>

TODO

### Borrow rate
Borrow rate ($`R_b`$) is a key concept for interest calculation.
TODO: explain key properties of the model

<details>
<summary markdown="span">Model for borrow rate calculation (eq. 3)</summary>

[![Desmos borrow lending view](docs/borrow_rate_model.png)][desmos-borrow-rate]

_Legend_
- subscript `o` in the image means optimal while in this document we use
    superscript `*`;
- the x axis represents $`R_u`$.

</details>

### Equations
Search for `ref. eq. (x) to find an equation _x_ in the codebase.

| Symbol       | Description |
|---           |--- |
| $`L_b`$      | total borrowed liquidity |
| $`L_s`$      | total deposited liquidity supply |
| $`C_s`$      | total minted collateral supply |
| $`S_e`$      | elapsed slots |
| $`S_a`$      | number of slots in a calendar year |
| $`R_u`$      | utilization rate |
| $`R_x`$      | exchange rate |
| $`R_b`$      | borrow rate |
| $`R_i`$      | compound interest rate |
| $`R^*_u`$    | optimal utilization rate (configurable) |
| $`R^*_b`$    | optimal borrow rate (configurable) |
| $`R_{minb}`$ | minimum $`R_b`$ (configurable) |
| $`R_{maxb}`$ | maximum $`R_b`$ (configurable) |

```math
R_u = \dfrac{L_b}{L_s}
\tag{1}
```

```math
R_x = \dfrac{C_s}{L_s}
\tag{2}
```

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

```math
L^{'}_s = L_s R_i
\tag{5}
```

## Commands
Use following anchor command to build the `borrow-lending` program:

```
anchor build
```

Use testing script to build dependencies for testing (such as `shmem`)
and run the tests:

```
./test.sh
```

[desmos-borrow-rate]: https://www.desmos.com/calculator/1002gfizz0
[compound-interest-formula]: https://en.wikipedia.org/wiki/Compound_interest#Periodic_compounding
