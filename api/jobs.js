// Optional live job search powered by Adzuna. API credentials remain server-side.
"use strict";
const L = require("./_lib.js");
const COUNTRIES = new Set(["us","gb","in","ca","au","de","fr","nl","sg","za","nz","ie","pl","br","at","ch","es","it"]);
const clean = (v, n=160) => String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0,n);
module.exports = async (req,res) => {
  if (!L.originOk(req)) return L.send(res,403,{ok:false,message:"Requests from this site are not allowed."});
  if (req.method === "GET") return L.send(res,200,{ok:true,configured:!!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),provider:"Adzuna",message:process.env.ADZUNA_APP_ID&&process.env.ADZUNA_APP_KEY?"Live search is configured.":"Set ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel to enable live listings."});
  if (req.method !== "POST") return L.send(res,405,{ok:false,message:"Use POST."});
  const b = await L.body(req), query = clean(b.query,100), location = clean(b.location,100), country = clean(b.country,2).toLowerCase();
  if (!query) return L.send(res,400,{ok:false,message:"Enter a job title or keyword."});
  if (!COUNTRIES.has(country)) return L.send(res,400,{ok:false,message:"Unsupported country. Choose a supported market."});
  const id = String(process.env.ADZUNA_APP_ID || "").trim(), key = String(process.env.ADZUNA_APP_KEY || "").trim();
  if (!id || !key) return L.send(res,503,{ok:false,message:"Live search needs ADZUNA_APP_ID and ADZUNA_APP_KEY configured in Vercel. Global job-board links still work without them."});
  const user = await L.userFrom(req), limit = user ? 30 : 12, usageKey = user ? "jobs:u:"+user.id : "jobs:g:"+L.hash(L.ipOf(req));
  const n = await L.bump(usageKey,limit,1); if (n < 0) return L.send(res,429,{ok:false,message:"Daily live-search limit reached. Try again tomorrow."});
  try {
    const params = new URLSearchParams({app_id:id,app_key:key,results_per_page:"20",what:query,"content-type":"application/json",sort_by:"date"});
    if (location) params.set("where",location);
    if (b.remote) params.set("what_or","remote work from home");
    if (b.fresher) { params.set("what_exclude","senior sr lead principal manager head director architect staff"); params.set("max_days_old","45"); }
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
    const response = await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
    if (!response.ok) { await L.bump(usageKey,limit,-1); return L.send(res,response.status===429?429:502,{ok:false,message:response.status===401||response.status===403?"Adzuna rejected the API credentials. Check ADZUNA_APP_ID and ADZUNA_APP_KEY.":"The live job provider is temporarily unavailable. Try the job-board links."}); }
    const data = await response.json();
    const jobs = (Array.isArray(data.results)?data.results:[]).map(j=>({
      externalId:clean(j.id,100), title:clean(j.title,180), company:clean(j.company&&j.company.display_name,180),
      location:clean(j.location&&j.location.display_name,180), url:/^https?:\/\//i.test(String(j.redirect_url||""))?String(j.redirect_url):"",
      description:clean(j.description,1800), posted:clean(j.created,40), salaryMin:Number.isFinite(+j.salary_min)&&j.salary_min!=null?+j.salary_min:null,
      salaryMax:Number.isFinite(+j.salary_max)&&j.salary_max!=null?+j.salary_max:null, salaryCurrency:country==="gb"?"GBP":country==="us"?"USD":country==="in"?"INR":country==="ca"?"CAD":country==="au"?"AUD":""
    })).filter(j=>j.title&&j.url&&(!b.fresher||!/\b(senior|sr\.?|lead|principal|manager|head|director|architect|staff|[5-9]\+? ?years?|1[0-9] ?years?)\b/i.test(j.title)));
    await L.logEvent(req,{kind:"job_search",detail:country,page:"global-jobs",uid:user?user.id:null,email:user?user.email:null});
    return L.send(res,200,{ok:true,provider:"Adzuna",count:Number(data.count)||jobs.length,jobs,attribution:{label:"Jobs by Adzuna",url:country==="gb"?"https://www.adzuna.co.uk/":country==="in"?"https://www.adzuna.in/":"https://www.adzuna.com/"}});
  } catch(e) { await L.bump(usageKey,limit,-1); return L.send(res,502,{ok:false,message:"Could not reach the live job provider. Please try again."}); }
};
