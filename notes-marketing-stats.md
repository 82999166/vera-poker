# Marketing Financial Stats & Link Analysis

## Current State of Each Module:

### 1. 裂变活动 (FissionPanel)
- Has: clickCount, registerCount, convRate, totalRewardPaid
- Missing: 活动链接显示（有复制按钮但链接不可见）, 资金明细记录（每笔发放详情）
- Link: `${origin}/api/ref/${linkCode}` - needs visible display

### 2. 优惠券 (CouponsPanel)
- Has: usedCount/maxUses
- Missing: 总发放金额汇总, 使用明细记录（谁用了、什么时候用、金额多少）, 兑换码复制按钮

### 3. 签到奖励 (CheckinPanel)
- Has: 配置面板
- Missing: 签到统计汇总（今日签到人数、总发放金额、累计签到次数）, 签到明细

### 4. 邀请奖励 (InviteRewardPanel)
- Has: totalRewards, totalAmount, recentRewards
- Missing: 详细明细列表（谁邀请了谁、金额、时间）

### 5. 限时活动 (TimeLimitedEventsPanel)
- Has: 基本列表
- Missing: 参与人数统计, 活动资金发放汇总, 活动链接

### 6. 抢红包 (RedPacketPanel)
- Has: claimedCount/totalCount, claimedAmount, detail with leaderboard
- Missing: 红包链接显示和复制

### 7. 群发 (BroadcastPanel)
- Has: 发送统计
- Missing: N/A (群发本身不涉及资金)

## Plan:
1. Add a unified "活动资金汇总" stats card to: Fission, Coupons, Checkin, RedPacket, Events
2. Add "资金明细" expandable section showing individual transactions
3. Add visible link display + copy button to: Fission, RedPacket, Events
4. Backend: Add new API endpoints for financial details where missing
