# Button Fix Analysis

## Current State
- ButtonEditor (line 80-118): Has text/url/row fields. Works correctly for URL buttons.
- BroadcastPanel: Uses ButtonEditor correctly, passes buttons with text/url/row.
- TemplatesPanel: Uses ButtonEditor correctly.
- WelcomePanel: Uses ButtonEditor correctly.
- NotificationsPanel: MISSING image and buttons fields entirely in the create form.

## Issues Found
1. ButtonEditor lacks a "type" selector - TG supports: url (opens link), web_app (opens mini app), callback_data
   - For this poker app, buttons typically need: url (external link), web_app (open mini app URL)
   - The user's screenshot shows buttons like "官方频道" (url), "开游戏" (web_app), "领取红包" (callback/web_app)
   - Need to add a type dropdown: "链接" / "小程序" 
   - For "链接" type: url field is a regular URL
   - For "小程序" type: url field is a web_app URL

2. ButtonEditor needs column headers to be clearer

3. NotificationsPanel create dialog needs imageUrl + buttons fields added

## Fix Plan
1. Update ButtonEditor to add type selector (url/web_app) and column headers
2. Update NotificationsPanel to include imageUrl and buttons in form
3. Update backend broadcast execution to handle web_app type buttons
4. Update schema type to include button type field
