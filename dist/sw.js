if(!self.define){let e,i={};const n=(n,r)=>(n=new URL(n+".js",r).href,i[n]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=i,document.head.appendChild(e)}else e=n,importScripts(n),i()})).then((()=>{let e=i[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e})));self.define=(r,f)=>{const o=e||("document"in self?document.currentScript.src:"")||location.href;if(i[o])return;let c={};const s=e=>n(e,o),d={module:{uri:o},exports:c,require:s};i[o]=Promise.all(r.map((e=>d[e]||s(e)))).then((e=>(f(...e),c)))}}define(["./workbox-2b403519"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"icon_144.png",revision:"6f642dce28260901954a1b2f84d7cf78"},{url:"icon_192.png",revision:"3eca8f7b206add5a787a63bbfa667700"},{url:"icon_48.png",revision:"cddea2e9af014f03ef309631a4775143"},{url:"icon_512.png",revision:"6485df9d009ea8b3ee6e99493e2f630f"},{url:"icon_72.png",revision:"d1f71c670fb74516c1b0c9710df758dc"},{url:"icon_96.png",revision:"d783e0cedcf4090e24980ffb18c16559"},{url:"index.html",revision:"95f76f6e545f56f72e2d533e96255627"},{url:"manifest.json",revision:"448baa59c029d0f8547c7a56ed612951"},{url:"maskable_icon_x192.png",revision:"2f1d95d8fac624707d1f1381fe82f32c"},{url:"script.js",revision:"f49904556dee014931e24013b138bb91"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]})}));
