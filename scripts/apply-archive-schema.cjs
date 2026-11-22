// Additive deployment helper for archive tables and indexes.
const fs=require('node:fs');const {PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL)process.loadEnvFile('.env');
const db=new PrismaClient();
(async()=>{const sql=['20261117_market_archive','20261122_archive_daily'].map(dir=>fs.readFileSync(`prisma/migrations/${dir}/migration.sql`,'utf8')).join('\n');const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);for(const statement of statements){const clean=statement.replace(/--[^\n]*/g,'').trim();if(!/^CREATE (TABLE|UNIQUE INDEX|INDEX) IF NOT EXISTS/.test(clean))throw new Error('Unexpected non-additive statement');}await db.$transaction(async tx=>{for(const statement of statements)await tx.$executeRawUnsafe(statement);},{timeout:30000});console.log('Archive schema ready (additive tables only)');await db.$disconnect()})().catch(async()=>{console.error('Archive schema setup failed; sensitive details omitted');await db.$disconnect();process.exit(1)});
