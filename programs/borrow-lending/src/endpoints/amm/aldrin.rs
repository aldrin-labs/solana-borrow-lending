//! Contains logic for leverage yield farming using Aldrin's AMM pools.
//!
//! In Aldrin you deposit two constituent tokens into a pool and get LP tokens
//! of that pool. You then stake those LP tokens and get a farming ticket
//! account with information about how many LP tokens were staked and when.

pub mod close_leveraged_position_on_aldrin;
pub mod close_vault_position_on_aldrin;
pub mod compound_position_on_aldrin;
pub mod open_leveraged_position_on_aldrin;
pub mod open_vault_position_on_aldrin;

pub use close_leveraged_position_on_aldrin::*;
pub use close_vault_position_on_aldrin::*;
pub use compound_position_on_aldrin::*;
pub use open_leveraged_position_on_aldrin::*;
pub use open_vault_position_on_aldrin::*;

use crate::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    program::{invoke, invoke_signed},
};
use anchor_spl::token::TokenAccount;
use std::mem;
use std::ops::Not;

struct StakeCpi<'info> {
    amm_program: Pubkey,
    pool: AccountInfo<'info>,
    farming_state: AccountInfo<'info>,
    farming_ticket: AccountInfo<'info>,
    lp_token_freeze_vault: AccountInfo<'info>,
    borrower_lp_wallet: AccountInfo<'info>,
    borrower: AccountInfo<'info>,
    market_obligation_pda: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    clock: AccountInfo<'info>,
    rent: AccountInfo<'info>,
}

impl<'info> StakeCpi<'info> {
    fn stake(self, seeds: &[&[u8]], stake_lp_amount: u64) -> ProgramResult {
        let start_farming_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new(*self.farming_ticket.key, false),
            AccountMeta::new(*self.lp_token_freeze_vault.key, false),
            AccountMeta::new(*self.borrower_lp_wallet.key, false),
            AccountMeta::new_readonly(*self.borrower.key, true),
            AccountMeta::new_readonly(*self.market_obligation_pda.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(*self.clock.key, false),
            AccountMeta::new_readonly(*self.rent.key, false),
        ];
        let start_farming_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool,
            self.farming_state,
            self.farming_ticket,
            self.lp_token_freeze_vault,
            self.borrower_lp_wallet,
            self.market_obligation_pda,
            self.borrower,
            self.token_program,
            self.clock,
            self.rent,
        ];
        invoke_signed(
            &Instruction {
                program_id: self.amm_program,
                accounts: start_farming_instruction_accounts,
                data: StartFarming {
                    pool_token_amount: stake_lp_amount,
                }
                .instruction_data(),
            },
            &start_farming_instruction_account_infos[..],
            &[seeds],
        )?;

        Ok(())
    }
}

struct SwapCpi<'info> {
    amm_program: Pubkey,
    pool: AccountInfo<'info>,
    pool_signer: AccountInfo<'info>,
    pool_mint: AccountInfo<'info>,
    base_token_vault: AccountInfo<'info>,
    quote_token_vault: AccountInfo<'info>,
    fee_pool_wallet: AccountInfo<'info>,
    borrower: AccountInfo<'info>,
    borrower_base_wallet: AccountInfo<'info>,
    borrower_quote_wallet: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
}

impl<'info> SwapCpi<'info> {
    fn swap(
        self,
        swap_amount: u64,
        min_swap_return: u64,
        side: Side,
    ) -> ProgramResult {
        let swap_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.pool_mint.key(), false),
            AccountMeta::new(self.base_token_vault.key(), false),
            AccountMeta::new(self.quote_token_vault.key(), false),
            AccountMeta::new(*self.fee_pool_wallet.key, false),
            AccountMeta::new_readonly(*self.borrower.key, true),
            AccountMeta::new(self.borrower_base_wallet.key(), false),
            AccountMeta::new(self.borrower_quote_wallet.key(), false),
            AccountMeta::new_readonly(*self.token_program.key, false),
        ];
        let swap_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool,
            self.pool_signer,
            self.pool_mint,
            self.base_token_vault,
            self.quote_token_vault,
            self.fee_pool_wallet,
            self.borrower,
            self.borrower_base_wallet,
            self.borrower_quote_wallet,
            self.token_program,
        ];
        let swap_data = Swap {
            tokens: swap_amount,
            min_tokens: min_swap_return,
            side,
        }
        .instruction_data();
        invoke(
            &Instruction {
                program_id: self.amm_program,
                accounts: swap_instruction_accounts,
                data: swap_data,
            },
            &swap_instruction_account_infos[..],
        )?;

        Ok(())
    }
}

struct GetLpTokensCpi<'info> {
    amm_program: Pubkey,
    pool: AccountInfo<'info>,
    pool_signer: AccountInfo<'info>,
    pool_mint: AccountInfo<'info>,
    base_token_vault: AccountInfo<'info>,
    quote_token_vault: AccountInfo<'info>,
    borrower_lp_wallet: AccountInfo<'info>,
    borrower: AccountInfo<'info>,
    borrower_base_wallet: AccountInfo<'info>,
    borrower_quote_wallet: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    clock: AccountInfo<'info>,
    rent: AccountInfo<'info>,
}

impl<'info> GetLpTokensCpi<'info> {
    fn exchange_constituent_tokens_for_lp_tokens(
        self,
        stake_lp_amount: u64,
        base_token_used_max: u64,
        quote_token_used_max: u64,
    ) -> ProgramResult {
        let create_basket_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new(self.pool_mint.key(), false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.borrower_base_wallet.key(), false),
            AccountMeta::new(self.borrower_quote_wallet.key(), false),
            AccountMeta::new(self.base_token_vault.key(), false),
            AccountMeta::new(self.quote_token_vault.key(), false),
            AccountMeta::new(*self.borrower_lp_wallet.key, false),
            AccountMeta::new_readonly(*self.borrower.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
            AccountMeta::new_readonly(*self.rent.key, false),
        ];
        let create_basket_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool,
            self.pool_mint,
            self.pool_signer,
            self.borrower_base_wallet,
            self.borrower_quote_wallet,
            self.base_token_vault,
            self.quote_token_vault,
            self.borrower_lp_wallet,
            self.borrower,
            self.token_program,
            self.clock,
            self.rent,
        ];
        invoke(
            &Instruction {
                program_id: self.amm_program,
                accounts: create_basket_instruction_accounts,
                data: CreateBasket {
                    creation_size: stake_lp_amount,
                    base_token_used_max,
                    quote_token_used_max,
                }
                .instruction_data(),
            },
            &create_basket_instruction_account_infos[..],
        )?;

        Ok(())
    }
}

struct UnstakeCpi<'info> {
    amm_program: Pubkey,
    pool: AccountInfo<'info>,
    pool_signer: AccountInfo<'info>,
    farming_state: AccountInfo<'info>,
    farming_ticket: AccountInfo<'info>,
    farming_snapshots: AccountInfo<'info>,
    lp_token_freeze_vault: AccountInfo<'info>,
    caller_lp_wallet: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    clock: AccountInfo<'info>,
    rent: AccountInfo<'info>,
}

impl<'info> UnstakeCpi<'info> {
    fn unstake(&mut self, seeds: &[&[u8]]) -> ProgramResult {
        let end_farming_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new_readonly(*self.farming_snapshots.key, false),
            AccountMeta::new(*self.farming_ticket.key, false),
            AccountMeta::new(*self.lp_token_freeze_vault.key, false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.caller_lp_wallet.key(), false),
            AccountMeta::new_readonly(*self.authority.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
            AccountMeta::new_readonly(*self.rent.key, false),
        ];
        let end_farming_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool.to_account_info(),
            self.pool_signer.to_account_info(),
            self.farming_state.to_account_info(),
            self.farming_ticket.to_account_info(),
            self.farming_snapshots.to_account_info(),
            self.lp_token_freeze_vault.to_account_info(),
            self.caller_lp_wallet.to_account_info(),
            self.authority.to_account_info(),
            self.token_program.to_account_info(),
            self.clock.to_account_info(),
            self.rent.to_account_info(),
        ];

        // ~35k units
        invoke_signed(
            &Instruction {
                program_id: self.amm_program,
                accounts: end_farming_instruction_accounts,
                data: EndFarming.instruction_data(),
            },
            &end_farming_instruction_account_infos[..],
            &[seeds],
        )?;

        Ok(())
    }
}

struct WithdrawFarmCpi<'info> {
    amm_program: Pubkey,
    pool: AccountInfo<'info>,
    farming_state: AccountInfo<'info>,
    farming_calc: AccountInfo<'info>,
    farm_token_vault: AccountInfo<'info>,
    pool_signer: AccountInfo<'info>,
    caller_farm_wallet: AccountInfo<'info>,
    farming_ticket_owner_pda: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    clock: AccountInfo<'info>,
}

impl<'info> WithdrawFarmCpi<'info> {
    fn withdraw_farm(&self, seeds: &[&[u8]]) -> ProgramResult {
        let withdraw_farmed_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new(*self.farming_calc.key, false),
            AccountMeta::new(self.farm_token_vault.key(), false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.caller_farm_wallet.key(), false),
            AccountMeta::new_readonly(*self.farming_ticket_owner_pda.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
        ];
        let withdraw_farmed_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool.to_account_info(),
            self.farming_state.to_account_info(),
            self.farming_calc.to_account_info(),
            self.farm_token_vault.to_account_info(),
            self.pool_signer.to_account_info(),
            self.caller_farm_wallet.to_account_info(),
            self.farming_ticket_owner_pda.to_account_info(),
            self.token_program.to_account_info(),
            self.clock.to_account_info(),
        ];
        invoke_signed(
            &Instruction {
                program_id: self.amm_program,
                accounts: withdraw_farmed_instruction_accounts,
                data: WithdrawFarmed::instruction_data(),
            },
            &withdraw_farmed_instruction_account_infos[..],
            &[seeds],
        )?;

        Ok(())
    }
}

#[derive(Copy, Clone)]
enum Side {
    /// User's quote tokens swapped for vault's base tokens.
    Bid = 0,
    /// User's base tokens swapped for vault's quote tokens.
    Ask = 1,
}

impl Not for Side {
    type Output = Self;

    fn not(self) -> Self::Output {
        match self {
            Self::Bid => Self::Ask,
            Self::Ask => Self::Bid,
        }
    }
}

impl Side {
    fn try_from(
        reserve: &Reserve,
        base_token: &Account<'_, TokenAccount>,
        quote_token: &Account<'_, TokenAccount>,
    ) -> Result<Self> {
        let side = if reserve.liquidity.mint == base_token.mint {
            Ok(Side::Ask)
        } else if reserve.liquidity.mint == quote_token.mint {
            Ok(Side::Bid)
        } else {
            msg!(
                "The reserve's liquidity mint must match either \
                the base token vault mint or quote token vault mint"
            );
            Err(ProgramError::from(ErrorCode::InvalidAccountInput))
        };

        Ok(side?)
    }
}

struct Swap {
    tokens: u64,
    min_tokens: u64,
    side: Side,
}

impl Swap {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [248, 198, 158, 145, 225, 117, 135, 200];

        let mut data = Vec::with_capacity(
            prefix.len() + mem::size_of::<u64>() * 2 + mem::size_of::<Side>(),
        );

        data.extend_from_slice(&prefix);
        data.extend_from_slice(&self.tokens.to_le_bytes());
        data.extend_from_slice(&self.min_tokens.to_le_bytes());
        data.push(self.side as u8);

        data
    }
}

struct CreateBasket {
    creation_size: u64,
    base_token_used_max: u64,
    quote_token_used_max: u64,
}

impl CreateBasket {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [47, 105, 155, 148, 15, 169, 202, 211];

        let mut data =
            Vec::with_capacity(prefix.len() + mem::size_of::<u64>() * 3);

        data.extend_from_slice(&prefix);
        data.extend_from_slice(&self.creation_size.to_le_bytes());
        data.extend_from_slice(&self.base_token_used_max.to_le_bytes());
        data.extend_from_slice(&self.quote_token_used_max.to_le_bytes());

        data
    }
}

struct StartFarming {
    pool_token_amount: u64,
}

impl StartFarming {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [150, 205, 185, 109, 97, 202, 68, 110];

        let mut data =
            Vec::with_capacity(prefix.len() + mem::size_of::<u64>() * 3);

        data.extend_from_slice(&prefix);
        data.extend_from_slice(&self.pool_token_amount.to_le_bytes());

        data
    }
}

struct EndFarming;

impl EndFarming {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [49, 90, 68, 217, 222, 198, 89, 21];

        prefix.to_vec()
    }
}

struct RedeemBasket {
    redemption_size: u64,
    base_token_returned_min: u64,
    quote_token_returned_min: u64,
}

impl RedeemBasket {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [37, 133, 222, 57, 189, 160, 151, 41];

        let mut data =
            Vec::with_capacity(prefix.len() + mem::size_of::<u64>() * 3);

        data.extend_from_slice(&prefix);
        data.extend_from_slice(&self.redemption_size.to_le_bytes());
        data.extend_from_slice(&self.base_token_returned_min.to_le_bytes());
        data.extend_from_slice(&self.quote_token_returned_min.to_le_bytes());

        data
    }
}

struct WithdrawFarmed;

impl WithdrawFarmed {
    fn instruction_data() -> Vec<u8> {
        let prefix = [175, 95, 99, 74, 63, 66, 237, 61];

        let mut data =
            Vec::with_capacity(prefix.len() + mem::size_of::<u64>() * 3);

        data.extend_from_slice(&prefix);

        data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_serializes_swap_into_instruction_data() {
        assert_eq!(
            Swap {
                tokens: 1,
                min_tokens: 2,
                side: Side::Bid,
            }
            .instruction_data(),
            vec![
                248, 198, 158, 145, 225, 117, 135, 200, 1, 0, 0, 0, 0, 0, 0, 0,
                2, 0, 0, 0, 0, 0, 0, 0, 0
            ]
        );

        assert_eq!(
            Swap {
                tokens: 800,
                min_tokens: 303,
                side: Side::Ask,
            }
            .instruction_data(),
            vec![
                248, 198, 158, 145, 225, 117, 135, 200, 32, 3, 0, 0, 0, 0, 0,
                0, 47, 1, 0, 0, 0, 0, 0, 0, 1
            ]
        );
    }

    #[test]
    fn it_serializes_create_basket_into_instruction_data() {
        assert_eq!(
            CreateBasket {
                creation_size: 10,
                base_token_used_max: 5,
                quote_token_used_max: 8
            }
            .instruction_data(),
            vec![
                47, 105, 155, 148, 15, 169, 202, 211, 10, 0, 0, 0, 0, 0, 0, 0,
                5, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0
            ]
        );

        assert_eq!(
            CreateBasket {
                creation_size: 1,
                base_token_used_max: 2,
                quote_token_used_max: 3
            }
            .instruction_data(),
            vec![
                47, 105, 155, 148, 15, 169, 202, 211, 1, 0, 0, 0, 0, 0, 0, 0,
                2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0
            ]
        );
    }

    #[test]
    fn it_serializes_start_farming_into_instruction_data() {
        assert_eq!(
            StartFarming {
                pool_token_amount: 10
            }
            .instruction_data(),
            vec![150, 205, 185, 109, 97, 202, 68, 110, 10, 0, 0, 0, 0, 0, 0, 0]
        );
    }

    #[test]
    fn it_serializes_redeem_basket_into_instruction_data() {
        assert_eq!(
            RedeemBasket {
                redemption_size: 10,
                base_token_returned_min: 1238,
                quote_token_returned_min: 19,
            }
            .instruction_data(),
            vec![
                37, 133, 222, 57, 189, 160, 151, 41, 10, 0, 0, 0, 0, 0, 0, 0,
                214, 4, 0, 0, 0, 0, 0, 0, 19, 0, 0, 0, 0, 0, 0, 0
            ]
        );
    }

    #[test]
    fn it_serializes_withdrew_farmed_into_instruction_data() {
        assert_eq!(
            WithdrawFarmed::instruction_data(),
            vec![175, 95, 99, 74, 63, 66, 237, 61]
        );
    }

    #[test]
    fn it_scales_down_decimal_when_multiplied_by_percent() {
        let compound_fee = PercentageInt::new(10);
        let farmed_market_price = Decimal::from(150u64);

        let uac_fee = farmed_market_price
            .try_mul(Decimal::from_percent(compound_fee))
            .unwrap();

        assert_eq!(uac_fee, Decimal::from(15u64));
    }
}
