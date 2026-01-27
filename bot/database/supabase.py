"""Supabase client and database operations."""
import uuid
from typing import List, Dict, Any, Optional
from datetime import date

from supabase import create_client, Client
from loguru import logger

from bot.config import config


# Global client
_client: Optional[Client] = None


def init_supabase() -> Client:
    """Initialize Supabase client."""
    global _client
    _client = create_client(config.supabase_url, config.supabase_key)
    return _client


def get_client() -> Client:
    """Get Supabase client, initializing if needed."""
    global _client
    if _client is None:
        _client = init_supabase()
    return _client


# ==================== Users ====================

async def get_user_by_telegram_id(telegram_id: int) -> Optional[Dict[str, Any]]:
    """Get user by telegram_id. Returns None if not found."""
    client = get_client()
    
    try:
        logger.info(f"Looking up user with telegram_id: {telegram_id}")
        response = client.table("profiles").select("*").eq("telegram_id", telegram_id).execute()
        logger.info(f"Response data: {response.data}")
        if response.data:
            logger.info(f"Found user: {response.data[0]}")
            return response.data[0]
        else:
            logger.warning(f"No user found for telegram_id: {telegram_id}")
    except Exception as e:
        logger.error(f"Error getting user by telegram: {e}")
    
    return None


async def get_profiles_without_telegram() -> List[Dict[str, Any]]:
    """Get profiles that don't have telegram_id linked."""
    client = get_client()
    
    try:
        response = client.table("profiles").select("id, display_name").is_("telegram_id", "null").execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error getting orphan profiles: {e}")
    
    return []


async def link_telegram_to_profile(profile_id: str, telegram_id: int) -> bool:
    """Link telegram_id to existing profile."""
    client = get_client()
    
    try:
        response = client.table("profiles").update({
            "telegram_id": telegram_id
        }).eq("id", profile_id).execute()
        
        return bool(response.data)
    except Exception as e:
        logger.error(f"Error linking telegram to profile: {e}")
    
    return False


async def create_new_profile_with_telegram(telegram_id: int, display_name: str) -> Optional[Dict[str, Any]]:
    """Create new profile with telegram_id and default data."""
    client = get_client()
    
    try:
        new_user = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "display_name": display_name,
            "settings": {"currency": "KZT", "timezone": "Asia/Almaty"}
        }
        
        response = client.table("profiles").insert(new_user).execute()
        
        if response.data:
            user = response.data[0]
            # Create default accounts and categories
            await create_default_data(user["id"])
            return user
            
    except Exception as e:
        logger.error(f"Error creating new profile: {e}")
    
    return None


async def get_or_create_user(telegram_id: int, display_name: str) -> Optional[Dict[str, Any]]:
    """Get existing user or create new one by telegram_id. (Legacy function)"""
    user = await get_user_by_telegram_id(telegram_id)
    if user:
        return user
    return await create_new_profile_with_telegram(telegram_id, display_name)


async def reset_user_data(telegram_id: int) -> bool:
    """Reset user data - delete all transactions but keep accounts/categories."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return False
    
    try:
        # Delete all transactions
        client.table("transactions").delete().eq("user_id", user_id).execute()
        
        # Reset account balances to 0
        client.table("accounts").update({"balance": 0}).eq("user_id", user_id).execute()
        
        logger.info(f"Reset data for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error resetting user data: {e}")
    
    return False


async def delete_profile(telegram_id: int) -> bool:
    """Delete profile and all associated data."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return False
    
    try:
        # Delete in order: transactions -> accounts -> categories -> profile
        client.table("transactions").delete().eq("user_id", user_id).execute()
        client.table("accounts").delete().eq("user_id", user_id).execute()
        client.table("categories").delete().eq("user_id", user_id).execute()
        client.table("profiles").delete().eq("id", user_id).execute()
        
        logger.info(f"Deleted profile {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting profile: {e}")
    
    return False


async def get_user_id_by_telegram(telegram_id: int) -> Optional[str]:
    """Get internal user ID by Telegram ID."""
    client = get_client()
    
    try:
        response = client.table("profiles").select("id").eq("telegram_id", telegram_id).execute()
        if response.data:
            return response.data[0]["id"]
    except Exception as e:
        logger.error(f"Error getting user_id: {e}")
    
    return None


# ==================== Default Data ====================

async def create_default_data(user_id: str):
    """Create default accounts and categories for new user."""
    client = get_client()
    
    # Default accounts
    default_accounts = [
        {"user_id": user_id, "name": "Kaspi Gold", "type": "asset", "icon": "💳", "sort_order": 1},
        {"user_id": user_id, "name": "Наличные", "type": "asset", "icon": "💵", "sort_order": 2},
        {"user_id": user_id, "name": "Halyk Bank", "type": "asset", "icon": "🏦", "sort_order": 3},
    ]
    
    # Default expense categories
    default_expense_categories = [
        {"user_id": user_id, "name": "Продукты", "type": "expense", "icon": "🛒", "is_frequent": True, "sort_order": 1},
        {"user_id": user_id, "name": "Кафе", "type": "expense", "icon": "🍔", "is_frequent": True, "sort_order": 2},
        {"user_id": user_id, "name": "Транспорт", "type": "expense", "icon": "🚕", "is_frequent": True, "sort_order": 3},
        {"user_id": user_id, "name": "Дом", "type": "expense", "icon": "🏠", "is_frequent": False, "sort_order": 4},
        {"user_id": user_id, "name": "Здоровье", "type": "expense", "icon": "💊", "is_frequent": False, "sort_order": 5},
        {"user_id": user_id, "name": "Развлечения", "type": "expense", "icon": "🎮", "is_frequent": False, "sort_order": 6},
        {"user_id": user_id, "name": "Одежда", "type": "expense", "icon": "👕", "is_frequent": False, "sort_order": 7},
        {"user_id": user_id, "name": "Подписки", "type": "expense", "icon": "📱", "is_frequent": False, "sort_order": 8},
    ]
    
    # Default income categories
    default_income_categories = [
        {"user_id": user_id, "name": "Зарплата", "type": "income", "icon": "💰", "is_frequent": True, "sort_order": 1},
        {"user_id": user_id, "name": "Фриланс", "type": "income", "icon": "💻", "is_frequent": True, "sort_order": 2},
        {"user_id": user_id, "name": "Подарки", "type": "income", "icon": "🎁", "is_frequent": False, "sort_order": 3},
    ]
    
    try:
        client.table("accounts").insert(default_accounts).execute()
        client.table("categories").insert(default_expense_categories + default_income_categories).execute()
        logger.info(f"Created default data for user {user_id}")
    except Exception as e:
        logger.error(f"Error creating default data: {e}")


# ==================== Accounts ====================

async def get_accounts(telegram_id: int, account_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get user accounts, optionally filtered by type."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return []
    
    try:
        query = client.table("accounts").select("*").eq("user_id", user_id).eq("is_hidden", False)
        
        if account_type:
            query = query.eq("type", account_type)
        
        response = query.order("sort_order").execute()
        return response.data or []
        
    except Exception as e:
        logger.error(f"Error getting accounts: {e}")
        return []


async def get_accounts_with_balance(telegram_id: int) -> List[Dict[str, Any]]:
    """Get all accounts with current balances."""
    # For now, return accounts with stored balance
    # In production, calculate from transactions
    return await get_accounts(telegram_id)


async def get_account_by_id(account_id: str) -> Optional[Dict[str, Any]]:
    """Get single account by ID with current balance."""
    client = get_client()
    
    try:
        response = client.table("accounts").select("*").eq("id", account_id).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        logger.error(f"Error getting account by id: {e}")
    
    return None


# ==================== Debt Accounts ====================

async def get_debt_accounts(telegram_id: int, debt_type: str) -> List[Dict[str, Any]]:
    """Get debt accounts (receivable for lent, liability for borrowed)."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return []
    
    # lent = someone owes me = receivable
    # borrowed = I owe someone = liability
    account_type = "receivable" if debt_type == "lent" else "liability"
    
    try:
        response = client.table("accounts").select("*").eq("user_id", user_id).eq("type", account_type).eq("is_hidden", False).order("name").execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error getting debt accounts: {e}")
    
    return []


async def create_debt_account(telegram_id: int, name: str, debt_type: str) -> Optional[Dict[str, Any]]:
    """Create a new debt account (receivable or liability)."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return None
    
    # lent = receivable (they owe me), borrowed = liability (I owe them)
    account_type = "receivable" if debt_type == "lent" else "liability"
    icon = "📥" if debt_type == "lent" else "📤"
    
    try:
        new_account = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": name,
            "type": account_type,
            "icon": icon,
            "balance": 0,
            "is_hidden": False,
            "sort_order": 99
        }
        
        response = client.table("accounts").insert(new_account).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        logger.error(f"Error creating debt account: {e}")
    
    return None


async def create_debt_transaction(
    telegram_id: int,
    debt_type: str,
    amount: int,
    source_account_id: str,
    counterparty_account_id: str
) -> Optional[Dict[str, Any]]:
    """Create a debt transaction.
    
    For 'lent' (дал в долг):
      - source_account loses money (e.g., Kaspi -20000)
      - counterparty_account (receivable) gains +20000 (they owe me)
    
    For 'borrowed' (взял в долг):
      - source_account gains money (e.g., Kaspi +20000)
      - counterparty_account (liability) gains +20000 (I owe them, negative conceptually)
    """
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return None
    
    from datetime import date
    
    transaction = {
        "user_id": user_id,
        "date": date.today().isoformat(),
        "type": "transfer",
        "amount": amount,
        "is_debt": True,
        "debt_direction": debt_type
    }
    
    if debt_type == "lent":
        # Money goes FROM source TO receivable
        transaction["from_account_id"] = source_account_id
        transaction["to_account_id"] = counterparty_account_id
    else:
        # Money goes FROM liability TO source
        transaction["from_account_id"] = counterparty_account_id
        transaction["to_account_id"] = source_account_id
    
    try:
        response = client.table("transactions").insert(transaction).execute()
        
        if response.data:
            # Update balances
            if debt_type == "lent":
                await update_account_balance(source_account_id, -amount)
                await update_account_balance(counterparty_account_id, amount)
            else:
                await update_account_balance(source_account_id, amount)
                await update_account_balance(counterparty_account_id, amount)  # liability grows positive
            
            return response.data[0]
    except Exception as e:
        logger.error(f"Error creating debt transaction: {e}")
    
    return None


# ==================== Categories ====================

async def get_categories(telegram_id: int, cat_type: str, frequent_only: bool = False) -> List[Dict[str, Any]]:
    """Get user categories by type (expense/income)."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return []
    
    try:
        query = client.table("categories").select("*").eq("user_id", user_id).eq("type", cat_type)
        
        if frequent_only:
            query = query.eq("is_frequent", True)
        
        response = query.order("sort_order").execute()
        return response.data or []
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        return []


# ==================== Transactions ====================

async def create_transaction(
    telegram_id: int,
    type_code: str,
    amount: int,
    category_id: Optional[str] = None,
    account_id: Optional[str] = None,
    from_account_id: Optional[str] = None,
    to_account_id: Optional[str] = None,
    note: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Create a new transaction."""
    client = get_client()
    user_id = await get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        return None
    
    # Map type code to full type name
    type_map = {
        "exp": "expense",
        "inc": "income",
        "trf": "transfer"
    }
    
    transaction = {
        "user_id": user_id,
        "date": date.today().isoformat(),
        "type": type_map.get(type_code, "expense"),
        "amount": amount,
        "category_id": category_id,
        "account_id": account_id,
        "from_account_id": from_account_id,
        "to_account_id": to_account_id,
        "note": note
    }
    
    # Remove None values
    transaction = {k: v for k, v in transaction.items() if v is not None}
    
    try:
        response = client.table("transactions").insert(transaction).execute()
        
        if response.data:
            # Update account balance
            if type_code == "exp" and account_id:
                await update_account_balance(account_id, -amount)
            elif type_code == "inc" and account_id:
                await update_account_balance(account_id, amount)
            elif type_code == "trf":
                if from_account_id:
                    await update_account_balance(from_account_id, -amount)
                if to_account_id:
                    await update_account_balance(to_account_id, amount)
            
            return response.data[0]
            
    except Exception as e:
        logger.error(f"Error creating transaction: {e}")
    
    return None


async def update_account_balance(account_id: str, delta: int):
    """Update account balance by delta."""
    client = get_client()
    
    try:
        # Get current balance
        response = client.table("accounts").select("balance").eq("id", account_id).execute()
        
        if response.data:
            current_balance = response.data[0].get("balance", 0) or 0
            new_balance = current_balance + delta
            
            client.table("accounts").update({"balance": new_balance}).eq("id", account_id).execute()
            
    except Exception as e:
        logger.error(f"Error updating balance: {e}")
