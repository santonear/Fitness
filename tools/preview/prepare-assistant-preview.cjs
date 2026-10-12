const fs=require('fs'),crypto=require('crypto');
const {join}=require('path');
const rand=()=>crypto.randomBytes(32).toString('hex');
fs.mkdirSync('.secrets',{recursive:true});
const secretsPath='.secrets/assistant-preview-secrets.json';
if(!fs.existsSync(secretsPath))throw Error('Preview secrets missing from .secrets; do not regenerate deployed keys');
const secrets=JSON.parse(fs.readFileSync(secretsPath,'utf8'));
if(!secrets.CONTROL_ADMIN_SECRET||!secrets.CONTROL_DIGEST_SECRET)throw Error('Preview control secrets incomplete');
if(!secrets.DEEPSEEK_API_KEY){
 const envPath='.secrets/deepseek-eval.env';
 if(!fs.existsSync(envPath))throw Error('Evaluation key missing from .secrets');
 const env=fs.readFileSync(envPath,'utf8');
 const key=env.match(/^\s*DEEPSEEK_API_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];if(!key)throw Error('Evaluation key not configured');
 secrets.DEEPSEEK_API_KEY=key;fs.writeFileSync(secretsPath,JSON.stringify(secrets));
}
const hash=v=>crypto.createHmac('sha256',secrets.CONTROL_DIGEST_SECRET).update(v).digest('hex');
if(!fs.existsSync('.secrets/assistant-preview-seed.sql')){
const token=rand(),invite=rand(),subject=crypto.randomUUID();
const state={version:1,aiEnabled:true,recoveryRequired:false,invites:{[hash(invite)]:{expiresAt:Date.now()+30*86400000,redeemed:false}},subjects:{[subject]:{expiresAt:Date.now()+30*86400000,revoked:false}},sessions:{[hash(token)]:{subjectId:subject,revoked:false}},usages:{},budgets:{},requests:{},audit:[]};
let sql='CREATE TABLE IF NOT EXISTS control_ledger (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL,state TEXT NOT NULL);\nINSERT OR IGNORE INTO control_ledger VALUES(1,0,\''+JSON.stringify(state)+'\');\n';
for(const file of fs.readdirSync('migrations/admin').filter(f=>f.endsWith('.sql')).sort())sql+=fs.readFileSync(join('migrations/admin',file),'utf8')+'\n';
fs.writeFileSync('.secrets/assistant-preview-seed.sql',sql);
fs.writeFileSync('.secrets/assistant-eval-cookie.txt','__Host-fitness_trial='+token);
fs.writeFileSync('.secrets/assistant-preview-invite.txt',invite);
}console.log('Isolated preview secrets and synthetic-only initialization prepared; no values printed');
