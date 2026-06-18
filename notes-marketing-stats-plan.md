# Marketing Stats & Links Improvement Plan

## What needs to be added:

### 1. Financial Stats APIs (backend)
Need to add aggregate stats endpoints for:
- **Coupons**: Total claims, total amount distributed, recent claims list
- **Checkin**: Total checkins, total rewards distributed, recent claims
- **First Deposit Bonus**: Total claims, total bonus distributed
- **Time-Limited Events**: No financial tracking yet (events don't directly distribute funds)
- **Red Packets**: Already has detail view with claims
- **Fission**: Already has totalRewardPaid in campaign data
- **Invite Rewards**: Already has stats endpoint

### 2. Activity Links (frontend)
Need to show/copy activity links for:
- **Fission**: Already has copyLink with `/api/ref/{code}` - but should also show TG bot link: `t.me/{botUsername}/app?startapp=fission_{code}`
- **Red Packets**: Need to show TG link: `t.me/{botUsername}/app?startapp=hongbao_{id}`
- **Coupons**: Show the coupon code (already shown) + TG deep link for redeem page
- **Checkin**: Show TG deep link to checkin page
- **Invite**: Show TG deep link (already in user profile)

### 3. Frontend Changes
For each panel that needs financial stats:
- Add a summary stats section (total distributed, total claims count)
- Add a "资金明细" (financial details) expandable section or dialog
- Add "复制活动链接" button where applicable

## Implementation Strategy:
1. Add backend APIs for stats (one combined endpoint per module)
2. Update frontend panels to show stats + links
