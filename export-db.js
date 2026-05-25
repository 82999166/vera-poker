const fs = require('fs');
const path = require('path');

// 读取 drizzle schema 文件
const schemaPath = path.join(__dirname, 'drizzle', 'schema.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// 创建导出文件
const exportContent = `# Vera Poker - Database Schema & Backup

## Database Connection
- Host: gateway03.us-east-1.prod.aws.tidbcloud.com
- Port: 4000
- Database: PcTA5UMUHYgGBBmnDjVX7Q
- User: Egqgwtf2w1Dcuzo

## Database Schema

\`\`\`typescript
${schemaContent}
\`\`\`

## Tables Overview

The database includes the following tables:
- users: Player accounts and balances
- rooms: Poker tables/rooms
- room_players: Player seats at tables
- admin_users: Admin accounts
- system_configs: System configuration
- faq_entries: FAQ entries
- cs_messages: Customer service messages
- agent_relationships: Agent relationships
- commission_records: Commission records
- __drizzle_migrations: Migration history

## Data Export Instructions

To export the full database:
\`\`\`bash
mysql -h gateway03.us-east-1.prod.aws.tidbcloud.com \\
  -u Egqgwtf2w1Dcuzo.root \\
  -p<password> \\
  -P 4000 \\
  PcTA5UMUHYgGBBmnDjVX7Q \\
  --ssl-mode=REQUIRED > database-backup.sql
\`\`\`

Or use mysqldump:
\`\`\`bash
mysqldump -h gateway03.us-east-1.prod.aws.tidbcloud.com \\
  -u Egqgwtf2w1Dcuzo.root \\
  -p<password> \\
  -P 4000 \\
  --ssl-mode=REQUIRED \\
  PcTA5UMUHYgGBBmnDjVX7Q > database-backup.sql
\`\`\`
`;

fs.writeFileSync(path.join(__dirname, 'DATABASE.md'), exportContent);
console.log('Database documentation created: DATABASE.md');
