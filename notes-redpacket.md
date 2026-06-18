# Red Packet Feature Analysis

## Competitor Reference (KKPoker/永旺德州)
- Title: "500级别专属红包" (level-specific red packet)
- Total amount: 2,000 USDT, Total count: 30
- Claim condition: "最近2天500级别手数≥200" (200+ hands in last 2 days at 500 level)
- Type: "拼手气红包" (random amount red packet)
- Shows leaderboard: amount(time) - nickname, ranked by claim amount
- Shows "仅显示前15名，共30/30领取" (only shows top 15, 30/30 claimed)
- Bottom buttons: "领取红包" "一键注册" "领取记录" "官方频道"

## Broadcast Button Issue (Screenshot 1)
- Current UI shows: button text + button type label + row number + delete icon
- But NO URL/link input field visible in the screenshot
- The ButtonEditor in code DOES have url input: `<Input className="flex-1" placeholder="按钮链接 https://..." value={btn.url}`
- Wait - looking at screenshot more carefully, the layout shows: [text] [type badge] [row number] [delete]
- This is the USER's current view - they see "官方" "开始" "1" and "开游" "按钮" "1" etc.
- The issue: the first column shows button text, second shows what looks like a TYPE selector (not url), third shows row number
- Actually re-reading the code: the ButtonEditor has 3 inputs: text, url, row
- The screenshot shows the buttons as: "官方" | "开始" | 1 | delete - these map to text="官方", url="开始"(?), row=1
- The user filled "开始" in the URL field thinking it's a type selector

## Conclusion on Button Issue
Looking at the screenshot vs code:
- The ButtonEditor already has URL field (placeholder: "按钮链接 https://...")
- But the user's screenshot shows labels like "开始" "按钮" in what should be the URL field
- This suggests the user may have confused the fields, OR the UI labels aren't clear enough
- Need to add proper labels above each column to make it clearer
- Also need to check: the ButtonEditor shows text/url/row but there's no "type" selector (url vs callback)
- For TG inline buttons, there are two types: url buttons (opens link) and callback buttons (triggers bot action)
- The user wants a "type" selector: "官方" type=url, "开游" type=button(webapp), "领取" type=button(callback)

## Red Packet Feature Design
1. DB: red_packets table (id, title, totalAmount, totalCount, claimedCount, claimedAmount, type=random/fixed, condition JSON, status, createdAt, expiresAt, imageUrl)
2. DB: red_packet_claims table (id, redPacketId, userId, amount, claimedAt)
3. Backend: admin create/list/detail, user claim
4. Frontend admin: create red packet form (title, amount, count, condition, image)
5. Frontend user: claim page (in Mini App)
6. TG: send red packet message to channel/group with claim button
