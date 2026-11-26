import assert from 'node:assert/strict';
import fs from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/client.edge');
const base=process.env.TEST_FRONT_ORIGIN||'http://127.0.0.1:3101';
const api=process.env.TEST_API_ORIGIN||'http://127.0.0.1:8001';
assert.equal(new URL(base).port,'3101','Use the isolated integration preview, never the live preview');
assert.equal(new URL(api).port,'8001','Use the isolated API');
let checks=0;
async function page(path,contains){console.log('Checking',path);const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();if(contains)assert.ok(html.includes(contains),path+' content');checks++;return html;}
const homeHtml=await page('/','Accueil HTTP');assert.ok(homeHtml.includes('Section accueil HTTP'));checks++;
await page('/pages/contenu-http','Texte CMS HTTP');await page('/technologies/technique-http','Technique HTTP');await page('/blog','Aucun article pour le moment.');await page('/sav','service après-vente');await page('/contact','Écrire à l’équipe');const productHtml=await page('/produits/cf-ei60-90','EI60');
assert.ok(productHtml.includes('Repère HTTP'));assert.ok(productHtml.includes('Largeur HTTP'));assert.match(productHtml,/<(?:del|s)[ >]/);checks+=3;
await page('/packs','Lot HTTP');await page('/l/page-http','Bannière HTTP');
const redirect=await fetch(base+'/ancien-http',{redirect:'manual'});assert.equal(redirect.status,301);assert.match(redirect.headers.get('location'),/\/l\/page-http$/);checks++;
const promoCatalog=await fetch(api+'/api/catalog').then(r=>r.json());const promoted=promoCatalog.find(p=>p.id==='CF-EI60-90');assert.equal(promoted.price,1980);assert.equal(promoted.compareAt,2200);checks++;
const catalogue=await fetch(api+'/api/catalogue.pdf');assert.equal(catalogue.status,200);assert.equal((await catalogue.text()).slice(0,4),'%PDF');checks++;
const packReply=await fetch(api+'/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test pack HTTP',phone:'0612345678',city:'Casablanca',pickup:true,items:[{id:'pack:pack-http',qty:1}]})});assert.equal(packReply.status,201);const packPending=await packReply.json();const packQuote=await fetch(api+'/api/quotes/'+packPending.token).then(r=>r.json());assert.equal(packQuote.totalTtc,3900);assert.equal(packQuote.number,null);checks++;

const login=await page('/admin/login','Filament');
const assets=[...login.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).filter(v=>/\/(?:css|js|fonts)\/filament|\/livewire\/livewire/.test(v));
for(const url of assets){console.log('Asset',new URL(url,base).pathname);const u=new URL(url,base);assert.equal(u.origin,new URL(base).origin,'Asset must use the page origin');const response=await fetch(u);assert.equal(response.status,200,u.pathname);await response.arrayBuffer();checks++;}
const guard=await fetch(base+'/admin/products',{redirect:'manual'});assert.equal(guard.status,302);assert.match(guard.headers.get('location'),/\/admin\/login$/);checks++;
const publicOrigin='https://theme-mayflower-boasting.ngrok-free.dev';
const publicHeaders={Host:new URL(publicOrigin).host,'X-Forwarded-Proto':'https'};
// Native HTTP preserves an explicit Host header; fetch/undici can replace it with the connection authority.
async function publicProxyRequest(path){return new Promise((resolve,reject)=>{const req=httpRequest(new URL(path,base),{headers:publicHeaders},response=>{let body='';response.setEncoding('utf8');response.on('data',part=>body+=part);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}));});req.on('error',reject);req.end();});}
const publicLogin=await publicProxyRequest('/admin/login');assert.equal(publicLogin.status,200);
const publicHtml=publicLogin.body;
for(const match of publicHtml.matchAll(/(?:href|src|action)="([^"]+)"/g)){
  if(/\/(?:css|js|fonts)\/filament|\/livewire\//.test(match[1]))assert.equal(new URL(match[1],publicOrigin).origin,publicOrigin,'Public login asset must not contain the internal port');
}
const publicGuard=await publicProxyRequest('/admin');
assert.equal(publicGuard.status,302);assert.equal(new URL(publicGuard.headers.location,publicOrigin).origin,publicOrigin);checks+=2;
const form=await page('/devis','quote-form');
const formToken=form.match(/\d{13}\.[\w-]{43}/)?.[0];assert.ok(formToken,'Signed form token rendered');
const chunk=fs.readdirSync('.next/static/chunks/app/devis').find(f=>f.startsWith('page-')&&f.endsWith('.js'));
const js=fs.readFileSync('.next/static/chunks/app/devis/'+chunk,'utf8');
const action=js.match(/createServerReference\)\("([a-f0-9]+)"[^;]{0,200}"createQuote"/)?.[1];assert.ok(action,'Quote action reference');
const fd=new FormData();for(const [k,v]of Object.entries({formToken,website:'',clientType:'particulier',name:'Test HTTP isolé',phone:'0612345678',email:'test@example.test',city:'Casablanca',pickup:'1',items:JSON.stringify([{id:'CF-EI60-90',qty:1}]),note:'',custom:'0',locale:'fr'}))fd.set(k,v);
await new Promise(resolve=>setTimeout(resolve,3100));
const reply=await fetch(base+'/devis',{method:'POST',headers:{'Next-Action':action,Origin:base},body:await encodeReply([null,fd]),redirect:'manual'});
const location=reply.headers.get('x-action-redirect');const responseText=await reply.text();
assert.ok(location?.includes('/devis/confirmation/'),'Quote action redirected to private confirmation: HTTP '+reply.status+' '+responseText.slice(0,180));
const token=location.match(/confirmation\/([\w-]{32})/)?.[1];assert.ok(token);checks++;
const q=await fetch(api+'/api/quotes/'+token).then(r=>r.json());assert.equal(q.status,'à valider');assert.equal(q.number,null);assert.equal(q.pdf,null);assert.equal(q.totalTtc,1980);checks++;
await page('/devis/confirmation/'+token,'Demande reçue');await page('/devis/suivi/'+token,'Demande en cours de validation');
const pdf=await fetch(base+'/devis/pdf/'+token);assert.equal(pdf.status,404);checks++;
const checkout=await page('/commande','checkout-form');
const orderToken=checkout.match(/\d{13}\.[\w-]{43}/)?.[0];assert.ok(orderToken);
function actionReference(dir,name){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory()){const found=actionReference(path,name);if(found)return found;}else if(path.endsWith('.js')){const content=fs.readFileSync(path,'utf8');const match=content.match(new RegExp('createServerReference\\)\\("([a-f0-9]+)"[^;]{0,200}"'+name+'"'));if(match)return match[1];}}}
const orderAction=actionReference('.next/static/chunks','createOrder');assert.ok(orderAction);
const orderData=new FormData();for(const[k,v]of Object.entries({formToken:orderToken,website:'',customerName:'Test commande HTTP isolée',phone:'0612345678',city:'Casablanca',email:'test@example.test',deliveryMode:'retrait',paymentMethod:'virement',items:JSON.stringify([{id:'CF-EI60-90',qty:1}]),coupon:'HTTP50',attribution:JSON.stringify({utmSource:'http-test'})}))orderData.set(k,v);
await new Promise(resolve=>setTimeout(resolve,3100));
const orderResponse=await fetch(base+'/commande',{method:'POST',headers:{'Next-Action':orderAction,Origin:base},body:await encodeReply([null,orderData]),redirect:'manual'});
const orderLocation=orderResponse.headers.get('x-action-redirect');await orderResponse.text();assert.ok(orderLocation?.includes('/commande/confirmation/'),'Order action redirected');checks++;
const orderHtml=await page(orderLocation.split(';')[0],'Demande reçue');assert.match(orderHtml,/1[\s\u00a0\u202f]*930/,'Active price and coupon reflected in the SSR confirmation');checks++;
const publicConfig=await fetch(api+'/api/site-config').then(r=>r.json());assert.equal(publicConfig.theme.accent,'copper');assert.equal(publicConfig.seo.noindex,true);assert.ok(!JSON.stringify(publicConfig).includes('resendKey'));checks++;
const contactReply=await fetch(api+'/api/contacts',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({kind:'contact',name:'Test contact HTTP',phone:'0612345678',subject:'Question de test',message:'Message HTTP isolé.'})});assert.equal(contactReply.status,201);checks++;
console.log(`PASS: ${checks} HTTP integration checks (Next SSR → Laravel catalog, Server Action → API quote pending, private pages, auth and assets).`);
