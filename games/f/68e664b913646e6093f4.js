(function(){
 'use strict';
 const cfg=window.KJT394VERSES;
 if(!cfg?.daily?.text||!Array.isArray(cfg.pool)||!cfg.pool.length)return;
 function start(){
  const heading=document.querySelector('#verse-of-the-day-title');if(!heading)return;
  const section=heading.closest('section');if(!section)return;
  const quote=section.querySelector('blockquote');
  const ref=quote?.nextElementSibling;
  if(!quote||!ref)return;
  const buttons=[...section.querySelectorAll('button')];
  /* 7.19.8: the buttons are found by their English words, also on a translated page */
  const words=b=>{let t=b.textContent||'';try{if(window.KJT_LANG&&KJT_LANG.en)t+=' '+KJT_LANG.en(b)}catch(e){}return t};
  const random=buttons.find(b=>/random verse/i.test(words(b)));
  const copy=buttons.find(b=>/copy verse/i.test(words(b)));
  const label=heading.parentElement?.querySelector('span');
  if(label && /^KJV/.test(label.textContent?.trim()||''))label.textContent=/kjva/i.test(cfg.translation)?'KJVA':'KJV';
  let current=cfg.daily, last=-1;
  /* 7.8.3: the reference opens the passage in the Bible reader (on the Bible page itself, without reloading) */
  function linkFor(v){
   if(!v.link)return '';
   try{const u=new URL(v.link,location.href);if(u.pathname===location.pathname)return u.hash;return u.href;}catch(e){return v.link;}
  }
  /* 7.19.1: the words of Christ in red. In English exactly (v.wj.s: where they are in the text); in another
     language, from that language's Bible: the whole passage when it is all His words, or what follows "Jesus said:" */
  if(!document.getElementById('kjt-vwj-css')){const st=document.createElement('style');st.id='kjt-vwj-css';st.textContent='.kjt-vwj{color:#b3121f}.kjt-vwj--light{color:#ffb3b8}';document.head.appendChild(st);}
  /* light text (a dark box): a light red; dark text: a deep red */
  const light=(()=>{try{const c=getComputedStyle(quote).color.match(/\d+/g).map(Number);return (0.299*c[0]+0.587*c[1]+0.114*c[2])>150;}catch(e){return false;}})();
  function paint(t,wj,exact){
   quote.textContent='';
   const parts=[];
   if(wj&&exact&&wj.s&&wj.m!=='all'){let at=0;wj.s.split(',').forEach(r=>{const q=r.split('-'),a=+q[0],b=+q[1];if(!(b>a)||a<at)return;if(a>at)parts.push([t.slice(at,a),0]);parts.push([t.slice(a,b),1]);at=b;});if(at<t.length)parts.push([t.slice(at),0]);}
   else if(wj&&wj.m==='all')parts.push([t,1]);
   else if(wj&&wj.m==='intro'){let i=t.search(/[:\uFF1A]/);if(i<0||i>t.length*0.6)i=t.search(/[,\uFF0C\u060C]/);if(i<0||i>t.length*0.6)parts.push([t,0]);else{let k=i+1;while(k<t.length&&/\s/.test(t[k]))k++;parts.push([t.slice(0,k),0],[t.slice(k),1]);}}
   else parts.push([t,0]);
   quote.appendChild(document.createTextNode('“'));
   parts.forEach(x=>{if(!x[0])return;if(x[1]){const sp=document.createElement('span');sp.className='kjt-vwj'+(light?' kjt-vwj--light':'');sp.textContent=x[0];quote.appendChild(sp);}else quote.appendChild(document.createTextNode(x[0]));});
   quote.appendChild(document.createTextNode('”'));
  }
  function draw(v){
   current=v;quote.setAttribute('data-kjt-notr','');paint(v.text,v.wj,true);
   /* 7.9.0: Kids Corner in another language shows the verse from that language's Bible */
   const m=/#\/p\/[^/]+\/([^/]+)\/(\d+)\/(\d+)(?:-(\d+))?/.exec(v.link||'');
   if(m&&window.KJT_KIDS_PASSAGE)window.KJT_KIDS_PASSAGE(decodeURIComponent(m[1]),+m[2],+m[3],m[4]?+m[4]:0).then(t=>{if(t&&current===v)paint(t,v.wj,t===v.text);});
   /* 7.9.14: every other page in another language does the same through the site's language helper */
   else if(m&&window.KJT_LANG&&KJT_LANG.lang!=='en'&&KJT_LANG.passage)KJT_LANG.passage(decodeURIComponent(m[1]),+m[2],+m[3],m[4]?+m[4]:+m[3]).then(t=>{if(t&&current===v)paint(t,v.wj,false);});
   const href=linkFor(v);
   if(!href){ref.textContent=v.reference;return;}
   let a=ref.querySelector('a.kjt-verse-ref');
   if(!a){ref.textContent='';a=document.createElement('a');a.className='kjt-verse-ref';a.title='Read it in the Bible';ref.appendChild(a);}
   a.href=href;a.textContent=v.reference+' ';
   const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='\u2197';a.appendChild(arrow);
  }
  draw(current);
  if(!window.KJT_KIDS_PASSAGE)window.addEventListener('kjt-kids-passage-ready',()=>draw(current),{once:true});
  if(random){random.disabled=false;random.removeAttribute('aria-busy');
   random.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(!cfg.pool.length)return;
    let index=Math.floor(Math.random()*cfg.pool.length);
    if(cfg.pool.length>1 && (index===last || cfg.pool[index].id===current.id))index=(index+1)%cfg.pool.length;
    last=index;draw(cfg.pool[index]);
   },true);
  }
  /* 7.19.8: the reference first, then the verse as it is shown (in the page's language) */
  if(copy)copy.addEventListener('click',event=>{
   event.preventDefault();event.stopImmediatePropagation();
   const shown=(quote.textContent||'').trim()||('“'+current.text+'”');
   const out=current.reference+'\n'+shown;
   const done=()=>{const keep=copy.innerHTML;copy.textContent='✓ '+(window.KJT_LANG&&KJT_LANG.t?KJT_LANG.t('Copied'):'Copied');setTimeout(()=>{copy.innerHTML=keep},1800)};
   if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(out).then(done).catch(()=>{});
   else{const t=document.createElement('textarea');t.value=out;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){}t.remove()}
  },true);
  /* 7.24.4: Share and Picture beside Copy */
  const T=x=>{try{return window.KJT_LANG&&KJT_LANG.t?KJT_LANG.t(x):x}catch(e){return x}};
  const shownText=()=>((quote.textContent||'').trim().replace(/^[“"«]+|[”"»]+$/g,''))||current.text;
  const holder=(copy&&copy.parentNode)||(random&&random.parentNode);
  if(holder&&!section.querySelector('.kjt-votd-share')){
   const mk=(cls,txt,fn)=>{const b=document.createElement('button');b.type='button';b.className=((copy||random).className||'')+' '+cls;b.textContent=txt;b.addEventListener('click',fn);holder.appendChild(b);return b};
   /* 7.25.1: one Share button: the Share screen offers a picture or the text only (the old share when the screen cannot load) */
   const shb=mk('kjt-votd-share','\uD83D\uDCE4 '+T('Share'),()=>{const out=current.reference+'\n“'+shownText()+'”';const url=(()=>{try{return new URL(current.link||'',location.href).href}catch(e){return location.href}})();
    const old=()=>{if(navigator.share)navigator.share({title:current.reference,text:out,url:url}).catch(()=>{});else if(copy)copy.click();};
    if(!cfg.picture){old();return}
    const bible=(label&&label.textContent||'').trim(),go=()=>window.KJTB_VERSE_PICTURE?KJTB_VERSE_PICTURE({text:shownText(),ref:current.reference,bible:bible,share:'“'+shownText()+'”\n— '+current.reference+(bible?' ('+bible+')':'')+'\n'+url}):old();
    if(window.KJTB_VERSE_PICTURE){go();return}const sc=document.createElement('script');sc.src=cfg.picture;sc.onload=go;sc.onerror=old;document.head.appendChild(sc);});
   shb.style.cssText+=';background:#f3c548;border-color:#e0a92a;color:#2a0a2c;font-weight:800';
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
