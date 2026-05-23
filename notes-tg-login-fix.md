# Telegram Login Fix Analysis

## Problem
"Bot domain invalid" error when clicking Telegram Login button.

## Root Cause
The current code uses the LEGACY Telegram OAuth URL format:
```
https://oauth.telegram.org/auth?bot_id=${cleanUsername}&origin=${origin}&embed=1&request_access=write&return_to=${callbackUrl}
```

But Telegram has updated their login system to use OIDC (OpenID Connect). The new format requires:
- `client_id` (numeric bot ID from BotFather)
- `redirect_uri` (must be pre-registered in BotFather's "Allowed URLs")
- `response_type=code`
- `scope=openid profile`
- `state` (CSRF protection)
- `code_challenge` + `code_challenge_method=S256` (PKCE)

## Key Points from Official Docs
1. BotFather now shows "Web Login" > "Allowed URLs" - must add redirect_uri there
2. BotFather provides Client ID and Client Secret
3. The flow is: auth code → exchange for id_token → validate JWT

## Solution Options
1. Use the new Telegram Login JS library (`telegram-login.js`) with `Telegram.Login.auth()`
2. Implement full OIDC Authorization Code Flow with PKCE manually

## BotFather "Allowed URLs" 
User needs to add: `https://game.verapoker.com/api/telegram/widget-callback`
(or whatever redirect_uri we use)
