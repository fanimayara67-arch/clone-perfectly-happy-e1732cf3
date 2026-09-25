import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(line => /^VITE_SUPABASE_(URL|PUBLISHABLE_KEY)=/.test(line)).map(line => {
  const pos=line.indexOf('='); return [line.slice(0,pos),line.slice(pos+1).trim().replace(/^['"]|['"]$/g,'')];
}));
const base=new URL(env.VITE_SUPABASE_URL);
if (base.hostname !== 'lzojkwcfqsigcgmelguu.supabase.co') throw new Error('Projeto diferente do configurado; interrompido');
const res=await fetch(new URL('/rest/v1/survey_responses?select=verified_source_key&limit=0',base),{
  headers: { apikey:env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` }, signal:AbortSignal.timeout(20000)
});
const body=await res.json();
console.log(JSON.stringify({check:'new_database_column_readonly',http:res.status,code:body?.code ?? null,columnAvailable:res.ok}));
for (const url of ['https://pesquisa-uniftc-jdbzk6svm-fanimayara67-archs-projects.vercel.app','https://pesquisa-gllp1-ehongzsnw-fanimayara67-archs-projects.vercel.app']) {
 const page=await fetch(url,{signal:AbortSignal.timeout(20000)});
 console.log(JSON.stringify({check:'existing_deployment',url,http:page.status,redirected:page.redirected}));
}
