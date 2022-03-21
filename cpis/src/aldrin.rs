use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    program::{invoke, invoke_signed},
};
use std::mem;

pub struct StakeCpi<'info> {
    pub amm_program: Pubkey,
    pub pool: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    pub farming_ticket: AccountInfo<'info>,
    pub lp_token_freeze_vault: AccountInfo<'info>,
    pub user_lp_wallet: AccountInfo<'info>,
    pub user: AccountInfo<'info>,
    pub market_obligation_pda: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub clock: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
}

impl<'info> StakeCpi<'info> {
    pub fn stake(self, seeds: &[&[u8]], stake_lp_amount: u64) -> ProgramResult {
        let start_farming_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new(*self.farming_ticket.key, false),
            AccountMeta::new(*self.lp_token_freeze_vault.key, false),
            AccountMeta::new(*self.user_lp_wallet.key, false),
            AccountMeta::new_readonly(*self.user.key, true),
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
            self.user_lp_wallet,
            self.market_obligation_pda,
            self.user,
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

pub struct SwapCpi<'info> {
    pub amm_program: Pubkey,
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    pub pool_mint: AccountInfo<'info>,
    pub base_token_vault: AccountInfo<'info>,
    pub quote_token_vault: AccountInfo<'info>,
    pub fee_pool_wallet: AccountInfo<'info>,
    pub user: AccountInfo<'info>,
    pub user_base_wallet: AccountInfo<'info>,
    pub user_quote_wallet: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
}

impl<'info> SwapCpi<'info> {
    pub fn swap(
        self,
        swap_amount: u64,
        min_swap_return: u64,
        is_ask: bool,
    ) -> ProgramResult {
        let swap_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.pool_mint.key(), false),
            AccountMeta::new(self.base_token_vault.key(), false),
            AccountMeta::new(self.quote_token_vault.key(), false),
            AccountMeta::new(*self.fee_pool_wallet.key, false),
            AccountMeta::new_readonly(*self.user.key, true),
            AccountMeta::new(self.user_base_wallet.key(), false),
            AccountMeta::new(self.user_quote_wallet.key(), false),
            AccountMeta::new_readonly(*self.token_program.key, false),
        ];
        let swap_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool,
            self.pool_signer,
            self.pool_mint,
            self.base_token_vault,
            self.quote_token_vault,
            self.fee_pool_wallet,
            self.user,
            self.user_base_wallet,
            self.user_quote_wallet,
            self.token_program,
        ];
        let swap_data = Swap {
            tokens: swap_amount,
            min_tokens: min_swap_return,
            is_ask,
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

pub struct GetLpTokensCpi<'info> {
    pub amm_program: Pubkey,
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    pub pool_mint: AccountInfo<'info>,
    pub base_token_vault: AccountInfo<'info>,
    pub quote_token_vault: AccountInfo<'info>,
    pub user_lp_wallet: AccountInfo<'info>,
    pub user: AccountInfo<'info>,
    pub user_base_wallet: AccountInfo<'info>,
    pub user_quote_wallet: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub clock: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
}

impl<'info> GetLpTokensCpi<'info> {
    pub fn exchange_constituent_tokens_for_lp_tokens(
        self,
        stake_lp_amount: u64,
        base_token_used_max: u64,
        quote_token_used_max: u64,
    ) -> ProgramResult {
        let create_basket_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new(self.pool_mint.key(), false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.user_base_wallet.key(), false),
            AccountMeta::new(self.user_quote_wallet.key(), false),
            AccountMeta::new(self.base_token_vault.key(), false),
            AccountMeta::new(self.quote_token_vault.key(), false),
            AccountMeta::new(*self.user_lp_wallet.key, false),
            AccountMeta::new_readonly(*self.user.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
            AccountMeta::new_readonly(*self.rent.key, false),
        ];
        let create_basket_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool,
            self.pool_mint,
            self.pool_signer,
            self.user_base_wallet,
            self.user_quote_wallet,
            self.base_token_vault,
            self.quote_token_vault,
            self.user_lp_wallet,
            self.user,
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

pub struct UnstakeCpi<'info> {
    pub amm_program: Pubkey,
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    pub farming_ticket: AccountInfo<'info>,
    pub farming_snapshots: AccountInfo<'info>,
    pub lp_token_freeze_vault: AccountInfo<'info>,
    pub caller_lp_wallet: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub clock: AccountInfo<'info>,
    pub rent: AccountInfo<'info>,
}

impl<'info> UnstakeCpi<'info> {
    pub fn unstake(&mut self, seeds: &[&[u8]]) -> ProgramResult {
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

pub struct WithdrawFarmCpi<'info> {
    pub amm_program: Pubkey,
    pub pool: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    pub farming_calc: AccountInfo<'info>,
    pub farm_token_vault: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    pub caller_farm_wallet: AccountInfo<'info>,
    pub farming_ticket_owner_pda: AccountInfo<'info>,
    pub token_program: AccountInfo<'info>,
    pub clock: AccountInfo<'info>,
}

impl<'info> WithdrawFarmCpi<'info> {
    pub fn withdraw_farm(&self, seeds: &[&[u8]]) -> ProgramResult {
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

struct Swap {
    tokens: u64,
    min_tokens: u64,
    is_ask: bool,
}

impl Swap {
    fn instruction_data(&self) -> Vec<u8> {
        let prefix = [248, 198, 158, 145, 225, 117, 135, 200];

        let mut data = Vec::with_capacity(
            prefix.len() + mem::size_of::<u64>() * 2 + mem::size_of::<bool>(),
        );

        data.extend_from_slice(&prefix);
        data.extend_from_slice(&self.tokens.to_le_bytes());
        data.extend_from_slice(&self.min_tokens.to_le_bytes());
        data.push(self.is_ask as u8);

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
                is_ask: false,
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
                is_ask: true,
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
}
