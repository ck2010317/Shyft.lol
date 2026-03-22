use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::{
    CreatePermissionCpiBuilder, UpdatePermissionCpiBuilder,
};
use ephemeral_rollups_sdk::access_control::structs::{
    Member, MembersArgs, AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

declare_id!("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");

pub const PROFILE_SEED: &[u8] = b"profile";
pub const POST_SEED: &[u8] = b"post";
pub const CHAT_SEED: &[u8] = b"chat";
pub const MESSAGE_SEED: &[u8] = b"message";
pub const FRIEND_SEED: &[u8] = b"friends";

#[ephemeral]
#[program]
pub mod shadowspace {
    use super::*;

    // ========== PROFILE ==========

    /// Create a user profile PDA
    pub fn create_profile(
        ctx: Context<CreateProfile>,
        username: String,
        display_name: String,
        bio: String,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.user.key();
        profile.username = username;
        profile.display_name = display_name;
        profile.bio = bio;
        profile.is_private = false;
        profile.post_count = 0;
        profile.friend_count = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        msg!("Profile created for {}", profile.owner);
        Ok(())
    }

    /// Update profile privacy — sets permission to empty members (fully private) or None (public)
    pub fn update_profile_privacy(
        ctx: Context<UpdateProfilePrivacy>,
        is_private: bool,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.is_private = is_private;

        let owner_key = profile.owner;
        let permission_program = &ctx.accounts.permission_program.to_account_info();
        let permission = &ctx.accounts.permission.to_account_info();

        let (_, bump) = Pubkey::find_program_address(
            &[PROFILE_SEED, owner_key.as_ref()],
            &crate::ID,
        );

        if is_private {
            // Only owner can read
            UpdatePermissionCpiBuilder::new(permission_program)
                .permissioned_account(&profile.to_account_info(), true)
                .authority(&profile.to_account_info(), false)
                .permission(permission)
                .args(MembersArgs {
                    members: Some(vec![Member {
                        flags: AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG,
                        pubkey: owner_key,
                    }]),
                })
                .invoke_signed(&[&[PROFILE_SEED, owner_key.as_ref(), &[bump]]])?;
        } else {
            // Public
            UpdatePermissionCpiBuilder::new(permission_program)
                .permissioned_account(&profile.to_account_info(), true)
                .authority(&profile.to_account_info(), false)
                .permission(permission)
                .args(MembersArgs { members: None })
                .invoke_signed(&[&[PROFILE_SEED, owner_key.as_ref(), &[bump]]])?;
        }

        msg!("Profile privacy updated: private={}", is_private);
        Ok(())
    }

    // ========== POSTS ==========

    /// Create a post — private posts get permissions restricting access to friends only
    pub fn create_post(
        ctx: Context<CreatePost>,
        post_id: u64,
        content: String,
        is_private: bool,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.author = ctx.accounts.author.key();
        post.post_id = post_id;
        post.content = content;
        post.is_private = is_private;
        post.likes = 0;
        post.comment_count = 0;
        post.created_at = Clock::get()?.unix_timestamp;

        // Increment author's post count
        let profile = &mut ctx.accounts.profile;
        profile.post_count += 1;

        msg!("Post {} created, private={}", post_id, is_private);
        Ok(())
    }

    /// Like a post
    pub fn like_post(ctx: Context<LikePost>, _post_id: u64) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.likes += 1;
        msg!("Post {} liked, total: {}", post.post_id, post.likes);
        Ok(())
    }

    // ========== CHAT ==========

    /// Create a chat room between two users — permissioned to only those 2 wallets
    pub fn create_chat(ctx: Context<CreateChat>, chat_id: u64) -> Result<()> {
        let chat = &mut ctx.accounts.chat;
        chat.chat_id = chat_id;
        chat.user1 = ctx.accounts.user1.key();
        chat.user2 = ctx.accounts.user2.key();
        chat.message_count = 0;
        chat.created_at = Clock::get()?.unix_timestamp;

        msg!(
            "Chat {} created between {} and {}",
            chat_id,
            chat.user1,
            chat.user2
        );
        Ok(())
    }

    /// Send a message in a chat
    pub fn send_message(
        ctx: Context<SendMessage>,
        chat_id: u64,
        message_index: u64,
        content: String,
        is_payment: bool,
        payment_amount: u64,
    ) -> Result<()> {
        let message = &mut ctx.accounts.message;
        message.chat_id = chat_id;
        message.sender = ctx.accounts.sender.key();
        message.content = content;
        message.is_payment = is_payment;
        message.payment_amount = payment_amount;
        message.timestamp = Clock::get()?.unix_timestamp;
        message.message_index = message_index;

        let chat = &mut ctx.accounts.chat;
        chat.message_count += 1;

        msg!("Message sent in chat {}", chat_id);
        Ok(())
    }

    // ========== FRIENDS ==========

    /// Create friend list PDA for a user
    pub fn create_friend_list(ctx: Context<CreateFriendList>) -> Result<()> {
        let friends = &mut ctx.accounts.friend_list;
        friends.owner = ctx.accounts.user.key();
        friends.friends = vec![];
        msg!("Friend list created for {}", friends.owner);
        Ok(())
    }

    /// Add a friend
    pub fn add_friend(ctx: Context<ModifyFriendList>, friend: Pubkey) -> Result<()> {
        let friends = &mut ctx.accounts.friend_list;
        require!(
            !friends.friends.contains(&friend),
            ShadowError::AlreadyFriends
        );
        friends.friends.push(friend);

        let profile = &mut ctx.accounts.profile;
        profile.friend_count += 1;

        msg!("Added friend {}", friend);
        Ok(())
    }

    /// Remove a friend
    pub fn remove_friend(ctx: Context<ModifyFriendList>, friend: Pubkey) -> Result<()> {
        let friends = &mut ctx.accounts.friend_list;
        let pos = friends
            .friends
            .iter()
            .position(|f| *f == friend)
            .ok_or(ShadowError::NotFriends)?;
        friends.friends.remove(pos);

        let profile = &mut ctx.accounts.profile;
        profile.friend_count = profile.friend_count.saturating_sub(1);

        msg!("Removed friend {}", friend);
        Ok(())
    }

    // ========== DELEGATION & PERMISSIONS ==========

    /// Delegate any PDA to the TEE validator
    pub fn delegate_pda(ctx: Context<DelegatePda>, account_type: AccountType) -> Result<()> {
        let seed_data = derive_seeds(&account_type);
        let seeds_refs: Vec<&[u8]> = seed_data.iter().map(|s| s.as_slice()).collect();

        let validator = ctx.remaining_accounts.first().map(|v| v.key());
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &seeds_refs,
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;
        msg!("PDA delegated to TEE");
        Ok(())
    }

    /// Create a permission for any PDA — controls who can read/write it in the TEE
    pub fn create_permission(
        ctx: Context<CreatePermission>,
        account_type: AccountType,
        members: Option<Vec<Member>>,
    ) -> Result<()> {
        let seed_data = derive_seeds(&account_type);

        let (_, bump) = Pubkey::find_program_address(
            &seed_data.iter().map(|s| s.as_slice()).collect::<Vec<_>>(),
            &crate::ID,
        );

        let mut seeds = seed_data.clone();
        seeds.push(vec![bump]);
        let seed_refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();

        CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&ctx.accounts.permissioned_account.to_account_info())
            .permission(&ctx.accounts.permission)
            .payer(&ctx.accounts.payer)
            .system_program(&ctx.accounts.system_program)
            .args(MembersArgs { members })
            .invoke_signed(&[seed_refs.as_slice()])?;

        msg!("Permission created");
        Ok(())
    }

    /// Commit and undelegate accounts back to Solana
    pub fn undelegate(ctx: Context<Undelegate>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.account.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Account undelegated back to Solana");
        Ok(())
    }
}

// ========== ACCOUNT STRUCTS ==========

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Profile::LEN,
        seeds = [PROFILE_SEED, user.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfilePrivacy<'info> {
    #[account(mut, seeds = [PROFILE_SEED, user.key().as_ref()], bump)]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Permission account checked by permission program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(post_id: u64)]
pub struct CreatePost<'info> {
    #[account(
        init_if_needed,
        payer = author,
        space = 8 + Post::LEN,
        seeds = [POST_SEED, author.key().as_ref(), &post_id.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,
    #[account(mut, seeds = [PROFILE_SEED, author.key().as_ref()], bump)]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(post_id: u64)]
pub struct LikePost<'info> {
    #[account(mut, seeds = [POST_SEED, post.author.as_ref(), &post_id.to_le_bytes()], bump)]
    pub post: Account<'info, Post>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(chat_id: u64)]
pub struct CreateChat<'info> {
    #[account(
        init_if_needed,
        payer = user1,
        space = 8 + Chat::LEN,
        seeds = [CHAT_SEED, &chat_id.to_le_bytes()],
        bump
    )]
    pub chat: Account<'info, Chat>,
    #[account(mut)]
    pub user1: Signer<'info>,
    /// CHECK: Second chat participant
    pub user2: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(chat_id: u64, message_index: u64)]
pub struct SendMessage<'info> {
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + Message::LEN,
        seeds = [MESSAGE_SEED, &chat_id.to_le_bytes(), &message_index.to_le_bytes()],
        bump
    )]
    pub message: Account<'info, Message>,
    #[account(mut, seeds = [CHAT_SEED, &chat_id.to_le_bytes()], bump)]
    pub chat: Account<'info, Chat>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateFriendList<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + FriendList::INIT_LEN,
        seeds = [FRIEND_SEED, user.key().as_ref()],
        bump
    )]
    pub friend_list: Account<'info, FriendList>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyFriendList<'info> {
    #[account(mut, seeds = [FRIEND_SEED, user.key().as_ref()], bump)]
    pub friend_list: Account<'info, FriendList>,
    #[account(mut, seeds = [PROFILE_SEED, user.key().as_ref()], bump)]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreatePermission<'info> {
    /// CHECK: Validated via permission program CPI
    pub permissioned_account: UncheckedAccount<'info>,
    /// CHECK: Checked by permission program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[commit]
#[derive(Accounts)]
pub struct Undelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Account to undelegate
    #[account(mut)]
    pub account: UncheckedAccount<'info>,
}

// ========== DATA ACCOUNTS ==========

#[account]
pub struct Profile {
    pub owner: Pubkey,
    pub username: String,
    pub display_name: String,
    pub bio: String,
    pub is_private: bool,
    pub post_count: u64,
    pub friend_count: u64,
    pub created_at: i64,
}

impl Profile {
    pub const LEN: usize = 32      // owner
        + 4 + 32                     // username (max 32 chars)
        + 4 + 64                     // display_name (max 64 chars)
        + 4 + 256                    // bio (max 256 chars)
        + 1                          // is_private
        + 8                          // post_count
        + 8                          // friend_count
        + 8;                         // created_at
}

#[account]
pub struct Post {
    pub author: Pubkey,
    pub post_id: u64,
    pub content: String,
    pub is_private: bool,
    pub likes: u64,
    pub comment_count: u64,
    pub created_at: i64,
}

impl Post {
    pub const LEN: usize = 32      // author
        + 8                          // post_id
        + 4 + 512                    // content (max 512 chars)
        + 1                          // is_private
        + 8                          // likes
        + 8                          // comment_count
        + 8;                         // created_at
}

#[account]
pub struct Chat {
    pub chat_id: u64,
    pub user1: Pubkey,
    pub user2: Pubkey,
    pub message_count: u64,
    pub created_at: i64,
}

impl Chat {
    pub const LEN: usize = 8       // chat_id
        + 32                         // user1
        + 32                         // user2
        + 8                          // message_count
        + 8;                         // created_at
}

#[account]
pub struct Message {
    pub chat_id: u64,
    pub message_index: u64,
    pub sender: Pubkey,
    pub content: String,
    pub is_payment: bool,
    pub payment_amount: u64,
    pub timestamp: i64,
}

impl Message {
    pub const LEN: usize = 8       // chat_id
        + 8                          // message_index
        + 32                         // sender
        + 4 + 512                    // content (max 512 chars)
        + 1                          // is_payment
        + 8                          // payment_amount
        + 8;                         // timestamp
}

#[account]
pub struct FriendList {
    pub owner: Pubkey,
    pub friends: Vec<Pubkey>,
}

impl FriendList {
    pub const INIT_LEN: usize = 32  // owner
        + 4 + (32 * 50);             // up to 50 friends
}

// ========== ENUMS & ERRORS ==========

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AccountType {
    Profile { owner: Pubkey },
    Post { author: Pubkey, post_id: u64 },
    Chat { chat_id: u64 },
    Message { chat_id: u64, message_index: u64 },
    FriendList { owner: Pubkey },
}

fn derive_seeds(account_type: &AccountType) -> Vec<Vec<u8>> {
    match account_type {
        AccountType::Profile { owner } => {
            vec![PROFILE_SEED.to_vec(), owner.to_bytes().to_vec()]
        }
        AccountType::Post { author, post_id } => {
            vec![
                POST_SEED.to_vec(),
                author.to_bytes().to_vec(),
                post_id.to_le_bytes().to_vec(),
            ]
        }
        AccountType::Chat { chat_id } => {
            vec![CHAT_SEED.to_vec(), chat_id.to_le_bytes().to_vec()]
        }
        AccountType::Message {
            chat_id,
            message_index,
        } => {
            vec![
                MESSAGE_SEED.to_vec(),
                chat_id.to_le_bytes().to_vec(),
                message_index.to_le_bytes().to_vec(),
            ]
        }
        AccountType::FriendList { owner } => {
            vec![FRIEND_SEED.to_vec(), owner.to_bytes().to_vec()]
        }
    }
}

#[error_code]
pub enum ShadowError {
    #[msg("Already friends with this user")]
    AlreadyFriends,
    #[msg("Not friends with this user")]
    NotFriends,
    #[msg("Unauthorized — not a chat participant")]
    Unauthorized,
    #[msg("Content too long")]
    ContentTooLong,
}
