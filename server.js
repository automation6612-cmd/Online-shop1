const express=require("express"),fs=require("fs"),path=require("path");
const app=express(),PORT=process.env.PORT||3000,TOKEN=process.env.ADMIN_TOKEN||"change-me";
const DB=path.join(__dirname,"data","orders.json");
const products=JSON.parse(fs.readFileSync(path.join(__dirname,"products.json"),"utf8"));
fs.mkdirSync(path.dirname(DB),{recursive:true});
const load=()=>{try{return JSON.parse(fs.readFileSync(DB,"utf8"))}catch{return[]}};
const save=a=>fs.writeFileSync(DB,JSON.stringify(a,null,2));
const rate={};
app.set("trust proxy",1);
app.use(express.json({limit:"20kb"}));
app.use((q,r,n)=>{const k=q.ip,t=Date.now();rate[k]=(rate[k]||[]).filter(x=>t-x<6e4);
  if(q.method==="POST"&&rate[k].push(t)>10)return r.status(429).json({error:"Too many requests"});n()});
app.get("/api/products",(q,r)=>r.json(products));
app.post("/api/orders",(q,r)=>{
  const{customer:c={},items=[]}=q.body||{};
  const s=v=>String(v||"").trim().slice(0,300);
  if(!s(c.name)||!s(c.phone)||!s(c.address)||!Array.isArray(items)||!items.length||items.length>30)
    return r.status(400).json({error:"Invalid order"});
  let total=0;const lines=[];
  for(const i of items){ // prices always come from the server, never the browser
    const p=products.find(x=>x.id===i.id),v=p&&p.variants.find(x=>x.key===i.variant),qty=Math.floor(i.qty);
    if(!v||!(qty>0&&qty<=20))return r.status(400).json({error:"Invalid item"});
    total+=v.price*qty;lines.push({id:p.id,variant:v.key,name:v.name,price:v.price,qty});
  }
  const o={id:"MD"+Date.now().toString(36).toUpperCase(),status:"new",createdAt:new Date().toISOString(),
    customer:{name:s(c.name),email:s(c.email),phone:s(c.phone),address:s(c.address)},items:lines,total};
  const all=load();all.push(o);save(all);
  r.status(201).json({id:o.id,total});
});
const auth=(q,r,n)=>q.get("x-admin-token")===TOKEN?n():r.status(401).json({error:"Unauthorized"});
app.get("/api/admin/orders",auth,(q,r)=>r.json(load().reverse()));
app.patch("/api/admin/orders/:id",auth,(q,r)=>{
  const all=load(),o=all.find(x=>x.id===q.params.id);if(!o)return r.sendStatus(404);
  if(["new","confirmed","shipped","delivered","cancelled"].includes(q.body.status))o.status=q.body.status;
  save(all);r.json(o)});
app.use(express.static(path.join(__dirname,"public")));
app.listen(PORT,()=>console.log("mdar running on :"+PORT));
