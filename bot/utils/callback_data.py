"""Callback data serialization helpers."""
import json
from dataclasses import dataclass
from typing import Optional

from loguru import logger


@dataclass
class CallbackData:
    """Parsed callback data structure."""
    amount: int = 0
    type: Optional[str] = None  # exp, inc, trf, debt
    category: Optional[str] = None  # category_id
    category_name: Optional[str] = None
    source: Optional[str] = None  # source account_id
    destination: Optional[str] = None  # destination account_id
    account_name: Optional[str] = None
    msg_id: int = 0
    action: Optional[str] = None  # cancel, custom_cat, etc
    finalize: bool = False


def parse_callback(data: str) -> Optional[CallbackData]:
    """Parse JSON callback data into CallbackData object."""
    try:
        parsed = json.loads(data)
        
        return CallbackData(
            amount=parsed.get("a", 0),
            type=parsed.get("t"),
            category=parsed.get("c"),
            category_name=parsed.get("cn"),
            source=parsed.get("s"),
            destination=parsed.get("d"),
            account_name=parsed.get("an"),
            msg_id=parsed.get("m", 0),
            action=parsed.get("action"),
            finalize=parsed.get("f", False)
        )
        
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse callback data: {data}, error: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing callback: {e}")
        return None


def build_callback(
    amount: int = 0,
    type_code: Optional[str] = None,
    category_id: Optional[str] = None,
    category_name: Optional[str] = None,
    source_id: Optional[str] = None,
    account_name: Optional[str] = None,
    msg_id: int = 0,
    action: Optional[str] = None,
    finalize: bool = False
) -> str:
    """Build JSON callback data string."""
    data = {"m": msg_id}
    
    if amount:
        data["a"] = amount
    if type_code:
        data["t"] = type_code
    if category_id:
        data["c"] = category_id
    if category_name:
        data["cn"] = category_name[:10]  # Truncate for 64 byte limit
    if source_id:
        data["s"] = source_id
    if account_name:
        data["an"] = account_name[:10]
    if action:
        data["action"] = action
    if finalize:
        data["f"] = True
    
    result = json.dumps(data, separators=(",", ":"))  # Compact JSON
    
    # Warn if approaching limit
    if len(result) > 60:
        logger.warning(f"Callback data is {len(result)} bytes, limit is 64")
    
    return result
