document.addEventListener('DOMContentLoaded',function(){
  document.addEventListener('click',function(e){document.querySelectorAll('.bfp-mobile-toggle[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open');});});
  // Exported category links used index.html#id. They are normalized in the build; this also protects future imported fragments.
  document.querySelectorAll('a[href*="index.html#"]').forEach(a=>{a.href='#'+a.href.split('#')[1]});
  // Make category tiles keyboard/click usable even when the original export attached the link to a child only.
  document.querySelectorAll('#categories [role="link"]').forEach(tile=>{let a=tile.querySelector('a[href^="#"]');if(!a)return;tile.addEventListener('click',e=>{if(e.target.closest('a'))return;location.hash=a.getAttribute('href')});tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.hash=a.getAttribute('href')}})});
  // Add a consistent category navigator when a long page has useful section ids but no exported navigator.
  if(!document.getElementById('categories')){
    let sections=[...document.querySelectorAll('main section[id]')].filter(x=>!['start','main'].includes(x.id)).slice(0,12);
    if(sections.length>=3){let nav=document.createElement('section');nav.id='categories';nav.className='kjt-auto-categories';nav.setAttribute('aria-label','On this page');let links=sections.map(x=>{let h=x.querySelector('h1,h2,h3');return h?`<a href="#${x.id}">${h.textContent.trim()}</a>`:''}).filter(Boolean);if(links.length>=3){nav.innerHTML='<div class="bfp-container"><p>On this page</p><div>'+links.join('')+'</div></div>';let first=document.querySelector('main section');first?.after(nav)}}
  }
  // Back-to-categories control on long categorized pages.
  if(document.getElementById('categories')){let back=document.createElement('a');back.href='#categories';back.className='kjt-back-categories kjt-floating-category kjt-back-hidden';back.setAttribute('aria-label','Back to categories');back.innerHTML='↑<span>Categories</span>';document.body.appendChild(back)}

});

/* v1.0.8: rail controls fixed against the actual exported DOM. */
(function(){/* 1.1.7: buttons recognised by their English label (kept by the page translator), and right to left the rail scrolls the other way */function L(b){return(b.getAttribute('data-kjt-en-label')||b.getAttribute('aria-label')||'').toLowerCase()}function findRail(b){const s=b.closest('section,[id]');if(!s)return null;const l=L(b);return l.includes('tools')?s.querySelector(':is([aria-label="Scrollable tool list"],[data-kjt-en-label="Scrollable tool list"])')||s.querySelector('.overflow-x-auto'):s.querySelector('.video-rail,.audio-rail,.bfp-card-row,.overflow-x-auto')}function wirePair(p,n,r){if(!p||!n||!r||p.dataset.kjtThemeRailWired||n.dataset.kjtThemeRailWired)return;p.dataset.kjtThemeRailWired=n.dataset.kjtThemeRailWired='1';const amount=()=>Math.max(280,Math.round(r.clientWidth*.82));const rtl=()=>getComputedStyle(r).direction==='rtl';const move=(d,e)=>{e.preventDefault();e.stopImmediatePropagation();r.scrollBy({left:(rtl()?-d:d)*amount(),behavior:'smooth'});setTimeout(state,350)};p.addEventListener('click',e=>move(-1,e),true);n.addEventListener('click',e=>move(1,e),true);function state(){const m=Math.max(0,r.scrollWidth-r.clientWidth-3),x=Math.abs(r.scrollLeft),rtl=getComputedStyle(r).direction==='rtl';p.disabled=rtl?x>=m:x<=3;n.disabled=rtl?x<=3:x>=m;p.classList.toggle('kjt-rail-disabled',p.disabled);n.classList.toggle('kjt-rail-disabled',n.disabled)}r.addEventListener('scroll',state,{passive:true});window.addEventListener('resize',state);setTimeout(state,100)}document.querySelectorAll('button[aria-label]').forEach(p=>{const l=L(p);if(!/(left|previous)/.test(l))return;const h=p.parentElement;if(!h)return;const n=[...h.querySelectorAll('button[aria-label]')].find(b=>b!==p&&/(right|next)/.test(L(b)));wirePair(p,n,findRail(p))})})();
/* v1.0.8: Freedom Tech uses already-imported WordPress Media Library icons. */
/* 7.8.0: the Break Free icon helper moved to KJT Site Core (assets/breakfree-media-icons.js). */

/* KJT 2.8.0: play in the card's own media frame */
(function(){
 function emb(raw){try{var u=new URL(raw,location.href),h=u.hostname.replace(/^www\./,'');if(h==='youtu.be'){var i=u.pathname.split('/').filter(Boolean)[0];return i?'https://www.youtube.com/embed/'+encodeURIComponent(i)+'?autoplay=1&rel=0':null}if(h.endsWith('youtube.com')){var i=u.searchParams.get('v');if(!i&&u.pathname.indexOf('/shorts/')===0)i=u.pathname.split('/')[2];if(!i&&u.pathname.indexOf('/embed/')===0)i=u.pathname.split('/')[2];return i?'https://www.youtube.com/embed/'+encodeURIComponent(i)+'?autoplay=1&rel=0':null}if(h==='vimeo.com'){var i=u.pathname.split('/').filter(Boolean)[0];return i?'https://player.vimeo.com/video/'+encodeURIComponent(i)+'?autoplay=1':null}}catch(e){}return null}
 document.addEventListener('click',function(e){var b=e.target.closest('[data-kjt-video-url]');if(!b)return;var src=emb(b.getAttribute('data-kjt-video-url'));if(!src)return;e.preventDefault();var original=b.outerHTML,frame=document.createElement('div');frame.className='kjt-inline-video-frame';frame.innerHTML='<iframe title="Video player" src="'+src+'" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><button type="button" class="kjt-inline-video-close" aria-label="Close video">×</button>';b.replaceWith(frame);frame.querySelector('.kjt-inline-video-close').onclick=function(){frame.outerHTML=original}});
})();

/* KJT 2.8.0 flexible-card player */
document.addEventListener('click',function(e){
 var b=e.target.closest('.kjt-flex-play[data-embed]'); if(!b)return;
 e.preventDefault(); var media=b.closest('.kjt-flex-media'); if(!media)return;
 var src=b.getAttribute('data-embed'); if(!src)return;
 media.innerHTML='<iframe title="Video player" src="'+src+'" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
});

/* 1.1.9: if the menu does not fit on one line (longer words in some languages, narrower
   screens), the header uses the compact ☰ Menu instead of spilling off the screen. */
(function(){
 var root=document.documentElement;
 function fit(){
  var nav=document.querySelector('header .bfp-nav');if(!nav)return;
  root.classList.remove('bfp-nav-tight');
  if(getComputedStyle(nav).display==='none')return;
  var W=root.clientWidth,over=false;
  document.querySelectorAll('header .bfp-container > *, header .bfp-nav > *, header .kjt-langmenu').forEach(function(e){var r=e.getBoundingClientRect();if(r.width&&(r.right>W+.5||r.left<-.5))over=true;});
  if(over)root.classList.add('bfp-nav-tight');
 }
 var t;function soon(){clearTimeout(t);t=setTimeout(fit,120);}
 window.addEventListener('resize',soon);window.addEventListener('load',fit);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fit);else fit();
 var h=document.querySelector('header');if(h&&window.MutationObserver)new MutationObserver(soon).observe(h,{childList:true,subtree:true,characterData:true});
})();
