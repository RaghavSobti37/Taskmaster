import{a as e,r as t}from"./rolldown-runtime-CNC7AqOf.js";import{d as n,u as r}from"./framer-motion-Dv-8nnQ2.js";import{m as i}from"./react-0pB0c5e7.js";import{Jt as a,Pn as o,Qn as s,Xn as c,mt as l,n as u,tr as d,y as f}from"./lucide-Dl3qozQz.js";var p=e(n(),1),m=e(i(),1),h={data:``},g=e=>{if(typeof window==`object`){let t=(e?e.querySelector(`#_goober`):window._goober)||Object.assign(document.createElement(`style`),{innerHTML:` `,id:`_goober`});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||h},ee=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,_=/\/\*[^]*?\*\/|  +/g,v=/\n+/g,y=(e,t)=>{let n=``,r=``,i=``;for(let a in e){let o=e[a];a[0]==`@`?a[1]==`i`?n=a+` `+o+`;`:r+=a[1]==`f`?y(o,a):a+`{`+y(o,a[1]==`k`?``:t)+`}`:typeof o==`object`?r+=y(o,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+` `+t:t)):a):o!=null&&(a=a[1]==`-`?a:a.replace(/[A-Z]/g,`-$&`).toLowerCase(),i+=y.p?y.p(a,o):a+`:`+o+`;`)}return n+(t&&i?t+`{`+i+`}`:i)+r},b={},x=e=>{if(typeof e==`object`){let t=``;for(let n in e)t+=n+x(e[n]);return t}return e},S=(e,t,n,r,i)=>{let a=x(e),o=b[a]||(b[a]=(e=>{let t=0,n=11;for(;t<e.length;)n=101*n+e.charCodeAt(t++)>>>0;return`go`+n})(a));if(!b[o]){let t=a===e?(e=>{let t,n,r=[{}];for(;t=ee.exec(e.replace(_,``));)t[4]?r.shift():t[3]?(n=t[3].replace(v,` `).trim(),r.unshift(r[0][n]=r[0][n]||{})):r[0][t[1]]=t[2].replace(v,` `).trim();return r[0]})(e):e;b[o]=y(i?{[`@keyframes `+o]:t}:t,n?``:`.`+o)}let s=n&&b.g;return n&&(b.g=b[o]),((e,t,n,r)=>{r?t.data=t.data.replace(r,e):t.data.indexOf(e)===-1&&(t.data=n?e+t.data:t.data+e)})(b[o],t,r,s),o},C=(e,t,n)=>e.reduce((e,r,i)=>{let a=t[i];if(a&&a.call){let e=a(n),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?`.`+t:e&&typeof e==`object`?e.props?``:y(e,``):!1===e?``:e}return e+r+(a??``)},``);function w(e){let t=this||{},n=e.call?e(t.p):e;return S(n.unshift?n.raw?C(n,[].slice.call(arguments,1),t.p):n.reduce((e,n)=>Object.assign(e,n&&n.call?n(t.p):n),{}):n,g(t.target),t.g,t.o,t.k)}var T,E,D;w.bind({g:1});var O=w.bind({k:1});function te(e,t,n,r){y.p=t,T=e,E=n,D=r}function k(e,t){let n=this||{};return function(){let r=arguments;function i(a,o){let s=Object.assign({},a),c=s.className||i.className;n.p=Object.assign({theme:E&&E()},s),n.o=/go\d/.test(c),s.className=w.apply(n,r)+(c?` `+c:``),t&&(s.ref=o);let l=e;return e[0]&&(l=s.as||e,delete s.as),D&&l[0]&&D(s),T(l,s)}return t?t(i):i}}var ne=e=>typeof e==`function`,A=(e,t)=>ne(e)?e(t):e,re=(()=>{let e=0;return()=>(++e).toString()})(),j=(()=>{let e;return()=>{if(e===void 0&&typeof window<`u`){let t=matchMedia(`(prefers-reduced-motion: reduce)`);e=!t||t.matches}return e}})(),ie=20,M=`default`,ae=(e,t)=>{let{toastLimit:n}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,n)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return ae(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(e=>e.id===i||i===void 0?{...e,dismissed:!0,visible:!1}:e)};case 4:return t.toastId===void 0?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let a=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+a}))}}},N=[],P={toasts:[],pausedAt:void 0,settings:{toastLimit:ie}},F={},I=(e,t=M)=>{F[t]=ae(F[t]||P,e),N.forEach(([e,n])=>{e===t&&n(F[t])})},L=e=>Object.keys(F).forEach(t=>I(e,t)),oe=e=>Object.keys(F).find(t=>F[t].toasts.some(t=>t.id===e)),R=(e=M)=>t=>{I(t,e)},se={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},ce=(e={},t=M)=>{let[n,r]=(0,p.useState)(F[t]||P),i=(0,p.useRef)(F[t]);(0,p.useEffect)(()=>(i.current!==F[t]&&r(F[t]),N.push([t,r]),()=>{let e=N.findIndex(([e])=>e===t);e>-1&&N.splice(e,1)}),[t]);let a=n.toasts.map(t=>({...e,...e[t.type],...t,removeDelay:t.removeDelay||e[t.type]?.removeDelay||e?.removeDelay,duration:t.duration||e[t.type]?.duration||e?.duration||se[t.type],style:{...e.style,...e[t.type]?.style,...t.style}}));return{...n,toasts:a}},le=(e,t=`blank`,n)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:`status`,"aria-live":`polite`},message:e,pauseDuration:0,...n,id:n?.id||re()}),z=e=>(t,n)=>{let r=le(t,e,n);return R(r.toasterId||oe(r.id))({type:2,toast:r}),r.id},B=(e,t)=>z(`blank`)(e,t);B.error=z(`error`),B.success=z(`success`),B.loading=z(`loading`),B.custom=z(`custom`),B.dismiss=(e,t)=>{let n={type:3,toastId:e};t?R(t)(n):L(n)},B.dismissAll=e=>B.dismiss(void 0,e),B.remove=(e,t)=>{let n={type:4,toastId:e};t?R(t)(n):L(n)},B.removeAll=e=>B.remove(void 0,e),B.promise=(e,t,n)=>{let r=B.loading(t.loading,{...n,...n?.loading});return typeof e==`function`&&(e=e()),e.then(e=>{let i=t.success?A(t.success,e):void 0;return i?B.success(i,{id:r,...n,...n?.success}):B.dismiss(r),e}).catch(e=>{let i=t.error?A(t.error,e):void 0;i?B.error(i,{id:r,...n,...n?.error}):B.dismiss(r)}),e};var ue=1e3,de=(e,t=`default`)=>{let{toasts:n,pausedAt:r}=ce(e,t),i=(0,p.useRef)(new Map).current,a=(0,p.useCallback)((e,t=ue)=>{if(i.has(e))return;let n=setTimeout(()=>{i.delete(e),o({type:4,toastId:e})},t);i.set(e,n)},[]);(0,p.useEffect)(()=>{if(r)return;let e=Date.now(),i=n.map(n=>{if(n.duration===1/0)return;let r=(n.duration||0)+n.pauseDuration-(e-n.createdAt);if(r<0){n.visible&&B.dismiss(n.id);return}return setTimeout(()=>B.dismiss(n.id,t),r)});return()=>{i.forEach(e=>e&&clearTimeout(e))}},[n,r,t]);let o=(0,p.useCallback)(R(t),[t]),s=(0,p.useCallback)(()=>{o({type:5,time:Date.now()})},[o]),c=(0,p.useCallback)((e,t)=>{o({type:1,toast:{id:e,height:t}})},[o]),l=(0,p.useCallback)(()=>{r&&o({type:6,time:Date.now()})},[r,o]),u=(0,p.useCallback)((e,t)=>{let{reverseOrder:r=!1,gutter:i=8,defaultPosition:a}=t||{},o=n.filter(t=>(t.position||a)===(e.position||a)&&t.height),s=o.findIndex(t=>t.id===e.id),c=o.filter((e,t)=>t<s&&e.visible).length;return o.filter(e=>e.visible).slice(...r?[c+1]:[0,c]).reduce((e,t)=>e+(t.height||0)+i,0)},[n]);return(0,p.useEffect)(()=>{n.forEach(e=>{if(e.dismissed)a(e.id,e.removeDelay);else{let t=i.get(e.id);t&&(clearTimeout(t),i.delete(e.id))}})},[n,a]),{toasts:n,handlers:{updateHeight:c,startPause:s,endPause:l,calculateOffset:u}}},fe=O`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,pe=O`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,me=O`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,he=k(`div`)`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||`#ff4b4b`};
  position: relative;
  transform: rotate(45deg);

  animation: ${fe} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${pe} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||`#fff`};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${me} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,ge=O`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,_e=k(`div`)`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||`#e0e0e0`};
  border-right-color: ${e=>e.primary||`#616161`};
  animation: ${ge} 1s linear infinite;
`,ve=O`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,ye=O`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,be=k(`div`)`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||`#61d345`};
  position: relative;
  transform: rotate(45deg);

  animation: ${ve} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${ye} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||`#fff`};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,xe=k(`div`)`
  position: absolute;
`,Se=k(`div`)`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Ce=O`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,we=k(`div`)`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Ce} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Te=({toast:e})=>{let{icon:t,type:n,iconTheme:r}=e;return t===void 0?n===`blank`?null:p.createElement(Se,null,p.createElement(_e,{...r}),n!==`loading`&&p.createElement(xe,null,n===`error`?p.createElement(he,{...r}):p.createElement(be,{...r}))):typeof t==`string`?p.createElement(we,null,t):t},Ee=e=>`
0% {transform: translate3d(0,${e*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,De=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${e*-150}%,-1px) scale(.6); opacity:0;}
`,Oe=`0%{opacity:0;} 100%{opacity:1;}`,ke=`0%{opacity:1;} 100%{opacity:0;}`,Ae=k(`div`)`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,je=k(`div`)`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Me=(e,t)=>{let n=e.includes(`top`)?1:-1,[r,i]=j()?[Oe,ke]:[Ee(n),De(n)];return{animation:t?`${O(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${O(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},Ne=p.memo(({toast:e,position:t,style:n,children:r})=>{let i=e.height?Me(e.position||t||`top-center`,e.visible):{opacity:0},a=p.createElement(Te,{toast:e}),o=p.createElement(je,{...e.ariaProps},A(e.message,e));return p.createElement(Ae,{className:e.className,style:{...i,...n,...e.style}},typeof r==`function`?r({icon:a,message:o}):p.createElement(p.Fragment,null,a,o))});te(p.createElement);var Pe=({id:e,className:t,style:n,onHeightUpdate:r,children:i})=>{let a=p.useCallback(t=>{if(t){let n=()=>{let n=t.getBoundingClientRect().height;r(e,n)};n(),new MutationObserver(n).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return p.createElement(`div`,{ref:a,className:t,style:n},i)},Fe=(e,t)=>{let n=e.includes(`top`),r=n?{top:0}:{bottom:0},i=e.includes(`center`)?{justifyContent:`center`}:e.includes(`right`)?{justifyContent:`flex-end`}:{};return{left:0,right:0,display:`flex`,position:`absolute`,transition:j()?void 0:`all 230ms cubic-bezier(.21,1.02,.73,1)`,transform:`translateY(${t*(n?1:-1)}px)`,...r,...i}},Ie=w`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,V=16,Le=({reverseOrder:e,position:t=`top-center`,toastOptions:n,gutter:r,children:i,toasterId:a,containerStyle:o,containerClassName:s})=>{let{toasts:c,handlers:l}=de(n,a);return p.createElement(`div`,{"data-rht-toaster":a||``,style:{position:`fixed`,zIndex:9999,top:V,left:V,right:V,bottom:V,pointerEvents:`none`,...o},className:s,onMouseEnter:l.startPause,onMouseLeave:l.endPause},c.map(n=>{let a=n.position||t,o=Fe(a,l.calculateOffset(n,{reverseOrder:e,gutter:r,defaultPosition:t}));return p.createElement(Pe,{id:n.id,key:n.id,onHeightUpdate:l.updateHeight,className:n.visible?Ie:``,style:o},n.type===`custom`?A(n.message,n):i?i(n):p.createElement(Ne,{toast:n,position:a}))}))},H=B,U=Object.freeze({INFO:`INFO`,SUCCESS:`SUCCESS`,WARN:`WARN`,ERROR:`ERROR`}),W=Object.freeze({CRM:`CRM`,ATTENDANCE:`ATTENDANCE`,FINANCE:`FINANCE`,PROJECTS:`PROJECTS`,EMAIL:`EMAIL`,AUTH:`AUTH`,SYSTEM:`SYSTEM`,BACKUP:`BACKUP`,WEBHOOK:`WEBHOOK`}),Re=Object.values(U),ze=Object.values(W),Be=[{prefix:`/api/leads`,module:W.CRM},{prefix:`/api/crm`,module:W.CRM},{prefix:`/api/exly`,module:W.CRM},{prefix:`/api/attendance`,module:W.ATTENDANCE},{prefix:`/api/finance`,module:W.FINANCE},{prefix:`/api/projects`,module:W.PROJECTS},{prefix:`/api/tasks`,module:W.PROJECTS},{prefix:`/api/ses`,module:W.EMAIL},{prefix:`/api/auth`,module:W.AUTH},{prefix:`/api/webhooks`,module:W.WEBHOOK},{prefix:`/api/notifications`,module:W.SYSTEM},{prefix:`/api/backup`,module:W.BACKUP}];function G(e=``){let t=(e||``).split(`?`)[0],n=Be.find(({prefix:e})=>t.startsWith(e));return n?n.module:W.SYSTEM}function Ve(e){return Re.includes(e)}function He(e){return ze.includes(e)}var Ue=Object.freeze({success:U.SUCCESS,error:U.ERROR,warning:U.WARN,warn:U.WARN,info:U.INFO});function We(e,t=U.INFO){if(!e)return t;let n=String(e).toUpperCase();return Ve(n)?n:Ue[String(e).toLowerCase()]||t}function K(e,t,n){return[e,n,String(t||``).slice(0,80)].filter(Boolean).join(`-`).toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``).slice(0,120)}function Ge(e={}){let t=We(e.severity||e.type,U.INFO),n=e.route||(typeof window<`u`?window.location.pathname:void 0),r=He(e.module)?e.module:G(e.route||e.url)||W.SYSTEM,i=String(e.message||e.title||`Notification`).trim()||`Notification`,a=e.title||i,o=e.description||(typeof e.payload?.description==`string`?e.payload.description:void 0)||(e.message&&e.message!==e.title?e.message:void 0),s=e.technicalError||e.payload?.stack||e.payload?.technical||(typeof e.payload?.technicalError==`string`?e.payload.technicalError:void 0)||null,c={...e.payload&&typeof e.payload==`object`?e.payload:{},description:o||void 0,stack:s||e.payload?.stack||void 0,technical:s||e.payload?.technical||void 0};return{id:e.id||e.toastId||K(r,i,t),severity:t,module:r,message:i,title:a,description:o&&o!==a?o:void 0,payload:c,technicalError:s,userVisible:e.userVisible!==!1,traceId:e.traceId,contextId:e.contextId,timestamp:e.timestamp||new Date().toISOString(),route:n,errorCode:e.errorCode,status:e.status,httpStatus:e.httpStatus||e.status,duration:e.duration,relatedEntities:e.relatedEntities,customRender:e.customRender}}var q=Object.freeze({[U.SUCCESS]:4e3,[U.WARN]:5e3,[U.INFO]:5e3,[U.ERROR]:1/0});function Ke({title:e,description:t,technicalError:n,errorCode:r,status:i,traceId:a,module:o,timestamp:s,severity:c}){let l=[];return s&&l.push(`Timestamp: ${s}`),a&&l.push(`TraceID: ${a}`),o&&l.push(`Module: ${o}`),c&&l.push(`Severity: ${c}`),e&&l.push(`Error: ${e}`),t&&t!==e&&l.push(`Message: ${t}`),r&&l.push(`Code: ${r}`),i&&l.push(`HTTP: ${i}`),n&&l.push(``,`--- Details ---`,n),l.join(`
`).trim()||`Unknown error`}var qe=t({AXIOS_SKIP_TOAST:()=>et,ERPNotificationProvider:()=>ft,buildErrorCopyText:()=>$,dismissSystemToast:()=>dt,fingerprintToast:()=>Ye,isGenericApiMessage:()=>$e,parseErrorPayload:()=>ct,pushCustomToast:()=>ut,shouldShowApiErrorToast:()=>nt,shouldShowApiSuccessToast:()=>tt,shouldShowAutoToast:()=>Q,shouldSuppressDuplicateToast:()=>Ze,showSystemToast:()=>lt,slugId:()=>rt,suppressAutoToasts:()=>Qe}),J=e(r(),1),Je=new Set([`operation successful`,`success`,`ok`,`done`,`created`,`updated`,`deleted`,`saved`,`lead saved`,`saved successfully`,`updated successfully`]),Y=0,X=3500,Z=new Map;function Ye(e,t){return`${e}:${String(t||``).trim().toLowerCase().slice(0,120)}`}function Xe(e){if(!(Z.size<=40))for(let[t,n]of Z)e-n>X&&Z.delete(t)}function Ze({severity:e,message:t,title:n}){let r=Ye(e,t||n),i=Date.now(),a=Z.get(r);return a!=null&&i-a<X?!0:(Z.set(r,i),Xe(i),!1)}function Qe(e=4e3){Y=Date.now()+e}function Q(){return Date.now()>Y}function $e(e){return!e||typeof e!=`string`||Je.has(e.trim().toLowerCase())}var et={headers:{"x-skip-toast":`true`}};function tt(e){if(!Q())return!1;let t=e?.config?.headers||{};if(t[`x-skip-toast`]||t[`X-Skip-Toast`])return!1;if(t[`x-show-toast`]||t[`X-Show-Toast`])return!0;let n=e?.data?.message;return!!n&&!$e(n)}function nt(e){if(!Q())return!1;let t=e?.config?.headers||{};return t[`x-skip-toast`]||t[`X-Skip-Toast`]?!1:(t[`x-show-toast`]||t[`X-Show-Toast`],!0)}function rt(...e){return e.filter(Boolean).join(`-`).toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``).slice(0,120)}var it=`pointer-events-auto w-full max-w-[min(420px,calc(100vw-2rem))] shadow-lg rounded-xl border-0 transition-all duration-300`;function $(e){return Ke(e)}var at={[U.SUCCESS]:{Icon:c,iconClass:`text-[var(--color-pastel-mint-text)]`,leftBorderColor:`#27a644`},[U.INFO]:{Icon:a,iconClass:`text-[var(--color-pastel-blue-text)]`,leftBorderColor:`var(--token-brand-accent)`},[U.WARN]:{Icon:f,iconClass:`text-[var(--color-pastel-apricot-text)]`,leftBorderColor:`#d97706`},[U.ERROR]:{Icon:l,iconClass:`text-[var(--color-pastel-rose-text)]`,leftBorderColor:`#ef4444`}},ot=({t:e,severity:t,module:n,message:r,title:i,description:a,technicalError:c,errorCode:l,status:f,traceId:m,timestamp:h})=>{let[g,ee]=(0,p.useState)(!1),[_,v]=(0,p.useState)(!1),y=at[t]||at[U.INFO],b=y.Icon,x=i||r,S=!!(c&&c.length>0),C=t===U.ERROR||S&&t===U.WARN,w=$({title:x,description:a,technicalError:c,errorCode:l,status:f,traceId:m,module:n,timestamp:h,severity:t});return(0,J.jsxs)(`div`,{className:`${it} bg-[var(--token-surface-1)] p-4 flex flex-col gap-3 border-l-[2px]`,style:{borderLeftColor:y.leftBorderColor},role:`alert`,children:[(0,J.jsxs)(`div`,{className:`flex items-start gap-3 w-full`,children:[(0,J.jsx)(b,{className:`w-5 h-5 ${y.iconClass} shrink-0 mt-0.5`}),(0,J.jsxs)(`div`,{className:`flex-1 min-w-0 overflow-hidden`,children:[n&&(0,J.jsx)(`p`,{className:`text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5`,children:n}),(0,J.jsx)(`p`,{className:`text-sm font-semibold text-[var(--color-text-primary)] break-words`,children:x}),a&&a!==x&&(0,J.jsx)(`p`,{className:`text-xs text-[var(--color-text-secondary)] mt-1 break-words`,children:a}),l&&(0,J.jsxs)(`p`,{className:`text-[10px] font-mono text-[var(--color-text-muted)] mt-1.5`,children:[`Code: `,l,f?` · HTTP ${f}`:``,m?` · Trace ${m.slice(0,8)}…`:``]})]}),(0,J.jsx)(`button`,{type:`button`,onClick:()=>H.dismiss(e.id),className:`text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0`,"aria-label":`Dismiss`,children:(0,J.jsx)(u,{className:`w-4 h-4`})})]}),C&&(0,J.jsxs)(`div`,{className:`pt-3 border-t border-[var(--color-bg-border)] flex flex-col gap-2`,children:[(0,J.jsxs)(`div`,{className:`flex items-center gap-4 flex-wrap`,children:[S&&(0,J.jsxs)(`button`,{type:`button`,onClick:()=>ee(e=>!e),className:`flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:underline`,children:[g?(0,J.jsx)(s,{className:`w-3.5 h-3.5`}):(0,J.jsx)(d,{className:`w-3.5 h-3.5`}),g?`Hide technical logs`:`Show technical logs`]}),(0,J.jsxs)(`button`,{type:`button`,onClick:async e=>{e.stopPropagation();try{await navigator.clipboard.writeText(w),v(!0),setTimeout(()=>v(!1),2e3)}catch(e){console.error(`Failed to copy text`,e)}},className:`flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-pastel-rose-text)] transition-colors`,children:[(0,J.jsx)(o,{className:`w-3.5 h-3.5`}),_?`Copied!`:`Copy diagnostics`]})]}),g&&S&&(0,J.jsx)(`pre`,{className:`p-2 bg-[var(--color-bg-primary)] text-[10px] font-mono text-[var(--color-pastel-rose-text)] overflow-x-auto rounded border border-[var(--color-bg-border)] max-h-32 whitespace-pre-wrap break-words`,children:c})]})]})};function st(e,{id:t,duration:n=4e3}){H.dismiss(t),H.custom(e,{id:t,duration:n,position:`top-right`})}function ct(e,t=`Something went wrong`){let n=e?.response?.data,r=e?.response?.status,i=typeof n?.error==`string`&&n.error||typeof n?.message==`string`&&n.message||e?.message||t,a=(typeof n?.message==`string`&&n?.message!==i?n.message:null)||(typeof n?.details==`string`?n.details:null)||null,o=typeof n?.code==`string`&&n.code||typeof n?.errorCode==`string`&&n.errorCode||typeof n?.error_code==`string`&&n.error_code||(r?`HTTP_${r}`:null),s=typeof n?.traceId==`string`?n.traceId:null;return{title:i,description:a,technicalError:typeof n?.stack==`string`&&n.stack||typeof n?.technical==`string`&&n.technical||null,errorCode:o,status:r,traceId:s}}function lt({id:e,severity:t,module:n,message:r,title:i,description:a,technicalError:o,errorCode:s,status:c,traceId:l,timestamp:u,duration:d,customRender:f}){let p=d??q[t]??5e3;return f?(st(f,{id:e,duration:p}),e):(st(e=>(0,J.jsx)(ot,{t:e,severity:t,module:n,message:r,title:i,description:a,technicalError:o,errorCode:s,status:c,traceId:l,timestamp:u}),{id:e,duration:p}),e)}function ut(e,t={}){return H.custom(e,{position:`top-right`,...t})}function dt(e){H.dismiss(e)}var ft=()=>typeof document>`u`?null:(0,m.createPortal)((0,J.jsxs)(J.Fragment,{children:[(0,J.jsx)(`div`,{"aria-live":`polite`,"aria-atomic":`true`,className:`sr-only`,id:`coreknot-toast-live`}),(0,J.jsx)(Le,{position:`top-right`,reverseOrder:!1,gutter:8,containerClassName:`tm-toast-container`,containerStyle:{zIndex:10060},toastOptions:{className:`tm-toast-host`,style:{background:`transparent`,boxShadow:`none`,padding:0,margin:0,maxWidth:`min(420px, calc(100vw - 2rem))`,width:`max-content`}}})]}),document.body);export{K as _,ct as a,tt as c,rt as d,Qe as f,G as g,q as h,qe as i,Ze as l,U as m,ft as n,ut as o,W as p,dt as r,nt as s,et as t,lt as u,Ge as v,H as y};