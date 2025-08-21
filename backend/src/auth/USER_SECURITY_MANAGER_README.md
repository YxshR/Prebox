# UserSecurityManager

The UserSecurityManager implements per-user JWT security for enhanced authentication security. Instead of using a single global JWT secret for all users, each user has their own unique JWT secrets stored in the database.

## Features

- **Per-User JWT Secrets**: Each user has unique `jwt_secret` and `jwt_refresh_secret` stored in the database
- **Enhanced Security**: Compromising one user's token doesn't affect other users
- **Automatic Secret Generation**: Secrets are automatically generated during user registration
- **Token Validation**: Validates tokens using user-specific secrets
- **Secret Rotation**: Supports rotating user secrets for enhanced security

## Database Schema

The following columns were added to the `users` table:

```sql
ALTER TABLE users 
ADD COLUMN jwt_secret VARCHAR(255) NOT NULL,
ADD COLUMN jwt_refresh_secret VARCHAR(255) NOT NULL;
```

## Usage

### Basic Usage

```typescript
import { UserSecurityManager } from './user-security-manager.service';

const userSecurityManager = new UserSecurityManager();

// Generate JWT secrets for a new user
const secrets = await userSecurityManager.generateUserJWTSecrets(userId);

// Generate access token with user-specific secret
const accessToken = await userSecurityManager.generateUserAccessToken(user);

// Validate token with user-specific secret
const decoded = await userSecurityManager.validateTokenWithUserLookup(token);
```

### Integration with AuthService

The AuthService has been updated to use UserSecurityManager:

```typescript
// In AuthService.register()
const jwtSecrets = await this.userSecurityManager.generateUserJWTSecrets(userId);

// In AuthService.login()
const accessToken = await this.userSecurityManager.generateUserAccessToken(user);
const refreshToken = await this.userSecurityManager.generateUserRefreshToken(user);

// In AuthService.validateToken()
const decoded = await this.userSecurityManager.validateTokenWithUserLookup(token);
```

### Integration with AuthMiddleware

The AuthMiddleware automatically uses the updated AuthService, so no changes are needed. The middleware will now validate tokens using user-specific secrets.

## Security Benefits

1. **Isolation**: Each user's tokens are isolated from others
2. **Reduced Impact**: Compromising one user's secret doesn't affect others
3. **Individual Rotation**: Secrets can be rotated per user without affecting others
4. **Enhanced Audit**: Token validation can be traced to specific user secrets

## API Methods

### `generateUserJWTSecrets(userId: string): Promise<JWTSecrets>`
Generates new JWT secrets for a user and stores them in the database.

### `getUserJWTSecrets(userId: string): Promise<JWTSecrets>`
Retrieves JWT secrets for a specific user from the database.

### `generateUserAccessToken(user: User): Promise<string>`
Generates an access token using the user's specific JWT secret.

### `generateUserRefreshToken(user: User): Promise<string>`
Generates a refresh token using the user's specific JWT refresh secret.

### `validateUserAccessToken(token: string, userId: string): Promise<UserTokenPayload>`
Validates an access token using the specified user's JWT secret.

### `validateTokenWithUserLookup(token: string): Promise<UserTokenPayload>`
Validates a token by first extracting the user ID, then validating with that user's secret.

### `rotateUserSecrets(userId: string): Promise<JWTSecrets>`
Rotates (regenerates) JWT secrets for a user.

### `ensureUserJWTSecrets(userId: string): Promise<JWTSecrets>`
Ensures a user has JWT secrets, creating them if they don't exist.

## Migration

The migration script `001_add_user_jwt_secrets.sql` adds the required columns and populates existing users with generated secrets.

To run the migration:

```bash
node run-jwt-secrets-migration.js
```

## Testing

Comprehensive unit tests are provided in `user-security-manager.service.test.ts`. The tests cover:

- JWT secret generation and storage
- Token generation and validation
- Error handling for invalid tokens
- User mismatch detection
- Secret rotation functionality

## Requirements Satisfied

This implementation satisfies the following requirements from the home page redesign spec:

- **6.1**: Generate unique JWT_SECRET and JWT_REFRESH_SECRET for each user
- **6.3**: Use user's individual JWT secrets for token generation
- **6.5**: Validate tokens using user-specific secrets from the database