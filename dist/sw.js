if(!self.define){let e,i={};const n=(n,r)=>(n=new URL(n+".js",r).href,i[n]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=i,document.head.appendChild(e)}else e=n,importScripts(n),i()})).then((()=>{let e=i[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e})));self.define=(r,o)=>{const c=e||("document"in self?document.currentScript.src:"")||location.href;if(i[c])return;let s={};const d=e=>n(e,c),t={module:{uri:c},exports:s,require:d};i[c]=Promise.all(r.map((e=>t[e]||d(e)))).then((e=>(o(...e),s)))}}define(["./workbox-2b403519"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"icon_144.png",revision:"549b1702e603c3d3032b18549366d8af"},{url:"icon_192.png",revision:"22634d508e81ae538a6db533544a1162"},{url:"icon_48.png",revision:"c2c3b03d09f326b7594049168b37a668"},{url:"icon_512.png",revision:"aa8d2ddb99ff256f266985c8b6503113"},{url:"icon_72.png",revision:"19d6019506f8bf941e117638c3cb400a"},{url:"icon_96.png",revision:"0c1ad1311e831169655090fa5d45e9cb"},{url:"index.html",revision:"56b2be8d83ffd57420a0a1013efdcb04"},{url:"manifest.json",revision:"448baa59c029d0f8547c7a56ed612951"},{url:"maskable_icon_x192.png",revision:"35edd005e618125fc93108bddcc10680"},{url:"script.js",revision:"34243a2881744871c61dd32e62e38a11"}],{ignoreURLParametersMatching:[/^utm_/,/^fbclid$/]})}));
