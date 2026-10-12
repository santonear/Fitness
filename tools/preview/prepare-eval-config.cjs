const fs=require('fs'); const config={quotaUnderstand:8,quotaGenerate:4,monthlyBudgetFen:3000,reservationFen:300,maxConcurrent:1,retentionDays:30,dailyMessageLimit:100}; const state={versions:[{version:1,config,actor:'preview-evaluation',at:Date.now(),requestId:require('crypto').randomUUID()}],announcement:null,receipts:{}};
fs.mkdirSync('.secrets',{recursive:true});
fs.writeFileSync('.secrets/assistant-eval-config.sql',"UPDATE admin_finance SET state='"+JSON.stringify(state)+"',revision=revision+1 WHERE id=1;");
