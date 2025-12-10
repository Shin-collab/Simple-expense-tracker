// 04_script.js - single source for SPA + Dashboard
const STORAGE_KEY = "expenses_v1";
function readExpenses(){ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
function writeExpenses(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

// Navigation (SPA)
let pageHistory = [], historyIndex = -1;
function goToPage(pageId){
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");
  const el = document.getElementById(pageId);
  if(!el) return;
  el.style.display = "block";
  pageHistory = pageHistory.slice(0, historyIndex + 1);
  pageHistory.push(pageId); historyIndex++;
}

// Add
function clearAddForm(){
  ["type","date","category","description","amount"].forEach(id=>{
    const e = document.getElementById(id);
    if(!e) return;
    if(e.tagName === "SELECT") e.selectedIndex = 0;
    else e.value = "";
  });
}
function addExpense(){
  const type = document.getElementById("type")?.value || "expense";
  const date = document.getElementById("date")?.value || "";
  const category = document.getElementById("category")?.value || "อื่นๆ";
  const description = document.getElementById("description")?.value || "";
  const amountRaw = document.getElementById("amount")?.value || "";
  const amount = Number(amountRaw);
  if(!date || !amount || isNaN(amount)){
    alert("กรุณากรอกวันที่และจำนวนเงินให้ถูกต้อง");
    return;
  }
  const arr = readExpenses();
  arr.push({ type, date, category, description, amount });
  writeExpenses(arr);
  clearAddForm();
  loadTable();
  updateDashboard();
  goToPage("listPage");
}

// Table
function loadTable(){
  const arr = readExpenses();
  const tbody = document.querySelector("#expenseTable tbody");
  if(!tbody) return;
  tbody.innerHTML = "";
  arr.forEach((it, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.date}</td>
      <td>${it.category}</td>
      <td>${it.description || '-'}</td>
      <td class="right">${Number(it.amount).toLocaleString()}</td>
      <td>${it.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</td>
      <td><button class="delete-btn" data-idx="${idx}">ลบ</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".delete-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.idx);
      if(!confirm("ต้องการลบรายการนี้หรือไม่?")) return;
      const arr = readExpenses();
      arr.splice(idx,1);
      writeExpenses(arr);
      loadTable();
      updateDashboard();
    });
  });
}

// Charts
let chartBar = null, chartLine = null;
function updateDashboard(){
  let arr = readExpenses().map(i => ({...i, amount: Number(i.amount)}));

  // filters
  const start = document.getElementById("startDate")?.value || "";
  const end = document.getElementById("endDate")?.value || "";
  const cat = document.getElementById("filterCategory")?.value || "all";
  const minAmount = Number(document.getElementById("minAmount")?.value || 0);
  if(start) arr = arr.filter(x => x.date >= start);
  if(end) arr = arr.filter(x => x.date <= end);
  if(cat && cat !== "all") arr = arr.filter(x => x.category === cat);
  if(minAmount && !isNaN(minAmount)) arr = arr.filter(x => x.amount >= minAmount);

  // totals
  const total = arr.reduce((s,x)=>s + Number(x.amount || 0), 0);
  const totalEl = document.getElementById("totalCard");
  const countEl = document.getElementById("countCard");
  if(totalEl) totalEl.innerText = `รวม: ${total.toLocaleString()} บาท`;
  if(countEl) countEl.innerText = `รายการ: ${arr.length}`;

  // group by category
  const groups = {};
  arr.forEach(x => groups[x.category] = (groups[x.category] || 0) + Number(x.amount || 0));

  // sort descending by amount -> helps show "most used" first (เหมือนหุ้นเรียงตามมูลค่า)
  const entries = Object.entries(groups).sort((a,b) => b[1] - a[1]);
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  // Bar chart (เรียงจากมาก->น้อย)
  const showBar = document.getElementById("toggleBar")?.checked ?? true;
  const barCtx = document.getElementById("barChart");
  if(barCtx){
    if(chartBar){ chartBar.destroy(); chartBar = null; }
    if(showBar && labels.length){
      chartBar = new Chart(barCtx.getContext("2d"), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'จำนวนเงิน (บาท)',
            data: values,
            backgroundColor: labels.map((_,i)=>`rgba(${40+i*20%200},115,200,0.8)`),
            borderRadius: 6
          }]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          animation: { duration: 900, easing: 'easeOutQuart' },
          scales: { y: { beginAtZero:true } }
        }
      });
      barCtx.parentElement.style.display = 'block';
    } else {
      barCtx.parentElement.style.display = 'none';
    }
  }

  // Line chart (trend over time — we aggregate by date for the filtered arr)
  const showLine = document.getElementById("toggleLine")?.checked ?? true;
  const lineCtx = document.getElementById("lineChart");
  if(lineCtx){
    if(chartLine){ chartLine.destroy(); chartLine = null; }
    if(showLine && arr.length){
      // aggregate by date sorted chronologically
      const byDate = {};
      arr.sort((a,b)=> a.date.localeCompare(b.date)).forEach(x => {
        byDate[x.date] = (byDate[x.date] || 0) + x.amount;
      });
      const dates = Object.keys(byDate).sort();
      const daily = dates.map(d => byDate[d]);
      // cumulative to make it look like trend (หุ้น-like)
      const cumulative = daily.reduce((acc, cur, i) => (i===0 ? [cur] : acc.concat(acc[i-1] + cur)), []);
      chartLine = new Chart(lineCtx.getContext("2d"), {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'เทรนด์สะสม (บาท)',
            data: cumulative,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            borderWidth: 2
          }]
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          animation:{ duration: 900, easing: 'easeOutQuart' },
          plugins:{ legend:{ display:false } },
          scales:{ x:{ display:true }, y:{ beginAtZero:true } }
        }
      });
      lineCtx.parentElement.style.display = 'block';
    } else {
      lineCtx.parentElement.style.display = 'none';
    }
  }

  // summary list
  const summaryEl = document.getElementById("summary");
  if(summaryEl){
    if(arr.length === 0) summaryEl.innerHTML = "<p>ไม่มีข้อมูลตามเงื่อนไข</p>";
    else {
      summaryEl.innerHTML = arr.map(x => `<p>${x.date} • ${x.category} • ${x.description||'-'} • ${Number(x.amount).toLocaleString()} บาท (${x.type === 'income' ? 'รายรับ' : 'รายจ่าย'})</p>`).join('');
    }
  }
}

// Theme persistence
function applyThemeFromStorage(){
  const t = localStorage.getItem("theme") || "light";
  const themeToggle = document.getElementById("themeToggle");
  if(t === "dark"){ document.body.classList.add("dark"); if(themeToggle) themeToggle.textContent = "☀️ Light Mode"; }
  else { document.body.classList.remove("dark"); if(themeToggle) themeToggle.textContent = "🌙 Dark Mode"; }
}

document.addEventListener("DOMContentLoaded", function(){
  // initial page for SPA
  if(document.getElementById("addPage")) goToPage("addPage");

  // bind save
  const saveBtn = document.getElementById("saveBtn");
  if(saveBtn) saveBtn.addEventListener("click", addExpense);

  // bind load table
  loadTable();

  // filter bindings
  const filterBtn = document.getElementById("filterBtn");
  if(filterBtn) filterBtn.addEventListener("click", updateDashboard);
  const filterCategory = document.getElementById("filterCategory");
  if(filterCategory) filterCategory.addEventListener("change", updateDashboard);
  const minAmount = document.getElementById("minAmount");
  if(minAmount) minAmount.addEventListener("input", updateDashboard);

  // chart toggles
  const toggleBar = document.getElementById("toggleBar");
  const toggleLine = document.getElementById("toggleLine");
  if(toggleBar) toggleBar.addEventListener("change", updateDashboard);
  if(toggleLine) toggleLine.addEventListener("change", updateDashboard);

  // theme toggle
  const themeToggle = document.getElementById("themeToggle");
  applyThemeFromStorage();
  if(themeToggle){
    themeToggle.addEventListener("click", ()=>{
      document.body.classList.toggle("dark");
      if(document.body.classList.contains("dark")) { localStorage.setItem("theme","dark"); themeToggle.textContent = "☀️ Light Mode"; }
      else { localStorage.setItem("theme","light"); themeToggle.textContent = "🌙 Dark Mode"; }
    });
  }

  // initial dashboard render (works both for SPA index or separate dashboard.html)
  updateDashboard();
});
