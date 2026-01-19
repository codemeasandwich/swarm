"""
Authentication module with login functionality.
"""

import hashlib
import secrets


# Simulated user database (in production, use a real database)
_users_db = {}


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hash a password with a salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hashed.hex(), salt


def register_user(username: str, password: str) -> bool:
    """Register a new user with username and password."""
    if not username or not password:
        return False
    if username in _users_db:
        return False

    hashed_password, salt = hash_password(password)
    _users_db[username] = {
        'password_hash': hashed_password,
        'salt': salt
    }
    return True


def login(username: str, password: str) -> bool:
    """
    Validate username and password for login.

    Args:
        username: The username to authenticate
        password: The password to validate

    Returns:
        True if credentials are valid, False otherwise
    """
    if not username or not password:
        return False

    if username not in _users_db:
        return False

    user = _users_db[username]
    hashed_password, _ = hash_password(password, user['salt'])

    return secrets.compare_digest(hashed_password, user['password_hash'])
