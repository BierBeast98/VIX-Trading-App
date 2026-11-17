// Additive deployment helper: only the three new archive tables and their indexes.
const fs=require('node:fs');const {PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL)process.loadEnvFile('.env');
const db=new PrismaClient();
(async()=>{const sql=fs.readFileSync('prisma/migrations/20261117_market_archive/migration.sql','utf8');const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);for(const statement of statements){const clean=statement.replace(/--[^\n]*/g,'').trim();if(!/^CREATE (TABLE|UNIQUE INDEX|INDEX) IF NOT EXISTS/.test(clean))throw new Error('Unexpected non-additive statement');}await db.$transaction(async tx=>{for(const statement of statements)await tx.$executeRawUnsafe(statement);},{timeout:30000});console.log('Archive schema ready (additive tables only)');await db.$disconnect()})().catch(async()=>{console.error('Archive schema setup failed; sensitive details omitted');await db.$disconnect();process.exit(1)});
