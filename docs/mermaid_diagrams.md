# Mermaid Diagrams for Solana Borrow-Lending Platform

## System Architecture

### System Architecture Overview
```mermaid
graph TD
    User[User] --> |Interacts with| BLp[Borrow-Lending Program]
    BLp --> |Manages| LM[Lending Market]
    LM --> |Contains| R[Reserves]
    LM --> |Tracks| O[Obligations]
    BLp --> |Uses| TP[Token Program]
    BLp --> |Queries| Oracle[Pyth Oracle]
    BLp --> |Integrates with| AMM[Aldrin AMM]
    
    subgraph "Core Components"
        LM
        R
        O
    end
    
    subgraph "External Dependencies"
        TP
        Oracle
        AMM
    end
    
    R --> |Stores| LS[Liquidity Supply]
    R --> |Mints| CS[Collateral Supply]
    O --> |References| OC[Obligation Collateral]
    O --> |References| OL[Obligation Liquidity]
    
    classDef core fill:#f9f,stroke:#333,stroke-width:2px;
    classDef external fill:#bbf,stroke:#333,stroke-width:1px;
    classDef data fill:#bfb,stroke:#333,stroke-width:1px;
    
    class LM,R,O core;
    class TP,Oracle,AMM external;
    class LS,CS,OC,OL data;
```

### Component Relationships
```mermaid
graph TD
    LM[Lending Market] --> |Contains| R[Reserves]
    LM --> |Tracks| O[Obligations]
    
    R --> |Has| RC[Reserve Config]
    R --> |Has| RL[Reserve Liquidity]
    R --> |Has| RColl[Reserve Collateral]
    
    RL --> |Has| AvailableAmount[Available Amount]
    RL --> |Has| BorrowedAmount[Borrowed Amount]
    RL --> |Has| CumulativeBorrowRate[Cumulative Borrow Rate]
    RL --> |Has| MarketPrice[Market Price]
    
    RColl --> |Has| Mint[Collateral Mint]
    RColl --> |Has| Supply[Collateral Supply]
    
    RC --> |Defines| Fees[Fee Structure]
    RC --> |Defines| LTV[Loan-to-Value Ratio]
    RC --> |Defines| LT[Liquidation Threshold]
    RC --> |Defines| ML[Max Leverage]
    RC --> |Defines| IR[Interest Rate Params]
    
    O --> |Contains| OC[Obligation Collateral]
    O --> |Contains| OL[Obligation Liquidity]
    
    OC --> |References| R
    OL --> |References| R
    
    classDef main fill:#f9f,stroke:#333,stroke-width:2px;
    classDef sub fill:#bbf,stroke:#333,stroke-width:1px;
    classDef param fill:#bfb,stroke:#333,stroke-width:1px;
    
    class LM,R,O main;
    class RC,RL,RColl,OC,OL sub;
    class AvailableAmount,BorrowedAmount,CumulativeBorrowRate,MarketPrice,Mint,Supply,Fees,LTV,LT,ML,IR param;
```

### Data Model Relationships
```mermaid
classDiagram
    class LendingMarket {
        +Pubkey owner
        +Pubkey quote_currency
        +Pubkey pyth_oracle_program
        +Pubkey aldrin_amm
        +bool enable_flash_loans
        +Decimal min_collateral_uac_value_for_leverage
    }
    
    class Reserve {
        +Pubkey lending_market
        +ReserveLiquidity liquidity
        +ReserveCollateral collateral
        +ReserveConfig config
        +LastUpdate last_update
        +deposit_liquidity()
        +redeem_collateral()
        +borrow_liquidity()
        +repay_loan()
        +accrue_interest()
    }
    
    class ReserveLiquidity {
        +u64 available_amount
        +SDecimal borrowed_amount
        +Pubkey mint
        +u8 mint_decimals
        +Pubkey supply
        +Pubkey fee_receiver
        +Oracle oracle
        +SDecimal cumulative_borrow_rate
        +SDecimal market_price
        +SDecimal accrued_interest
    }
    
    class ReserveCollateral {
        +Pubkey mint
        +u64 mint_total_supply
        +Pubkey supply
    }
    
    class ReserveConfig {
        +PercentageInt optimal_utilization_rate
        +PercentageInt loan_to_value_ratio
        +PercentageInt liquidation_threshold
        +PercentageInt liquidation_bonus
        +PercentageInt min_borrow_rate
        +PercentageInt optimal_borrow_rate
        +PercentageInt max_borrow_rate
        +ReserveFees fees
        +Leverage max_leverage
    }
    
    class Obligation {
        +Pubkey lending_market
        +Pubkey owner
        +ObligationReserve[] reserves
        +SDecimal deposited_value
        +SDecimal borrowed_value
        +SDecimal allowed_borrow_value
        +SDecimal unhealthy_borrow_value
        +LastUpdate last_update
        +deposit()
        +withdraw()
        +borrow()
        +repay()
    }
    
    class ObligationReserve {
        +ObligationCollateral collateral
        +ObligationLiquidity liquidity
    }
    
    class ObligationCollateral {
        +Pubkey deposit_reserve
        +u64 deposited_amount
        +SDecimal market_value
    }
    
    class ObligationLiquidity {
        +Pubkey borrow_reserve
        +SDecimal borrowed_amount
        +SDecimal market_value
        +SDecimal cumulative_borrow_rate_snapshot
        +LoanKind loan_kind
    }
    
    LendingMarket "1" -- "many" Reserve : contains
    Reserve "1" -- "1" ReserveLiquidity : has
    Reserve "1" -- "1" ReserveCollateral : has
    Reserve "1" -- "1" ReserveConfig : has
    LendingMarket "1" -- "many" Obligation : tracks
    Obligation "1" -- "many" ObligationReserve : contains
    ObligationReserve <|-- ObligationCollateral : variant
    ObligationReserve <|-- ObligationLiquidity : variant
    ObligationCollateral "many" -- "1" Reserve : references
    ObligationLiquidity "many" -- "1" Reserve : references
```

## Key Processes

### Lending and Borrowing Flows
```mermaid
sequenceDiagram
    participant User
    participant BLp as Borrow-Lending Program
    participant Reserve
    participant TokenProgram
    participant Oracle
    
    %% Deposit Flow
    User->>BLp: Deposit Liquidity
    BLp->>Oracle: Get Market Price
    Oracle-->>BLp: Return Price
    BLp->>Reserve: Calculate Collateral Amount
    Reserve-->>BLp: Return Collateral Amount
    BLp->>TokenProgram: Transfer Liquidity from User to Reserve
    BLp->>TokenProgram: Mint Collateral Tokens to User
    BLp-->>User: Confirm Deposit
    
    %% Borrow Flow
    User->>BLp: Borrow Liquidity
    BLp->>Oracle: Get Market Price
    Oracle-->>BLp: Return Price
    BLp->>Reserve: Check Borrow Limit
    Reserve-->>BLp: Confirm Borrow Allowed
    BLp->>Reserve: Update Borrowed Amount
    BLp->>TokenProgram: Transfer Liquidity from Reserve to User
    BLp-->>User: Confirm Borrow
    
    %% Repay Flow
    User->>BLp: Repay Loan
    BLp->>Reserve: Calculate Repayment with Interest
    Reserve-->>BLp: Return Repayment Amount
    BLp->>TokenProgram: Transfer Liquidity from User to Reserve
    BLp->>Reserve: Update Borrowed Amount
    BLp-->>User: Confirm Repayment
    
    %% Withdraw Flow
    User->>BLp: Withdraw Collateral
    BLp->>Oracle: Get Market Price
    Oracle-->>BLp: Return Price
    BLp->>Reserve: Check Withdrawal Limit
    Reserve-->>BLp: Confirm Withdrawal Allowed
    BLp->>TokenProgram: Burn Collateral Tokens
    BLp->>TokenProgram: Transfer Liquidity from Reserve to User
    BLp-->>User: Confirm Withdrawal
```

### Liquidation Flow
```mermaid
sequenceDiagram
    participant Liquidator
    participant BLp as Borrow-Lending Program
    participant Obligation
    participant RepayReserve
    participant WithdrawReserve
    participant TokenProgram
    participant Oracle
    
    Liquidator->>BLp: Liquidate Obligation
    BLp->>Oracle: Get Market Prices
    Oracle-->>BLp: Return Prices
    BLp->>Obligation: Check Health
    
    alt Obligation is Unhealthy
        Obligation-->>BLp: Confirm Unhealthy Status
        BLp->>Obligation: Calculate Liquidation Amounts
        Obligation-->>BLp: Return Liquidation Amounts
        BLp->>TokenProgram: Transfer Liquidity from Liquidator to RepayReserve
        BLp->>RepayReserve: Update Borrowed Amount
        BLp->>WithdrawReserve: Update Collateral Amount
        BLp->>TokenProgram: Transfer Collateral from WithdrawReserve to Liquidator
        BLp-->>Liquidator: Confirm Liquidation (with bonus)
    else Obligation is Healthy
        Obligation-->>BLp: Return Healthy Status
        BLp-->>Liquidator: Reject Liquidation
    end
```

### Flash Loan Process
```mermaid
sequenceDiagram
    participant User
    participant BLp as Borrow-Lending Program
    participant Reserve
    participant TargetProgram
    participant TokenProgram
    
    User->>BLp: Request Flash Loan
    
    alt Flash Loans Enabled
        BLp->>Reserve: Check Available Liquidity
        Reserve-->>BLp: Confirm Liquidity Available
        BLp->>Reserve: Record Loan
        BLp->>TokenProgram: Transfer Liquidity to User
        BLp->>TargetProgram: Execute User's Instructions
        TargetProgram-->>BLp: Complete Execution
        BLp->>TokenProgram: Transfer Liquidity + Fee from User to Reserve
        BLp->>Reserve: Record Repayment
        BLp->>TokenProgram: Transfer Fee to Fee Receiver
        BLp-->>User: Confirm Flash Loan Complete
    else Flash Loans Disabled
        BLp-->>User: Reject Flash Loan
    end
```

### Leveraged Yield Farming Flow
```mermaid
sequenceDiagram
    participant User
    participant BLp as Borrow-Lending Program
    participant Reserve
    participant Obligation
    participant AldrinAMM
    participant TokenProgram
    
    User->>BLp: Open Leveraged Position
    BLp->>Obligation: Check Collateral Value
    Obligation-->>BLp: Return Collateral Value
    BLp->>Reserve: Borrow Liquidity with Leverage
    Reserve-->>BLp: Confirm Borrow
    BLp->>TokenProgram: Transfer Borrowed Liquidity to User
    
    opt Swap Portion of Borrowed Liquidity
        BLp->>AldrinAMM: Swap Tokens
        AldrinAMM-->>BLp: Return Swapped Tokens
    end
    
    BLp->>AldrinAMM: Create LP Tokens
    AldrinAMM-->>BLp: Return LP Tokens
    BLp->>AldrinAMM: Stake LP Tokens
    AldrinAMM-->>BLp: Confirm Staking
    BLp->>BLp: Create Farming Receipt
    BLp-->>User: Confirm Leveraged Position
    
    note over User,TokenProgram: Later - Close Position
    
    User->>BLp: Close Leveraged Position
    BLp->>AldrinAMM: Unstake LP Tokens
    AldrinAMM-->>BLp: Return LP Tokens
    BLp->>AldrinAMM: Remove Liquidity
    AldrinAMM-->>BLp: Return Constituent Tokens
    
    opt Swap Back to Original Token
        BLp->>AldrinAMM: Swap Tokens
        AldrinAMM-->>BLp: Return Swapped Tokens
    end
    
    BLp->>Reserve: Repay Loan with Interest
    BLp->>TokenProgram: Transfer Remaining Tokens to User
    BLp-->>User: Confirm Position Closed
```

## Tokenomics

### Interest Rate Curves
```mermaid
graph LR
    subgraph "Interest Rate Model"
        direction TB
        
        U[Utilization Rate] --> |"R_u < R*_u"| L[Low Utilization Formula]
        U --> |"R_u >= R*_u"| H[High Utilization Formula]
        
        L --> BR[Borrow Rate]
        H --> BR
        
        BR --> |"R_d = R_u * R_b"| DR[Deposit Rate]
    end
    
    subgraph "Interest Rate Curve"
        direction TB
        
        style IRGraph fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        IRGraph[
        "
        ^
        |                                   /
        |                                  /
        |                                 /
        |                                /
        |                               /
        |                              /
        |                             /
        |                            /
        |                           /
        |                          /
        |                         /
        |                        /
        |                       /
        |                      /
        |                     /
        |                    /
        |                   /
        |                  /
        |                 /
        |                /
        |               /
        |              /
        |             /
        |            /
        |           /
        |          /
        |         /
        |        /
        |       /
        |      /
        |     /
        |    /
        |   /
        |  /
        | /
        |/
        +---------------------------------->
          0%       R*_u       100%
          
          R_minb = Min Borrow Rate
          R*_b = Optimal Borrow Rate
          R_maxb = Max Borrow Rate
          R*_u = Optimal Utilization Rate
        "
        ]
    end
```

### Fee Distribution
```mermaid
flowchart TD
    User[User] --> |Pays| BF[Borrow Fee]
    User --> |Pays| FF[Flash Loan Fee]
    User --> |Pays| LF[Leverage Fee]
    
    BF --> |"(1-Host Fee %)"| Protocol[Protocol Fee Receiver]
    BF --> |"Host Fee %"| Host[Host Fee Receiver]
    
    FF --> |"(1-Host Fee %)"| Protocol
    FF --> |"Host Fee %"| Host
    
    LF --> |"(1-Host Fee %)"| Protocol
    LF --> |"Host Fee %"| Host
    
    Protocol --> Treasury[Protocol Treasury]
    
    classDef user fill:#bbf,stroke:#333,stroke-width:1px;
    classDef fee fill:#bfb,stroke:#333,stroke-width:1px;
    classDef receiver fill:#f9f,stroke:#333,stroke-width:1px;
    
    class User user;
    class BF,FF,LF fee;
    class Protocol,Host,Treasury receiver;
```

### Collateralization Model
```mermaid
graph TD
    subgraph "Collateralization Parameters"
        LTV[Loan-to-Value Ratio]
        LT[Liquidation Threshold]
        LB[Liquidation Bonus]
    end
    
    subgraph "Collateralization States"
        direction TB
        
        style CollateralGraph fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        CollateralGraph[
        "
        Collateral Value
        ^
        |
        |                   Safe Zone
        |                   (Can borrow more)
        |                   
        |------------------+
        |                  |
        |                  | Warning Zone
        |                  | (Cannot borrow more)
        |                  |
        |------------------+
        |                  |
        |                  | Liquidation Zone
        |                  | (Can be liquidated)
        |                  |
        +------------------+---------------->
                           Borrowed Value
                           
        LTV = Maximum borrow amount relative to collateral
        LT = Threshold where liquidation becomes possible
        LB = Bonus liquidators receive (incentive)
        "
        ]
    end
    
    LTV --> CollateralGraph
    LT --> CollateralGraph
    LB --> CollateralGraph
```

### Emissions Flow
```mermaid
flowchart TD
    ER[Emission Rate] --> |"ω^b (Borrower Rate)"| BE[Borrower Emissions]
    ER --> |"ω^s (Supplier Rate)"| SE[Supplier Emissions]
    
    BE --> |"Based on Share of Borrowed Amount"| BU[Borrower Users]
    SE --> |"Based on Share of Supplied Amount"| SU[Supplier Users]
    
    subgraph "Emission Formula"
        direction TB
        
        style EmissionFormula fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        EmissionFormula[
        "
        For Borrowers:
        E = ω^b * S_e * (L^u_b / L^r_b)
        
        For Suppliers:
        E = ω^s * S_e * (L^u_s / L^r_s)
        
        Where:
        E = Emission tokens a user can claim
        ω = Emitted tokens per slot
        S_e = Elapsed slots
        L^u_b = User's borrowed amount
        L^r_b = Reserve's total borrowed amount
        L^u_s = User's supplied amount
        L^r_s = Reserve's total supplied amount
        "
        ]
    end
    
    BE --> EmissionFormula
    SE --> EmissionFormula
    
    classDef rate fill:#bbf,stroke:#333,stroke-width:1px;
    classDef emission fill:#bfb,stroke:#333,stroke-width:1px;
    classDef user fill:#f9f,stroke:#333,stroke-width:1px;
    
    class ER rate;
    class BE,SE emission;
    class BU,SU user;
```

## Security Checkpoints

```mermaid
flowchart TD
    subgraph "Security Checkpoints"
        OS[Oracle Security]
        FS[Flash Loan Security]
        LS[Leverage Security]
        LQS[Liquidation Security]
        MS[Mathematical Security]
        AS[Access Control Security]
    end
    
    OS --> |"Check"| OSC1[Oracle Freshness]
    OS --> |"Check"| OSC2[Price Manipulation]
    OS --> |"Check"| OSC3[Oracle Dependency]
    
    FS --> |"Check"| FSC1[Reentrancy Protection]
    FS --> |"Check"| FSC2[Fee Calculation]
    FS --> |"Check"| FSC3[Repayment Verification]
    
    LS --> |"Check"| LSC1[Leverage Limits]
    LS --> |"Check"| LSC2[Token Leakage]
    LS --> |"Check"| LSC3[Position Ownership]
    
    LQS --> |"Check"| LQSC1[Liquidation Thresholds]
    LQS --> |"Check"| LQSC2[Liquidation Calculation]
    LQS --> |"Check"| LQSC3[Liquidation Incentives]
    
    MS --> |"Check"| MSC1[Decimal Precision]
    MS --> |"Check"| MSC2[Overflow/Underflow]
    MS --> |"Check"| MSC3[Rounding Errors]
    
    AS --> |"Check"| ASC1[Account Validation]
    AS --> |"Check"| ASC2[PDA Seed Construction]
    AS --> |"Check"| ASC3[Authority Verification]
    
    classDef category fill:#f9f,stroke:#333,stroke-width:2px;
    classDef check fill:#bbf,stroke:#333,stroke-width:1px;
    
    class OS,FS,LS,LQS,MS,AS category;
    class OSC1,OSC2,OSC3,FSC1,FSC2,FSC3,LSC1,LSC2,LSC3,LQSC1,LQSC2,LQSC3,MSC1,MSC2,MSC3,ASC1,ASC2,ASC3 check;
```

## Program Structure

```mermaid
graph TD
    subgraph "Program Structure"
        lib[lib.rs] --> |Imports| models[models/]
        lib --> |Imports| endpoints[endpoints/]
        lib --> |Imports| math[math/]
        lib --> |Imports| cpis[cpis/]
        
        models --> reserve[reserve.rs]
        models --> obligation[obligation.rs]
        models --> oracle[pyth.rs]
        models --> emissions[emissions.rs]
        
        endpoints --> deposit[deposit_*.rs]
        endpoints --> borrow[borrow_*.rs]
        endpoints --> repay[repay_*.rs]
        endpoints --> liquidate[liquidate_*.rs]
        endpoints --> flash[flash_loan.rs]
        endpoints --> amm[amm/]
        
        amm --> aldrin[aldrin/]
        aldrin --> leverage[open_leveraged_position_*.rs]
        
        math --> decimal[decimal.rs]
        math --> sdecimal[sdecimal.rs]
    end
    
    classDef main fill:#f9f,stroke:#333,stroke-width:2px;
    classDef module fill:#bbf,stroke:#333,stroke-width:1px;
    classDef file fill:#bfb,stroke:#333,stroke-width:1px;
    
    class lib main;
    class models,endpoints,math,cpis,amm,aldrin module;
    class reserve,obligation,oracle,emissions,deposit,borrow,repay,liquidate,flash,leverage,decimal,sdecimal file;
```

## Mathematical Models

### Interest Calculation Flow
```mermaid
flowchart TD
    BR[Borrow Rate Calculation] --> |"Input"| CI[Compound Interest Calculation]
    SE[Slots Elapsed] --> |"Input"| CI
    
    CI --> |"Updates"| BA[Borrowed Amount]
    CI --> |"Updates"| CBR[Cumulative Borrow Rate]
    
    subgraph "Compound Interest Formula"
        direction TB
        
        style Formula fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        Formula[
        "
        R_i = (1 + R_b/S_a)^S_e
        
        Where:
        R_i = Compound interest rate
        R_b = Borrow rate
        S_a = Slots per year
        S_e = Elapsed slots
        
        New borrowed amount:
        L'_s = L_s * R_i
        
        New obligation borrowed amount:
        L'_o = (R'_c/R_c) * L_o
        
        Where:
        R'_c = New cumulative borrow rate
        R_c = Old cumulative borrow rate
        L_o = Old borrowed amount
        "
        ]
    end
    
    CI --> Formula
    
    classDef input fill:#bbf,stroke:#333,stroke-width:1px;
    classDef calculation fill:#f9f,stroke:#333,stroke-width:2px;
    classDef output fill:#bfb,stroke:#333,stroke-width:1px;
    
    class BR,SE input;
    class CI calculation;
    class BA,CBR output;
```

### Exchange Rate Mechanism
```mermaid
flowchart TD
    LS[Liquidity Supply] --> |"Input"| ER[Exchange Rate Calculation]
    CS[Collateral Supply] --> |"Input"| ER
    
    ER --> |"Used for"| LC[Liquidity to Collateral Conversion]
    ER --> |"Used for"| CL[Collateral to Liquidity Conversion]
    
    LC --> |"Used in"| Deposit[Deposit Operation]
    CL --> |"Used in"| Withdraw[Withdraw Operation]
    
    subgraph "Exchange Rate Formula"
        direction TB
        
        style Formula fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        Formula[
        "
        R_x = C_s / L_s
        
        Where:
        R_x = Exchange rate
        C_s = Total minted collateral supply
        L_s = Total deposited liquidity supply
        
        Liquidity to Collateral:
        C = L * R_x
        
        Collateral to Liquidity:
        L = C / R_x
        "
        ]
    end
    
    ER --> Formula
    
    classDef input fill:#bbf,stroke:#333,stroke-width:1px;
    classDef calculation fill:#f9f,stroke:#333,stroke-width:2px;
    classDef conversion fill:#bfb,stroke:#333,stroke-width:1px;
    classDef operation fill:#fbb,stroke:#333,stroke-width:1px;
    
    class LS,CS input;
    class ER calculation;
    class LC,CL conversion;
    class Deposit,Withdraw operation;
```

### Liquidation Calculation
```mermaid
flowchart TD
    BV[Borrowed Value] --> |"Input"| LC[Liquidation Calculation]
    CV[Collateral Value] --> |"Input"| LC
    LT[Liquidation Threshold] --> |"Input"| LC
    LB[Liquidation Bonus] --> |"Input"| LC
    
    LC --> |"Output"| MLA[Max Liquidation Amount]
    LC --> |"Output"| SA[Settlement Amount]
    LC --> |"Output"| WA[Withdrawal Amount]
    
    subgraph "Liquidation Formula"
        direction TB
        
        style Formula fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        Formula[
        "
        L_maxl = (min{V_b * κ, L_v} / L_v) * L_b
        
        Where:
        L_maxl = Maximum liquidity amount to liquidate
        V_b = UAC value of borrowed liquidity
        κ = Constant liquidity close factor (50%)
        L_v = UAC value of borrowed liquidity
        L_b = Total borrowed liquidity
        
        Liquidation value with bonus:
        LV = L * (1 + LB)
        
        Where:
        L = Liquidation amount
        LB = Liquidation bonus
        "
        ]
    end
    
    LC --> Formula
    
    classDef input fill:#bbf,stroke:#333,stroke-width:1px;
    classDef calculation fill:#f9f,stroke:#333,stroke-width:2px;
    classDef output fill:#bfb,stroke:#333,stroke-width:1px;
    
    class BV,CV,LT,LB input;
    class LC calculation;
    class MLA,SA,WA output;
```

### Leverage Calculation
```mermaid
flowchart TD
    LTV[Loan-to-Value Ratio] --> |"Input"| ML[Max Leverage Calculation]
    
    ML --> |"Limits"| LP[Leveraged Position]
    
    subgraph "Leverage Formula"
        direction TB
        
        style Formula fill:#f9f9f9,stroke:#333,stroke-width:1px
        
        Formula[
        "
        φ_max = (1 - V_maxb^30) / (1 - V_maxb)
        
        Where:
        φ_max = Maximum leverage
        V_maxb = Maximum borrowable UAC value (LTV)
        
        Leveraged borrow value:
        V_l = V_r * φ
        
        Where:
        V_l = Leveraged borrow value
        V_r = Regular borrow value
        φ = Leverage factor
        "
        ]
    end
    
    ML --> Formula
    
    classDef input fill:#bbf,stroke:#333,stroke-width:1px;
    classDef calculation fill:#f9f,stroke:#333,stroke-width:2px;
    classDef output fill:#bfb,stroke:#333,stroke-width:1px;
    
    class LTV input;
    class ML calculation;
    class LP output;
```

## Integration Diagrams

### Oracle Integration
```mermaid
sequenceDiagram
    participant BLp as Borrow-Lending Program
    participant PythClient as Pyth Client
    participant PythNetwork as Pyth Network
    
    PythNetwork->>PythClient: Update Price Accounts
    
    BLp->>PythClient: Request Price Data
    PythClient-->>BLp: Return Price Data
    
    BLp->>BLp: Validate Price Data
    Note over BLp: Check staleness
    Note over BLp: Check price type
    
    BLp->>BLp: Calculate Market Price
    Note over BLp: Apply exponent
    
    BLp->>BLp: Use Price in Operations
    Note over BLp: Collateral valuation
    Note over BLp: Borrow limit calculation
    Note over BLp: Liquidation checks
```

### AMM Integration
```mermaid
sequenceDiagram
    participant User
    participant BLp as Borrow-Lending Program
    participant AldrinAMM as Aldrin AMM
    participant TokenProgram
    
    User->>BLp: Request Leveraged Position
    BLp->>BLp: Borrow Liquidity
    
    BLp->>AldrinAMM: Swap Tokens
    AldrinAMM->>TokenProgram: Transfer Tokens
    AldrinAMM-->>BLp: Return Swapped Tokens
    
    BLp->>AldrinAMM: Create LP Tokens
    AldrinAMM->>TokenProgram: Transfer Base Tokens
    AldrinAMM->>TokenProgram: Transfer Quote Tokens
    AldrinAMM->>TokenProgram: Mint LP Tokens
    AldrinAMM-->>BLp: Return LP Tokens
    
    BLp->>AldrinAMM: Stake LP Tokens
    AldrinAMM->>TokenProgram: Transfer LP Tokens to Freeze Vault
    AldrinAMM->>AldrinAMM: Create Farming Ticket
    AldrinAMM-->>BLp: Confirm Staking
    
    BLp->>BLp: Create Farming Receipt
    BLp-->>User: Confirm Leveraged Position
```

### Token Integration
```mermaid
sequenceDiagram
    participant BLp as Borrow-Lending Program
    participant TokenProgram
    participant Mint
    participant SourceWallet
    participant DestinationWallet
    
    %% Transfer
    BLp->>TokenProgram: Transfer Tokens
    TokenProgram->>SourceWallet: Debit Tokens
    TokenProgram->>DestinationWallet: Credit Tokens
    TokenProgram-->>BLp: Confirm Transfer
    
    %% Mint
    BLp->>TokenProgram: Mint Tokens
    TokenProgram->>Mint: Increase Supply
    TokenProgram->>DestinationWallet: Credit Tokens
    TokenProgram-->>BLp: Confirm Mint
    
    %% Burn
    BLp->>TokenProgram: Burn Tokens
    TokenProgram->>SourceWallet: Debit Tokens
    TokenProgram->>Mint: Decrease Supply
    TokenProgram-->>BLp: Confirm Burn
```

## Risk Management Framework
```mermaid
flowchart TD
    subgraph "Risk Categories"
        MR[Market Risk]
        LR[Liquidity Risk]
        OR[Oracle Risk]
        CR[Credit Risk]
        TR[Technical Risk]
    end
    
    MR --> |"Mitigated by"| MRM[Market Risk Mitigations]
    LR --> |"Mitigated by"| LRM[Liquidity Risk Mitigations]
    OR --> |"Mitigated by"| ORM[Oracle Risk Mitigations]
    CR --> |"Mitigated by"| CRM[Credit Risk Mitigations]
    TR --> |"Mitigated by"| TRM[Technical Risk Mitigations]
    
    MRM --> MRM1[Conservative LTV Ratios]
    MRM --> MRM2[Liquidation Incentives]
    MRM --> MRM3[Price Monitoring]
    
    LRM --> LRM1[Utilization Rate Caps]
    LRM --> LRM2[Dynamic Interest Rates]
    LRM --> LRM3[Reserve Requirements]
    
    ORM --> ORM1[Staleness Checks]
    ORM --> ORM2[Multiple Oracle Support]
    ORM --> ORM3[Circuit Breakers]
    
    CRM --> CRM1[Overcollateralization]
    CRM --> CRM2[Liquidation Thresholds]
    CRM --> CRM3[Risk-Based Parameters]
    
    TRM --> TRM1[Code Audits]
    TRM --> TRM2[Formal Verification]
    TRM --> TRM3[Upgrade Controls]
    
    classDef risk fill:#f9f,stroke:#333,stroke-width:2px;
    classDef mitigation fill:#bbf,stroke:#333,stroke-width:1px;
    classDef specific fill:#bfb,stroke:#333,stroke-width:1px;
    
    class MR,LR,OR,CR,TR risk;
    class MRM,LRM,ORM,CRM,TRM mitigation;
    class MRM1,MRM2,MRM3,LRM1,LRM2,LRM3,ORM1,ORM2,ORM3,CRM1,CRM2,CRM3,TRM1,TRM2,TRM3 specific;
```
