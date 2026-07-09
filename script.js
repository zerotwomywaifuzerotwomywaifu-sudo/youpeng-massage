// ===============================
// Firebase / Firestore 設定
// 目前第二階段：同步預約資料 + 營業時間
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyCH3CD_TypwfW0UtWOK_Mawt4DaPVBtnkk",
  authDomain: "youpeng-booking.firebaseapp.com",
  projectId: "youpeng-booking",
  storageBucket: "youpeng-booking.firebasestorage.app",
  messagingSenderId: "276717234519",
  appId: "1:276717234519:web:82f9aa4d30d909dfb2b612"
};

const BOOKINGS_KEY = "yp_bk_v23";
const HOURS_KEY = "yp_hours_v25";

let db = null;
let fb = {};
let bookingCache = [];
let hoursCache = {};

function loadLocalBookings(){
  try{
    const data = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  }catch(e){
    console.error("讀取本機預約資料失敗", e);
    return [];
  }
}

function bookingDocRef(){
  return fb.doc(db, "youpeng_sync", "bookings");
}

async function initFirebaseBookings(){
  try{
    const appMod = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");

    const app = appMod.initializeApp(firebaseConfig);

    fb = {
      getFirestore: fsMod.getFirestore,
      doc: fsMod.doc,
      getDoc: fsMod.getDoc,
      setDoc: fsMod.setDoc,
      onSnapshot: fsMod.onSnapshot,
      serverTimestamp: fsMod.serverTimestamp
    };

    db = fb.getFirestore(app);

    const ref = bookingDocRef();
    const snap = await fb.getDoc(ref);

    if(snap.exists()){
      const data = snap.data();
      bookingCache = Array.isArray(data.items) ? data.items : [];
    }else{
      bookingCache = loadLocalBookings();

      await fb.setDoc(ref, {
        items: bookingCache,
        version: 1,
        updatedAt: fb.serverTimestamp()
      });
    }

    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookingCache));

    fb.onSnapshot(ref, snapshot=>{
      if(!snapshot.exists()) return;

      const data = snapshot.data();
      bookingCache = Array.isArray(data.items) ? data.items : [];
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookingCache));

      const adminPage = document.getElementById("admin");
      if(adminPage && !adminPage.classList.contains("hidden")){
        renderAdmin();
      }
    }, error=>{
      console.error("Firestore 即時同步失敗", error);
    });

    console.log("Firebase 預約資料同步已啟動");

  }catch(error){
    console.error("Firebase 初始化失敗，暫時使用本機資料", error);
    bookingCache = loadLocalBookings();
    alert("Firebase 連線失敗，暫時使用這台裝置的本機資料。");
  }
}

function loadLocalHours(){
  try{
    const data = JSON.parse(localStorage.getItem(HOURS_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }catch(e){
    console.error("讀取本機營業時間失敗", e);
    return {};
  }
}

function hoursDocRef(){
  return fb.doc(db, "youpeng_sync", "hours");
}

async function initFirebaseHours(){
  hoursCache = loadLocalHours();

  if(!db || !fb.getDoc || !fb.setDoc){
    console.warn("Firebase 尚未啟動，營業時間暫時使用本機資料");
    return;
  }

  try{
    const ref = hoursDocRef();
    const snap = await fb.getDoc(ref);

    if(snap.exists()){
      const data = snap.data();
      hoursCache = data.items && typeof data.items === "object" && !Array.isArray(data.items) ? data.items : {};
    }else{
      await fb.setDoc(ref, {
        items: hoursCache,
        version: 1,
        updatedAt: fb.serverTimestamp()
      });
    }

    localStorage.setItem(HOURS_KEY, JSON.stringify(hoursCache));

    fb.onSnapshot(ref, snapshot=>{
      if(!snapshot.exists()) return;

      const data = snapshot.data();
      hoursCache = data.items && typeof data.items === "object" && !Array.isArray(data.items) ? data.items : {};
      localStorage.setItem(HOURS_KEY, JSON.stringify(hoursCache));

      const adminPage = document.getElementById("admin");
      if(adminPage && !adminPage.classList.contains("hidden")){
        renderAdmin();
      }
    }, error=>{
      console.error("Firestore 營業時間即時同步失敗", error);
    });

    console.log("Firebase 營業時間同步已啟動");

  }catch(error){
    console.error("Firebase 營業時間初始化失敗，暫時使用本機資料", error);
    hoursCache = loadLocalHours();
    localStorage.setItem(HOURS_KEY, JSON.stringify(hoursCache));
    alert("營業時間同步失敗，暫時使用這台裝置的本機營業時間資料。");
  }
}

const staffName={boss:"老闆",lady:"老闆娘",any:"不限"};

const painItems=[
"頭痛","睡眠障礙","腰酸背痛","頸椎夾窄","肩頸痠痛","肩關節周圍炎（五十肩）","肌腱炎",
"脊椎側彎","S 型脊椎","腰椎間盤突出","僵直性脊椎炎","椎體滑脫",
"網球肘","媽媽手","電腦手","手臂酸麻痛","扳機指","手腕酸痛",
"膝蓋酸痛無力","腳踝扭傷","足底筋膜炎","跟腱炎","手腳冰冷無力","現場由師傅評估"
];

const servicesDef=[
{id:"handnail",name:"修指甲（手）",staff:["lady"],type:"fixed",fixed:30,base:100,baseDur:30},
{id:"footnail",name:"修指甲（腳）",staff:["lady"],type:"fixed",fixed:45,base:200,baseDur:45},
{id:"callus",name:"修腳皮",staff:["lady"],type:"level",levels:[["輕微",30],["一般（推薦）",45],["嚴重",60]],rec:45,base:500},
{id:"ingrown",name:"修凍甲",staff:["lady"],type:"level",levels:[["輕微",30],["一般（推薦）",45],["嚴重",60]],rec:45,base:200},
{id:"gua",name:"刮痧",staff:["boss","lady"],type:"fixed",fixed:60,label:"刮痧依出痧狀況而不同，系統先預留 60 分鐘。",base:500,baseDur:60},
{id:"neck",name:"肩頸放鬆",staff:["boss","lady"],type:"free",opts:[15,30,45,60],rec:30,base:200,baseDur:15},
{id:"foot",name:"腳底按摩",staff:["boss","lady"],type:"free",opts:[45,60,75,90,105,120],rec:60,base:600,baseDur:45},
{id:"body",name:"全身按摩",staff:["boss","lady"],type:"free",opts:[60,75,90,105,120],rec:60,base:800,baseDur:60},
{id:"pain",name:"痠痛推拿",staff:["boss"],type:"free",opts:[60,75,90,105,120],rec:60,base:800,baseDur:60,parts:painItems},
{id:"oil",name:"指油壓",staff:["lady"],type:"free",opts:[60,75,90,105,120],rec:90,base:800,baseDur:60,recommended:[90,120]},
{id:"aroma",name:"精油指油壓",staff:["lady"],type:"free",opts:[60,75,90,105,120],rec:90,base:1000,baseDur:60,recommended:[90,120],special:"自備精油 60 分鐘 NT$800"}
];

let selected=null;

function today(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function toMin(t){let a=t.split(":").map(Number);return a[0]*60+a[1]}
function toTime(m){return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function add(t,m){return toTime(toMin(t)+m)}
function norm(p){return (p||"").replace(/\D/g,"")}
function bookings(){
  return Array.isArray(bookingCache) ? bookingCache : [];
}

function save(b){
  bookingCache = Array.isArray(b) ? b : [];
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookingCache));

  if(db && fb.setDoc){
    fb.setDoc(bookingDocRef(), {
      items: bookingCache,
      version: 1,
      updatedAt: fb.serverTimestamp()
    }, {merge:true}).catch(error=>{
      console.error("Firestore 儲存失敗", error);
      alert("資料已暫存在本機，但同步到 Firebase 失敗。請檢查網路或 Firestore 規則。");
    });
  }
}
function openCall(e){e.preventDefault();callModal.classList.remove("hidden")}
function closeCall(){callModal.classList.add("hidden")}

function show(id){
  ["customer","login","admin"].forEach(x=>document.getElementById(x).classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  if(id==="login"||id==="admin"){document.body.classList.add("admin-mode")}
  else{document.body.classList.remove("admin-mode")}
  scrollTo(0,0)
}

function showCustomer(){show("customer")}

function goAdmin(e){
  e.preventDefault();
  if(localStorage.getItem("yp_admin_v23")==="yes"){
    show("admin");
    renderAdmin();
  }else{
    show("login");
  }
}

function priceOf(s,dur){
  if(["handnail","footnail","callus","ingrown","gua"].includes(s.id))return s.base;
  let extra=Math.max(0,dur-s.baseDur);
  return s.base+Math.ceil(extra/15)*200;
}

function seed(alertIt){
  let d=today();
  save([
    {id:crypto.randomUUID(),type:"booking",date:d,staff:"boss",start:"14:00",end:"15:00",service:"全身按摩",customer:"王先生",phone:"0912-000-000",note:"肩頸較痠",price:800},
    {id:crypto.randomUUID(),type:"booking",date:d,staff:"lady",start:"11:00",end:"11:45",service:"修腳皮",customer:"林小姐",phone:"02-0000-0000",note:"第一次來",price:500},
    {id:crypto.randomUUID(),type:"block",date:d,staff:"lady",start:"16:00",end:"16:30",service:"吃飯",customer:"預留",phone:"",note:"",price:0}
  ]);
  if(alertIt){renderAdmin();alert("已重置")}
}

async function init(){
  dateInput.value=today();
  dateInput.min=today();
  adminDate.value=today();
  manualDate.value=today();
  manualDate.min=today();

  if(!localStorage.getItem("yp_buf_v23")){
    localStorage.setItem("yp_buf_v23","15");
  }

  if(document.getElementById("breakTime")){
    breakTime.value=localStorage.getItem("yp_buf_v23");
  }

  renderServices();

  await initFirebaseBookings();
  await initFirebaseHours();

  if(localStorage.getItem("yp_admin_v23")==="yes"){
    show("admin");
    renderAdmin();
  }else{
    show("customer");
  }
}

function renderServices(){
  services.innerHTML="";
  servicesDef.forEach(s=>{
    let div=document.createElement("div");
    div.className="service";
    let h=`<label style="margin:0"><input type="checkbox" class="svc" value="${s.id}" onchange="toggleSvc('${s.id}')"> ${s.name}</label>
    <div>${s.staff.map(x=>`<span class='chip'>${staffName[x]}</span>`).join("")}</div>
    <div id="opt-${s.id}" class="hidden">`;

    if(s.type==="free"){
      h+=`<label>時間</label><select id="dur-${s.id}" onchange="clearSlots()">`;
      s.opts.forEach(o=>{
        let recText=s.recommended?(s.recommended.includes(o)?"（推薦）":""):(o===s.rec?"（推薦）":"");
        h+=`<option value="${o}" ${o===s.rec?"selected":""}>${o} 分鐘${recText}</option>`;
      });
      h+=`</select>`;

      if(s.parts){
        h+=`<label>想針對處理（可複選）</label><div id="part-${s.id}" class="part-checks">`;
        s.parts.forEach(p=>h+=`<label class="part-check"><input type="checkbox" value="${p}" onchange="clearSlots()"> ${p}</label>`);
        h+=`</div><label>其他（選填）</label><textarea id="extra-${s.id}" placeholder="選填，例如：右肩抬不起來、彎腰會痛、左手容易麻..."></textarea><p class="muted">若上述選項無法完整描述您的狀況，可在此補充，例如哪裡痛、不舒服多久、什麼動作會痛。</p>`;
      }
    }

    if(s.type==="fixed"){
      h+=`<div class="notice">${s.label||"系統會自動預留服務時間。"}</div><input type="hidden" id="dur-${s.id}" value="${s.fixed}">`;
    }

    if(s.type==="level"){
      h+=`<label>請選擇情況</label><select id="dur-${s.id}" onchange="clearSlots()">`;
      s.levels.forEach(l=>h+=`<option value="${l[1]}" ${l[1]===s.rec?"selected":""}>${l[0]}（約 ${l[1]} 分）</option>`);
      h+=`</select><p class="muted">不確定可選一般（推薦）。</p>`;
    }

    if(s.special)h+=`<p class="muted">${s.special}</p>`;
    div.innerHTML=h+"</div>";
    services.appendChild(div);
  });
}

function toggleSvc(id){
  document.getElementById("opt-"+id).classList.toggle("hidden",!document.querySelector(`.svc[value="${id}"]`).checked);
  clearSlots();
}

function clearSlots(){
  selected=null;
  slots.innerHTML="";
  slotTitle.classList.add("hidden");
  previewBox.classList.add("hidden");
}

function selectedServices(){
  return [...document.querySelectorAll(".svc:checked")].map(c=>{
    let s=servicesDef.find(x=>x.id===c.value);
    let dur=Number(document.getElementById("dur-"+s.id).value);
    let displayName=s.name;
    let part="";

    if(s.parts){
      let checked=[...document.querySelectorAll("#part-"+s.id+" input:checked")].map(x=>x.value);
      let extra=(document.getElementById("extra-"+s.id)?.value||"").trim();
      part=checked.join("、");
      if(part)displayName=s.name+"（"+part+"）";
      if(extra)displayName+="【其他："+extra+"】";
    }

    return {...s,name:displayName,rawName:s.name,part,dur,price:priceOf(s,dur)}
  });
}

function total(ss){return ss.reduce((a,s)=>a+s.dur,0)}
function totalPrice(ss){return ss.reduce((a,s)=>a+s.price,0)}
function can(st,ss){return ss.every(s=>s.staff.includes(st))}
function overlap(a,b,c,d){return toMin(a)<toMin(d)&&toMin(c)<toMin(b)}

function getHours(date){
  const all = hoursCache && typeof hoursCache === "object" && !Array.isArray(hoursCache) ? hoursCache : {};
  return all[date] || {open:"10:00", close:"22:00", label:"正常營業"};
}

function saveHours(date, data){
  hoursCache = hoursCache && typeof hoursCache === "object" && !Array.isArray(hoursCache) ? hoursCache : {};
  hoursCache[date] = data;
  localStorage.setItem(HOURS_KEY, JSON.stringify(hoursCache));

  if(db && fb.setDoc){
    fb.setDoc(hoursDocRef(), {
      items: hoursCache,
      version: 1,
      updatedAt: fb.serverTimestamp()
    }, {merge:true}).catch(error=>{
      console.error("Firestore 營業時間儲存失敗", error);
      alert("營業時間已暫存在本機，但同步到 Firebase 失敗。請檢查網路或 Firestore 規則。");
    });
  }
}

function renderHoursStatus(){
  if(!document.getElementById("hoursStatus")) return;
  const d = adminDate.value || today();
  const h = getHours(d);
  hoursStatus.innerHTML = `<b>${d}</b><br>${h.label}<br>可預約時間：${h.open}～${h.close}`;
}

function setNormalHours(){
  const d = adminDate.value || today();
  saveHours(d, {open:"10:00", close:"22:00", label:"正常營業"});
  renderHoursStatus();
  renderAdmin();
  alert("已恢復正常營業時間");
}

function setEarlyClose(){
  const d = adminDate.value || today();
  const close = earlyCloseTime.value || "18:00";
  saveHours(d, {open:"10:00", close, label:"提早打烊"});
  renderHoursStatus();
  renderAdmin();
  alert("已設定提早打烊");
}

function setLateClose(){
  const d = adminDate.value || today();
  const close = lateCloseTime.value || "23:00";
  saveHours(d, {open:"10:00", close, label:"延後打烊"});
  renderHoursStatus();
  renderAdmin();
  alert("已設定延後打烊");
}

function available(date,staff,start,dur){
  let buf=Number(localStorage.getItem("yp_buf_v23")||localStorage.getItem("yp_buf_v25")||15);
  let end=add(start,dur+buf);
  const h=getHours(date);
  if(toMin(start)<toMin(h.open)||toMin(end)>toMin(h.close))return false;
  return !bookings().filter(b=>b.date===date&&b.staff===staff).some(b=>overlap(start,end,b.start,b.end));
}

function calcSlots(){
  selected=null;
  let date=dateInput.value,ss=selectedServices(),st=staffInput.value,dur=total(ss),p=totalPrice(ss);
  slots.innerHTML="";

  if(!date||!ss.length){
    alert("請先選日期與服務");
    return;
  }

  totalBox.innerHTML=`已選：${ss.map(s=>s.name+" "+s.dur+"分").join("、")}<br>服務總時間：約 ${dur} 分鐘<br>預估價格：NT$${p}`;
  totalBox.classList.remove("hidden");
  slotTitle.classList.remove("hidden");

  let cands=st==="any"?["boss","lady"].filter(x=>can(x,ss)):(can(st,ss)?[st]:[]);

  if(!cands.length){
    slots.innerHTML=`<div class="notice" style="grid-column:1/-1">這組服務需要跨師傅接續。正式版會自動安排，此測試版先提示。</div>`;
    return;
  }

  let count=0,buf=Number(localStorage.getItem("yp_buf_v23")||15);
  const biz=getHours(date);

  for(let m=toMin(biz.open);m<=toMin(biz.close)-dur-buf;m+=15){
    let t=toTime(m);
    cands.forEach(staff=>{
      let ok=available(date,staff,t,dur),d=document.createElement("div");
      d.className="slot"+(ok?"":" disabled");
      d.innerHTML=`${t}<br>${staffName[staff]}`;

      if(ok){
        count++;
        d.onclick=()=>{
          document.querySelectorAll(".slot").forEach(x=>x.classList.remove("sel"));
          d.classList.add("sel");
          selected={date,staff,start:t,dur,service:ss.map(s=>s.name).join("＋"),price:p};
          previewBox.classList.add("hidden");
        };
      }

      slots.appendChild(d);
    });
  }

  if(!count){
    slots.innerHTML=`<div class="notice" style="grid-column:1/-1">這天沒有符合條件的時段。</div>`;
  }
}

function preview(){
  if(!selected){alert("請先選時間");return}

  let name=surname.value.trim();
  let tel=phone.value.trim();

  if(!name||!tel){
    alert("請先填寫姓氏與電話");
    return;
  }

  let end=add(selected.start,selected.dur);

  previewBox.innerHTML=`<b>預約確認</b><br>
  日期：${selected.date}<br>
  時間：${selected.start}～${end}<br>
  按摩師：${staffName[selected.staff]}<br>
  服務：${selected.service}<br>
  服務時間：約 ${selected.dur} 分鐘<br>
  預估價格：NT$${selected.price}<br>
  客人：${name}${title.value}<br>
  電話：${tel}<br>
  ${note.value.trim()?("備註："+note.value.trim()+"<br>"):""}
  <br><b>確認內容無誤後，請按下方「送出預約」。</b>`;

  previewBox.classList.remove("hidden");
}

function submitBooking(){
  if(!selected){alert("請先選時間");return}

  let name=surname.value.trim();
  let tel=phone.value.trim();

  if(!name||!tel){
    alert("姓氏與電話都是必填");
    return;
  }

  let item={
    id:crypto.randomUUID(),
    type:"booking",
    date:selected.date,
    staff:selected.staff,
    start:selected.start,
    end:add(selected.start,selected.dur),
    service:selected.service,
    customer:name+title.value,
    phone:tel,
    note:note.value.trim(),
    price:selected.price
  };

  let b=bookings();
  b.push(item);
  save(b);

  successBox.innerHTML=`<b>預約成功！</b><br>
  ${item.date} ${item.start}～${item.end}<br>
  ${staffName[item.staff]}｜${item.customer}<br>
  ${item.service}<br>
  預估價格：NT$${item.price}<br><br>
  如需修改時間、服務項目或取消預約，請撥打店內室內電話聯繫。`;

  successBox.classList.remove("hidden");
  lookupPhone.value=item.phone;
  calcSlots();
}

function lookup(){
  let p=norm(lookupPhone.value);

  if(!p){
    alert("請輸入電話");
    return;
  }

  let items=bookings()
    .filter(b=>b.type==="booking"&&norm(b.phone)===p)
    .sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));

  lookupBox.innerHTML=items.length
    ?items.map(b=>`<div class="appt"><div class="t">${b.date} ${b.start}～${b.end}</div>${staffName[b.staff]}｜${b.customer}<br>${b.service}<br>${b.price?("預估價格：NT$"+b.price+"<br>"):""}<span class="muted">修改或取消請撥打店內電話。</span></div>`).join("")
    :`<div class="notice">查無此電話的預約。</div>`;
}

function login(){
  if(adminPass.value==="1234"){
    if(remember.checked)localStorage.setItem("yp_admin_v23","yes");
    show("admin");
    renderAdmin();
  }else{
    alert("密碼錯誤");
  }
}

function logout(){
  localStorage.removeItem("yp_admin_v23");
  show("customer");
}

function isPastAppt(b){
  const now = new Date();
  const todayStr = today();

  if(b.date < todayStr) return true;
  if(b.date > todayStr) return false;

  return toMin(b.end) <= now.getHours()*60 + now.getMinutes();
}

function markDone(id){
  if(confirm("確定將這筆預約標記為已結束？")){
    let b=bookings();
    let x=b.find(i=>i.id===id);
    if(x){x.done=true}
    save(b);
    renderAdmin();
  }
}

function markUndone(id){
  let b=bookings();
  let x=b.find(i=>i.id===id);
  if(x){x.done=false}
  save(b);
  renderAdmin();
}

function renderAdminSummary(items){
  if(!document.getElementById("adminSummary")) return;

  const appts = items.filter(b=>b.type!=="block");
  const done = appts.filter(b=>b.done || isPastAppt(b));
  const pending = appts.filter(b=>!(b.done || isPastAppt(b)));
  const revenue = appts.reduce((sum,b)=>sum+Number(b.price||0),0);

  adminSummary.innerHTML = `
    <div class="summary-box">總預約<b>${appts.length}</b></div>
    <div class="summary-box">未完成<b>${pending.length}</b></div>
    <div class="summary-box">已結束<b>${done.length}</b></div>
    <div class="summary-box">營業額<b>NT$${revenue}</b></div>
  `;
}

function nextAppointment(items){
  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();
  const todayStr = today();

  const upcoming = items
    .filter(b=>b.type!=="block" && !b.done && (b.date>todayStr || (b.date===todayStr && toMin(b.end)>nowMin)))
    .sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));

  return upcoming[0]?.id || "";
}

function renderAdmin(){
  renderHoursStatus();

  let d=adminDate.value||today();
  let items=bookings().filter(b=>b.date===d).sort((a,b)=>a.start.localeCompare(b.start));

  renderAdminSummary(items);
  renderTimeline(items);
  renderRevenue(d, items);

  if(!items.length){
    adminList.innerHTML="<p class='muted'>這天目前沒有預約。</p>";
    return;
  }

  adminList.innerHTML="";

  ["boss","lady"].forEach(st=>{
    adminList.innerHTML+=`<h3>${staffName[st]}</h3>`;
    let g=items.filter(x=>x.staff===st);

    if(!g.length)adminList.innerHTML+="<p class='muted'>無</p>";

    const nextId = nextAppointment(items);

    g.forEach(b=>{
      const finished = b.done || isPastAppt(b);
      const cls = b.type==="block" ? "block" : (finished ? "done" : (b.id===nextId ? "next" : "waiting"));

      adminList.innerHTML+=`<div class="appt ${cls}">
        <div class="t">${b.start}～${b.end} ${finished?"<span class='done-label'>已結束</span>":(b.id===nextId?"<span class='next-label'>下一位</span>":"")}</div>
        ${b.type==="block"?"預留：":""}${b.customer}｜${b.service}<br>
        ${b.phone?"電話："+b.phone+"<br>":""}
        ${b.price?("價格：NT$"+b.price+"<br>"):""}
        ${b.note?("備註："+b.note+"<br>"):""}
        ${b.type==="block"?"":(finished?`<button class="small ghost" onclick="markUndone('${b.id}')">恢復未完成</button>`:`<button class="small" onclick="markDone('${b.id}')">完成</button>`)}
        <button class="small" onclick="extend('${b.id}')">延長15分</button>
        <button class="small danger" onclick="del('${b.id}')">取消</button>
      </div>`;
    });
  });
}

function renderTimeline(items){
  if(!document.getElementById("timelineBox")) return;

  const breakMin = Number(localStorage.getItem("yp_buf_v23")||localStorage.getItem("yp_buf_v25")||localStorage.getItem("yp_break_v04")||15);

  if(!items.length){
    timelineBox.innerHTML = `<p class="muted">這天目前沒有行程。</p>`;
    return;
  }

  let html = "";

  ["boss","lady"].forEach(st=>{
    const group = items.filter(x=>x.staff===st).sort((a,b)=>a.start.localeCompare(b.start));
    html += `<div class="timeline-staff">${staffName[st]}</div>`;

    if(!group.length){
      html += `<div class="timeline-empty">無行程</div>`;
      return;
    }

    group.forEach(b=>{
      const finished = b.done || isPastAppt(b);
      const isBlock = b.type==="block";

      html += `
        <div class="timeline-item">
          <div class="timeline-time">${b.start}<br>｜<br>${b.end}</div>
          <div class="timeline-card ${finished?"done":""} ${isBlock?"block":""}">
            <div class="timeline-title">${finished?"已結束｜":""}${isBlock?"預留時間":b.customer}</div>
            <div>${b.service}</div>
            ${b.phone?`<div class="timeline-meta">電話：${b.phone}</div>`:""}
            ${b.price?`<div class="timeline-meta">金額：NT$${b.price}</div>`:""}
          </div>
        </div>
      `;

      if(!isBlock && breakMin>0){
        const bs = b.end;
        const be = add(b.end, breakMin);

        html += `
          <div class="timeline-item">
            <div class="timeline-time">${bs}<br>｜<br>${be}</div>
            <div class="timeline-card break">
              <div class="timeline-title">休息時間</div>
              <div>${breakMin} 分鐘整理／休息</div>
            </div>
          </div>
        `;
      }
    });
  });

  timelineBox.innerHTML = html;
}

function renderRevenue(date, items){
  const counted = items.filter(b=>b.type!=="block");
  const total = counted.reduce((sum,b)=>sum+Number(b.price||0),0);
  const online = counted.filter(b=>b.type==="booking" && b.customer!=="現場客").reduce((sum,b)=>sum+Number(b.price||0),0);
  const walkin = counted.filter(b=>b.customer==="現場客").reduce((sum,b)=>sum+Number(b.price||0),0);

  if(document.getElementById("revenueBox")){
    revenueBox.innerHTML = `
      <b>${date}</b><br>
      營業額合計：<b>NT$${total}</b><br>
      線上預約：NT$${online}<br>
      現場客：NT$${walkin}
    `;
  }

  if(document.getElementById("revenueList")){
    if(!counted.length){
      revenueList.innerHTML = `<p class="muted">這天目前沒有營業額紀錄。</p>`;
      return;
    }

    revenueList.innerHTML = counted.map(b=>`
      <div class="appt">
        <div class="t">${b.start}～${b.end}</div>
        ${staffName[b.staff]}｜${b.customer}｜${b.service}<br>
        金額：NT$${Number(b.price||0)}
      </div>
    `).join("");
  }
}

function addManual(){
  let date=manualDate.value;
  let staff=manualStaff.value;
  let start=manualStart.value;
  let dur=Number(manualDur.value);
  let service=manualService.value.trim()||(manualType.value==="block"?"預留時間":"現場服務");
  let manualAmount=Number(manualPrice.value||0);

  if(!date||!start){
    alert("請填日期與開始時間");
    return;
  }

  if(!available(date,staff,start,dur)){
    alert("這段時間已有預約或超出營業時間");
    return;
  }

  let item={
    id:crypto.randomUUID(),
    type:manualType.value==="block"?"block":"booking",
    date,
    staff,
    start,
    end:add(start,dur),
    service,
    customer:manualType.value==="block"?"預留":"現場客",
    phone:"",
    note:"",
    price:manualType.value==="block"?0:manualAmount
  };

  let b=bookings();
  b.push(item);
  save(b);
  renderAdmin();
  alert("已新增");
}

function extend(id){
  let b=bookings();
  let x=b.find(i=>i.id===id);
  x.end=add(x.end,15);
  save(b);
  renderAdmin();
}

function del(id){
  if(confirm("確定取消？")){
    save(bookings().filter(x=>x.id!==id));
    renderAdmin();
  }
}

function save休息時間(){
  localStorage.setItem("yp_buf_v23",breakTime.value);
  renderAdmin();
}

init();
