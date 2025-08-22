import asyncio
import hashlib
import hmac
import secrets
import base64
import json
import jwt
import pyotp
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
import bcrypt
from cryptography.fernet import Fernet
import aioredis

class AuthenticationMethod(Enum):
    PASSWORD = "password"
    MFA_TOTP = "mfa_totp"
    MFA_SMS = "mfa_sms"
    BIOMETRIC = "biometric"
    CERTIFICATE = "certificate"
    SSO_SAML = "sso_saml"
    SSO_OAUTH = "sso_oauth"

class AccessLevel(Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class PermissionType(Enum):
    RESOURCE_ACCESS = "resource_access"
    SYSTEM_ADMIN = "system_admin"
    USER_MANAGEMENT = "user_management"
    SECURITY_ADMIN = "security_admin"
    AUDIT_ACCESS = "audit_access"
    API_ACCESS = "api_access"

class SessionStatus(Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    SUSPENDED = "suspended"

@dataclass
class Permission:
    id: str
    name: str
    type: PermissionType
    resource: str
    level: AccessLevel
    conditions: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class Role:
    id: str
    name: str
    description: str
    permissions: List[str]  # Permission IDs
    is_privileged: bool = False
    max_session_duration: int = 28800  # 8 hours
    requires_approval: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

@dataclass
class User:
    id: str
    username: str
    email: str
    full_name: str
    password_hash: str
    roles: List[str]  # Role IDs
    is_active: bool = True
    is_verified: bool = False
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    last_login: Optional[datetime] = None
    failed_login_attempts: int = 0
    account_locked_until: Optional[datetime] = None
    password_expires_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Session:
    id: str
    user_id: str
    status: SessionStatus
    created_at: datetime
    last_accessed: datetime
    expires_at: datetime
    ip_address: str
    user_agent: str
    mfa_verified: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AccessRequest:
    id: str
    user_id: str
    resource: str
    permission_type: PermissionType
    level: AccessLevel
    requested_at: datetime
    reason: str
    status: str = "pending"  # pending, approved, denied
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

@dataclass
class PrivilegedSession:
    id: str
    user_id: str
    role_id: str
    session_id: str
    started_at: datetime
    expires_at: datetime
    purpose: str
    approver_id: Optional[str] = None
    is_active: bool = True
    activities: List[Dict[str, Any]] = field(default_factory=list)

class PasswordPolicy:
    def __init__(self):
        self.min_length = 12
        self.require_uppercase = True
        self.require_lowercase = True
        self.require_digits = True
        self.require_special_chars = True
        self.max_age_days = 90
        self.password_history_count = 12
        self.prevent_common_passwords = True
        
    def validate(self, password: str, user: User = None) -> Tuple[bool, List[str]]:
        errors = []
        
        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long")
            
        if self.require_uppercase and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
            
        if self.require_lowercase and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
            
        if self.require_digits and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
            
        if self.require_special_chars and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Password must contain at least one special character")
            
        if self.prevent_common_passwords:
            common_passwords = ["password", "123456", "qwerty", "admin", "welcome"]
            if password.lower() in common_passwords:
                errors.append("Password is too common")
                
        return len(errors) == 0, errors

class CryptographyService:
    def __init__(self):
        self.fernet = Fernet(Fernet.generate_key())
        
    def hash_password(self, password: str) -> str:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
    def verify_password(self, password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        
    def encrypt_data(self, data: str) -> str:
        return self.fernet.encrypt(data.encode()).decode()
        
    def decrypt_data(self, encrypted_data: str) -> str:
        return self.fernet.decrypt(encrypted_data.encode()).decode()
        
    def generate_token(self, payload: Dict[str, Any], secret: str, expires_hours: int = 1) -> str:
        payload['exp'] = datetime.utcnow() + timedelta(hours=expires_hours)
        return jwt.encode(payload, secret, algorithm='HS256')
        
    def verify_token(self, token: str, secret: str) -> Optional[Dict[str, Any]]:
        try:
            return jwt.decode(token, secret, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

class MFAService:
    def __init__(self):
        self.crypto = CryptographyService()
        
    def generate_totp_secret(self) -> str:
        return pyotp.random_base32()
        
    def generate_qr_url(self, secret: str, user_email: str, issuer: str = "GMAC.IO") -> str:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(user_email, issuer_name=issuer)
        
    def verify_totp_code(self, secret: str, code: str, window: int = 1) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=window)
        
    def generate_backup_codes(self, count: int = 10) -> List[str]:
        return [secrets.token_hex(4) for _ in range(count)]
        
    async def send_sms_code(self, phone_number: str) -> str:
        # Generate 6-digit code
        code = f"{secrets.randbelow(1000000):06d}"
        # Simulate SMS sending
        await asyncio.sleep(1)
        logging.info(f"SMS code {code} sent to {phone_number}")
        return code

class AuthenticationService:
    def __init__(self, crypto_service: CryptographyService, mfa_service: MFAService):
        self.crypto = crypto_service
        self.mfa = mfa_service
        self.active_sessions = {}
        self.failed_attempts = {}
        self.password_policy = PasswordPolicy()
        self.session_timeout = 3600  # 1 hour
        self.max_failed_attempts = 5
        self.lockout_duration = 1800  # 30 minutes
        
    async def authenticate_user(self, username: str, password: str, 
                              mfa_code: Optional[str] = None) -> Tuple[bool, Optional[Session], str]:
        # Check if user exists and is active
        user = await self._get_user_by_username(username)
        if not user or not user.is_active:
            return False, None, "Invalid credentials"
            
        # Check account lockout
        if user.account_locked_until and user.account_locked_until > datetime.now():
            return False, None, "Account is locked"
            
        # Verify password
        if not self.crypto.verify_password(password, user.password_hash):
            await self._record_failed_attempt(user.id)
            return False, None, "Invalid credentials"
            
        # Check MFA if enabled
        if user.mfa_enabled:
            if not mfa_code:
                return False, None, "MFA code required"
                
            if not self.mfa.verify_totp_code(user.mfa_secret, mfa_code):
                await self._record_failed_attempt(user.id)
                return False, None, "Invalid MFA code"
                
        # Authentication successful
        await self._reset_failed_attempts(user.id)
        session = await self._create_session(user)
        
        return True, session, "Authentication successful"
        
    async def _get_user_by_username(self, username: str) -> Optional[User]:
        # Simulate database lookup
        return User(
            id="user123",
            username=username,
            email=f"{username}@example.com",
            full_name="Test User",
            password_hash=self.crypto.hash_password("password123"),
            roles=["user_role"],
            mfa_enabled=True,
            mfa_secret=self.mfa.generate_totp_secret()
        )
        
    async def _record_failed_attempt(self, user_id: str):
        if user_id not in self.failed_attempts:
            self.failed_attempts[user_id] = []
            
        self.failed_attempts[user_id].append(datetime.now())
        
        # Check if lockout needed
        recent_attempts = [
            attempt for attempt in self.failed_attempts[user_id]
            if attempt > datetime.now() - timedelta(minutes=15)
        ]
        
        if len(recent_attempts) >= self.max_failed_attempts:
            # Lock account
            pass  # In real implementation, update user record
            
    async def _reset_failed_attempts(self, user_id: str):
        if user_id in self.failed_attempts:
            del self.failed_attempts[user_id]
            
    async def _create_session(self, user: User) -> Session:
        session = Session(
            id=str(uuid.uuid4()),
            user_id=user.id,
            status=SessionStatus.ACTIVE,
            created_at=datetime.now(),
            last_accessed=datetime.now(),
            expires_at=datetime.now() + timedelta(seconds=self.session_timeout),
            ip_address="127.0.0.1",  # Would be actual IP
            user_agent="Test Client",
            mfa_verified=user.mfa_enabled
        )
        
        self.active_sessions[session.id] = session
        return session
        
    async def validate_session(self, session_id: str) -> Optional[Session]:
        if session_id not in self.active_sessions:
            return None
            
        session = self.active_sessions[session_id]
        
        if session.expires_at < datetime.now():
            session.status = SessionStatus.EXPIRED
            del self.active_sessions[session_id]
            return None
            
        # Update last accessed
        session.last_accessed = datetime.now()
        return session
        
    async def terminate_session(self, session_id: str) -> bool:
        if session_id in self.active_sessions:
            self.active_sessions[session_id].status = SessionStatus.TERMINATED
            del self.active_sessions[session_id]
            return True
        return False

class AuthorizationService:
    def __init__(self):
        self.permissions = {}
        self.roles = {}
        self.user_roles = {}
        self.temporary_permissions = {}
        
    def create_permission(self, name: str, permission_type: PermissionType, 
                         resource: str, level: AccessLevel, 
                         conditions: Dict[str, Any] = None) -> Permission:
        permission = Permission(
            id=str(uuid.uuid4()),
            name=name,
            type=permission_type,
            resource=resource,
            level=level,
            conditions=conditions or {}
        )
        
        self.permissions[permission.id] = permission
        return permission
        
    def create_role(self, name: str, description: str, permission_ids: List[str],
                   is_privileged: bool = False, requires_approval: bool = False) -> Role:
        role = Role(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            permissions=permission_ids,
            is_privileged=is_privileged,
            requires_approval=requires_approval
        )
        
        self.roles[role.id] = role
        return role
        
    async def check_permission(self, user_id: str, resource: str, 
                             permission_type: PermissionType, 
                             level: AccessLevel = AccessLevel.READ) -> bool:
        user_permissions = await self._get_user_permissions(user_id)
        
        for permission in user_permissions:
            if (permission.resource == resource and 
                permission.type == permission_type and
                self._check_access_level(permission.level, level) and
                self._evaluate_conditions(permission.conditions, user_id)):
                return True
                
        return False
        
    async def _get_user_permissions(self, user_id: str) -> List[Permission]:
        permissions = []
        user_role_ids = self.user_roles.get(user_id, [])
        
        for role_id in user_role_ids:
            if role_id in self.roles:
                role = self.roles[role_id]
                for permission_id in role.permissions:
                    if permission_id in self.permissions:
                        permissions.append(self.permissions[permission_id])
                        
        # Add temporary permissions
        temp_perms = self.temporary_permissions.get(user_id, [])
        permissions.extend(temp_perms)
        
        return permissions
        
    def _check_access_level(self, granted_level: AccessLevel, required_level: AccessLevel) -> bool:
        level_hierarchy = {
            AccessLevel.READ: 1,
            AccessLevel.WRITE: 2,
            AccessLevel.ADMIN: 3,
            AccessLevel.SUPER_ADMIN: 4
        }
        
        return level_hierarchy[granted_level] >= level_hierarchy[required_level]
        
    def _evaluate_conditions(self, conditions: Dict[str, Any], user_id: str) -> bool:
        # Simple condition evaluation
        if not conditions:
            return True
            
        # Time-based conditions
        if 'time_range' in conditions:
            time_range = conditions['time_range']
            current_hour = datetime.now().hour
            if not (time_range['start'] <= current_hour <= time_range['end']):
                return False
                
        # IP-based conditions
        if 'allowed_ips' in conditions:
            # In real implementation, would check actual user IP
            pass
            
        return True
        
    def assign_role_to_user(self, user_id: str, role_id: str):
        if user_id not in self.user_roles:
            self.user_roles[user_id] = []
        if role_id not in self.user_roles[user_id]:
            self.user_roles[user_id].append(role_id)
            
    def revoke_role_from_user(self, user_id: str, role_id: str):
        if user_id in self.user_roles and role_id in self.user_roles[user_id]:
            self.user_roles[user_id].remove(role_id)

class PrivilegedAccessManager:
    def __init__(self, auth_service: AuthenticationService, authz_service: AuthorizationService):
        self.auth_service = auth_service
        self.authz_service = authz_service
        self.privileged_sessions = {}
        self.access_requests = {}
        self.approval_workflows = {}
        
    async def request_privileged_access(self, user_id: str, role_id: str, 
                                      purpose: str, duration_hours: int = 4) -> str:
        request = AccessRequest(
            id=str(uuid.uuid4()),
            user_id=user_id,
            resource=role_id,
            permission_type=PermissionType.SYSTEM_ADMIN,
            level=AccessLevel.ADMIN,
            requested_at=datetime.now(),
            reason=purpose
        )
        
        self.access_requests[request.id] = request
        
        # Check if role requires approval
        role = self.authz_service.roles.get(role_id)
        if role and role.requires_approval:
            await self._initiate_approval_workflow(request)
        else:
            await self._auto_approve_request(request)
            
        return request.id
        
    async def _initiate_approval_workflow(self, request: AccessRequest):
        # Simulate approval workflow
        await asyncio.sleep(1)
        logging.info(f"Approval workflow initiated for request {request.id}")
        
    async def _auto_approve_request(self, request: AccessRequest):
        request.status = "approved"
        request.approved_at = datetime.now()
        
    async def start_privileged_session(self, request_id: str, session_id: str) -> Optional[str]:
        if request_id not in self.access_requests:
            return None
            
        request = self.access_requests[request_id]
        if request.status != "approved":
            return None
            
        privileged_session = PrivilegedSession(
            id=str(uuid.uuid4()),
            user_id=request.user_id,
            role_id=request.resource,
            session_id=session_id,
            started_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=4),
            purpose=request.reason,
            approver_id=request.approved_by
        )
        
        self.privileged_sessions[privileged_session.id] = privileged_session
        return privileged_session.id
        
    async def log_privileged_activity(self, privileged_session_id: str, 
                                    activity: Dict[str, Any]):
        if privileged_session_id in self.privileged_sessions:
            session = self.privileged_sessions[privileged_session_id]
            activity['timestamp'] = datetime.now().isoformat()
            session.activities.append(activity)
            
    async def end_privileged_session(self, privileged_session_id: str):
        if privileged_session_id in self.privileged_sessions:
            session = self.privileged_sessions[privileged_session_id]
            session.is_active = False
            
            # Generate access report
            report = {
                'session_id': privileged_session_id,
                'user_id': session.user_id,
                'duration': (datetime.now() - session.started_at).total_seconds(),
                'activities_count': len(session.activities),
                'purpose': session.purpose
            }
            
            logging.info(f"Privileged session ended: {report}")

class IdentityAccessManagementSystem:
    def __init__(self):
        self.crypto = CryptographyService()
        self.mfa = MFAService()
        self.auth_service = AuthenticationService(self.crypto, self.mfa)
        self.authz_service = AuthorizationService()
        self.pam = PrivilegedAccessManager(self.auth_service, self.authz_service)
        self.users = {}
        self.audit_log = []
        
    async def initialize(self):
        # Create default permissions
        read_perm = self.authz_service.create_permission(
            "System Read", PermissionType.RESOURCE_ACCESS, "system", AccessLevel.READ
        )
        
        admin_perm = self.authz_service.create_permission(
            "System Admin", PermissionType.SYSTEM_ADMIN, "system", AccessLevel.ADMIN
        )
        
        user_mgmt_perm = self.authz_service.create_permission(
            "User Management", PermissionType.USER_MANAGEMENT, "users", AccessLevel.WRITE
        )
        
        # Create default roles
        user_role = self.authz_service.create_role(
            "User", "Standard user role", [read_perm.id]
        )
        
        admin_role = self.authz_service.create_role(
            "Administrator", "System administrator role", 
            [read_perm.id, admin_perm.id, user_mgmt_perm.id],
            is_privileged=True, requires_approval=True
        )
        
        # Create test user
        await self.create_user(
            "admin", "admin@example.com", "Admin User", "SecurePass123!"
        )
        
        self.authz_service.assign_role_to_user("user123", user_role.id)
        
    async def create_user(self, username: str, email: str, full_name: str, 
                         password: str) -> Tuple[bool, str]:
        # Validate password
        valid, errors = self.auth_service.password_policy.validate(password)
        if not valid:
            return False, "; ".join(errors)
            
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            full_name=full_name,
            password_hash=self.crypto.hash_password(password),
            roles=[]
        )
        
        self.users[user.id] = user
        
        # Log user creation
        await self._log_audit_event("user_created", {
            'user_id': user.id,
            'username': username,
            'email': email
        })
        
        return True, "User created successfully"
        
    async def enable_mfa_for_user(self, user_id: str) -> Tuple[bool, Optional[str]]:
        if user_id not in self.users:
            return False, None
            
        user = self.users[user_id]
        secret = self.mfa.generate_totp_secret()
        user.mfa_secret = secret
        user.mfa_enabled = True
        
        qr_url = self.mfa.generate_qr_url(secret, user.email)
        
        await self._log_audit_event("mfa_enabled", {
            'user_id': user_id,
            'username': user.username
        })
        
        return True, qr_url
        
    async def login(self, username: str, password: str, 
                   mfa_code: Optional[str] = None) -> Tuple[bool, Optional[str], str]:
        success, session, message = await self.auth_service.authenticate_user(
            username, password, mfa_code
        )
        
        if success and session:
            await self._log_audit_event("user_login", {
                'user_id': session.user_id,
                'session_id': session.id,
                'ip_address': session.ip_address
            })
            return True, session.id, message
            
        return False, None, message
        
    async def check_access(self, session_id: str, resource: str, 
                          permission_type: PermissionType, 
                          level: AccessLevel = AccessLevel.READ) -> bool:
        session = await self.auth_service.validate_session(session_id)
        if not session:
            return False
            
        has_access = await self.authz_service.check_permission(
            session.user_id, resource, permission_type, level
        )
        
        await self._log_audit_event("access_check", {
            'user_id': session.user_id,
            'resource': resource,
            'permission_type': permission_type.value,
            'level': level.value,
            'granted': has_access
        })
        
        return has_access
        
    async def request_privileged_access(self, session_id: str, role_name: str, 
                                      purpose: str) -> Tuple[bool, Optional[str]]:
        session = await self.auth_service.validate_session(session_id)
        if not session:
            return False, None
            
        # Find role by name
        role_id = None
        for rid, role in self.authz_service.roles.items():
            if role.name == role_name:
                role_id = rid
                break
                
        if not role_id:
            return False, None
            
        request_id = await self.pam.request_privileged_access(
            session.user_id, role_id, purpose
        )
        
        return True, request_id
        
    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        sessions = []
        for session in self.auth_service.active_sessions.values():
            if session.user_id == user_id:
                sessions.append({
                    'id': session.id,
                    'created_at': session.created_at.isoformat(),
                    'last_accessed': session.last_accessed.isoformat(),
                    'ip_address': session.ip_address,
                    'status': session.status.value
                })
        return sessions
        
    async def get_audit_log(self, user_id: Optional[str] = None, 
                           event_type: Optional[str] = None,
                           limit: int = 100) -> List[Dict[str, Any]]:
        filtered_log = self.audit_log
        
        if user_id:
            filtered_log = [log for log in filtered_log 
                          if log.get('data', {}).get('user_id') == user_id]
            
        if event_type:
            filtered_log = [log for log in filtered_log 
                          if log.get('event_type') == event_type]
            
        return filtered_log[-limit:]
        
    async def _log_audit_event(self, event_type: str, data: Dict[str, Any]):
        audit_entry = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'data': data
        }
        
        self.audit_log.append(audit_entry)
        
        # Keep audit log size manageable
        if len(self.audit_log) > 10000:
            self.audit_log = self.audit_log[-5000:]
            
    async def get_system_stats(self) -> Dict[str, Any]:
        active_sessions = len(self.auth_service.active_sessions)
        total_users = len(self.users)
        privileged_sessions = len([s for s in self.pam.privileged_sessions.values() 
                                 if s.is_active])
        
        return {
            'active_sessions': active_sessions,
            'total_users': total_users,
            'privileged_sessions': privileged_sessions,
            'total_roles': len(self.authz_service.roles),
            'total_permissions': len(self.authz_service.permissions),
            'audit_events_today': len([log for log in self.audit_log 
                                     if log['timestamp'][:10] == datetime.now().strftime('%Y-%m-%d')])
        }

# Example usage
async def main():
    iam = IdentityAccessManagementSystem()
    await iam.initialize()
    
    # Create a user
    success, message = await iam.create_user(
        "john.doe", "john@example.com", "John Doe", "SecurePassword123!"
    )
    print(f"User creation: {success}, {message}")
    
    # Enable MFA
    success, qr_url = await iam.enable_mfa_for_user("user123")
    print(f"MFA enabled: {success}, QR URL: {qr_url}")
    
    # Login
    success, session_id, message = await iam.login("admin", "password123", "123456")
    print(f"Login: {success}, Session: {session_id}, Message: {message}")
    
    if session_id:
        # Check access
        has_access = await iam.check_access(
            session_id, "system", PermissionType.RESOURCE_ACCESS, AccessLevel.READ
        )
        print(f"Has read access: {has_access}")
        
        # Request privileged access
        success, request_id = await iam.request_privileged_access(
            session_id, "Administrator", "System maintenance"
        )
        print(f"Privileged access request: {success}, Request ID: {request_id}")
        
        # Get system stats
        stats = await iam.get_system_stats()
        print(f"System stats: {stats}")
        
        # Get audit log
        audit_entries = await iam.get_audit_log(limit=5)
        print(f"Recent audit entries: {len(audit_entries)}")

if __name__ == "__main__":
    asyncio.run(main())