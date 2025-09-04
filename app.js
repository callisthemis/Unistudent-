// MyStudies+ PWA — με μενού προφίλ, avatar, αποσύνδεση/κλείδωμα, PIN, editor & charts

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const STORAGE_KEY = "mystudies-data";
const PIN_KEY = "mystudies-pin";
const LOCK_KEY = "mystudies-locked";

const DEFAULT_DATA = {
  student: {
    firstName: "ΘΕΜΙΣΤΟΚΛΗΣ ΜΑΡΙΟΣ",
    lastName: "ΕΥΣΤΑΘΙΑΔΗΣ",
    university: "ΤΜΗΜΑ ΕΠΙΣΤΗΜΗΣ ΦΥΣΙΚΗΣ ΑΓΩΓΗΣ ΚΑΙ ΑΘΛΗΤΙΣΜΟΥ",
    studentId: "9980202400024",
    avatar: null // dataURL εικόνας ή null
  },
  semesters: [
    {
      name: "Α’ Εξάμηνο",
      courses: [
        { title: "Διδακτική και Προπονητική Χειροσφαίρισης", grade: 1,   ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Ποδοσφαίρου",     grade: 7,   ects: 6, code: "" },
        { title: "Ιστορία Φυσικής Αγωγής και Αθλητισμού",     grade: 7,   ects: 4, code: "" },
        { title: "Διδακτική και Προπονητική Βασικής Γυμναστικής", grade: 8.5, ects: 6, code: "" },
        { title: "Διδακτική και Προπονητική Δρόμων",          grade: 7,   ects: 6, code: "" },
        { title: "Λειτουργική και Ανατομική του Ανθρώπου",     grade: 4,   ects: 6, code: "" }
      ]
    },
    {
      name: "Β’ Εξάμηνο",
      courses: [
        { title: "Οργάνωση και Διοίκηση του Αθλητισμού",      grade: 8,   ects: 4, code: "" },
        { title: "Φυσιολογία του Ανθρώπου",                   grade: 7.5, ects: 6, code: "" }
      ]
    }
  ]
};

// ---------- Utils
const toFixed2 = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA);
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
async function ensureDefaultPin() {
  if (!localStorage.getItem(PIN_KEY)) localStorage.setItem(PIN_KEY, await sha256("1234"));
}
function setLocked(v) { localStorage.setItem(LOCK_KEY, v ? "1" : "0"); }
function isLocked() { return localStorage.getItem(LOCK_KEY) === "1"; }

// ---------- GPA & Stats
function computeWeightedGPA(data) {
  let wsum = 0, ectsSum = 0;
  data.semesters.forEach(s => s.courses.forEach(c => {
    if (typeof c.grade === "number" && typeof c.ects === "number") {
      wsum += c.grade * c.ects; ectsSum += c.ects;
    }
  }));
  return { gpa: ectsSum ? wsum / ectsSum : null, totalECTS: ectsSum };
}
function computeSemesterStats(data) {
  const labels = [], avg = [], ectsPassed = [], ectsFailed = [], perSemester = [];
  data.semesters.forEach((s) => {
    labels.push(s.name);
    let sum = 0, cnt = 0, passed = 0, failed = 0;
    const courseLabels = [], grades = [];
    s.courses.forEach((c) => {
      const has = typeof c.grade === "number";
      const ok = has && c.grade >= 5;
      const e = typeof c.ects === "number" ? c.ects : 0;
      if (has) { sum += c.grade; cnt++; }
      if (ok) passed += e; else failed += e;
      courseLabels.push(c.title); grades.push(has ? c.grade : null);
    });
    avg.push(cnt ? sum / cnt : null); ectsPassed.push(passed); ectsFailed.push(failed);
    perSemester.push({ labels: courseLabels, grades });
  });
  return { labels, avg, ectsPassed, ectsFailed, perSemester };
}

// ---------- Rendering
function render() {
  // lock state
  $("#lockedCover").hidden = !isLocked();
  $("#app").style.display = isLocked() ? "none" : "";

  const data = loadData();
  // header avatar & name
  renderAvatar(data.student.avatar, $("#avatarImg"), $("#avatarFallback"), data.student.firstName, data.student.lastName);
  renderAvatar(data.student.avatar, $("#menuAvatarImg"), $("#menuAvatarFallback"), data.student.firstName, data.student.lastName);
  $("#menuName").textContent = `${data.student.firstName} ${data.student.lastName}`;

  // main card
  $("#fullName").textContent = `${data.student.firstName} ${data.student.lastName}`;
  $("#university").textContent = data.student.university;
  $("#studentId").textContent = `Α.Μ.: ${data.student.studentId}`;

  // σύνοψη
  const { gpa, totalECTS } = computeWeightedGPA(data);
  $("#weightedGPA").textContent = toFixed2(gpa);
  $("#totalECTS").textContent = totalECTS ?? "—";

  // εξάμηνα
  const container = $("#semesters");
  container.innerHTML = "";
  data.semesters.forEach((sem, idx) => {
    const sec = document.createElement("section");
    sec.className = "card semester";
    sec.innerHTML = `<h2>${sem.name}</h2>`;

    sem.courses.forEach((c) => {
      const row = document.createElement("div");
      const has = typeof c.grade === "number";
      const ok = has ? c.grade >= 5 : null;
      row.className = "course";
      if (has) row.classList.add(ok ? "passed" : "failed");
      const status = has ? (ok ? "Πέρασε" : "Απέτυχε") : "—";
      row.innerHTML = `
        <div>
          <div>${c.title}</div>
          <div class="meta">${c.code || ""}</div>
        </div>
        <div class="right">
          <div class="status">${status}</div>
          <div>${toFixed2(c.grade)} • ${c.ects ?? "—"} ECTS</div>
        </div>
      `;
      sec.appendChild(row);
    });

    // μικρό γράφημα ανά εξάμηνο
    const block = document.createElement("div");
    block.className = "chart-block";
    block.innerHTML = `
      <h3>Βαθμοί ${sem.name}</h3>
      <canvas id="semBar-${idx}"></canvas>
    `;
    sec.appendChild(block);
    container.appendChild(sec);
  });

  renderCharts(data);
}

// avatar helpers
function renderAvatar(dataURL, imgEl, fallbackEl, fn, ln) {
  if (dataURL) {
    imgEl.src = dataURL;
    imgEl.style.display = "block";
    fallbackEl.style.display = "none";
  } else {
    const initials = `${(fn||"?")[0]||"?"}${(ln||"")[0]||""}`.toUpperCase();
    fallbackEl.textContent = initials;
    imgEl.style.display = "none";
    fallbackEl.style.display = "block";
  }
}

// ---------- Editor (τριπλό tap)
function setupTripleTap() {
  const target = $("#studentId");
  let taps = 0, timer = null;
  target.addEventListener("touchend", handle), target.addEventListener("click", handle);
  function handle() {
    taps++; if (timer) clearTimeout(timer);
    timer = setTimeout(() => { if (taps >= 3) openPinDialog("editor"); taps = 0; }, 350);
  }
}

async function openPinDialog(mode) {
  await ensureDefaultPin();
  const dlg = $("#pinDialog");
  const title = $("#pinTitle");
  const msg = $("#pinMsg");
  const input = $("#pinInput");
  if (mode === "unlock") { title.textContent = "Είσοδος"; msg.textContent = "Δώσε PIN για πρόσβαση στην εφαρμογή."; }
  else { title.textContent = "Κρυφός Editor"; msg.textContent = "Δώσε PIN για επεξεργασία βαθμών."; }
  input.value = ""; dlg.showModal(); input.focus();

  dlg.addEventListener("close", async function onClose() {
    dlg.removeEventListener("close", onClose);
    if (dlg.returnValue === "ok") {
      const entered = await sha256(input.value);
      const saved = localStorage.getItem(PIN_KEY);
      if (entered === saved) {
        if (mode === "unlock") {
          setLocked(false); render();
        } else openEditor();
      } else { alert("Λάθος PIN."); }
    }
  });
}

function openEditor() {
  const data = loadData();
  $("#firstName").value = data.student.firstName;
  $("#lastName").value = data.student.lastName;
  $("#universityInput").value = data.student.university;
  $("#studentIdInput").value = data.student.studentId;

  const container = $("#editorSemesters");
  container.innerHTML = "";
  data.semesters.forEach((sem) => container.appendChild(renderSemesterBox(sem)));

  $("#editorDialog").showModal();
  $("#addSemesterBtn").onclick = () => {
    container.appendChild(renderSemesterBox({ name: "Νέο Εξάμηνο", courses: [] }));
  };
  $("#saveBtn").onclick = async () => {
    data.student.firstName = $("#firstName").value.trim();
    data.student.lastName = $("#lastName").value.trim();
    data.student.university = $("#universityInput").value.trim();
    data.student.studentId = $("#studentIdInput").value.trim();
    data.semesters = collectSemestersFromUI();
    const np = $("#newPin").value.trim();
    if (np) localStorage.setItem(PIN_KEY, await sha256(np));
    saveData(data);
    $("#editorDialog").close();
    render();
  };
}

function renderSemesterBox(sem) {
  const box = document.createElement("div");
  box.className = "semester-box";
  box.innerHTML = `
    <div class="semester-head">
      <input class="sem-name" value="${sem.name}" />
      <button type="button" class="ghost remove">Διαγραφή</button>
    </div>
    <div class="courses"></div>
    <div class="small">
      <button type="button" class="ghost add-course">+ Προσθήκη Μαθήματος</button>
    </div>
  `;
  const coursesEl = box.querySelector(".courses");
  (sem.courses || []).forEach((c) => coursesEl.appendChild(renderCourseRow(c)));
  box.querySelector(".add-course").onclick = () => {
    coursesEl.appendChild(renderCourseRow({ title: "Νέο Μάθημα", code: "", grade: null, ects: null }));
  };
  box.querySelector(".remove").onclick = () => box.remove();
  return box;
}
function renderCourseRow(c) {
  const row = document.createElement("div");
  row.className = "inline-grid";
  row.innerHTML = `
    <input class="c-title" value="${c.title || ""}" placeholder="Τίτλος" />
    <input class="c-code" value="${c.code || ""}" placeholder="Κωδ." />
    <input class="c-grade" type="number" step="0.1" inputmode="decimal" value="${c.grade ?? ""}" placeholder="Βαθμός" />
    <input class="c-ects" type="number" step="1" inputmode="numeric" value="${c.ects ?? ""}" placeholder="ECTS" />
    <button type="button" class="ghost remove">✕</button>
  `;
  row.querySelector(".remove").onclick = () => row.remove();
  return row;
}
function collectSemestersFromUI() {
  const list = [];
  $$("#editorSemesters .semester-box").forEach((box) => {
    const name = box.querySelector(".sem-name").value.trim() || "Εξάμηνο";
    const courses = [];
    box.querySelectorAll(".courses .inline-grid").forEach((row) => {
      const title = row.querySelector(".c-title").value.trim();
      const code = row.querySelector(".c-code").value.trim();
      const gradeRaw = row.querySelector(".c-grade").value.trim();
      const ectsRaw = row.querySelector(".c-ects").value.trim();
      const grade = gradeRaw === "" ? null : Number(gradeRaw);
      const ects = ectsRaw === "" ? null : Number(ectsRaw);
      if (title) courses.push({ title, code, grade, ects });
    });
    list.push({ name, courses });
  });
  return list;
}

// ---------- Μενού προφίλ
function setupMenu() {
  const btn = $("#menuBtn");
  const dlg = $("#menuDialog");

  btn.addEventListener("click", () => {
    // Prefill tabs
    const data = loadData();
    $("#profileFirstName").value = data.student.firstName;
    $("#profileLastName").value = data.student.lastName;
    $("#profileUniversity").value = data.student.university;
    $("#profileStudentId").value = data.student.studentId;
    dlg.showModal();
  });

  // Tabs
  $$(".menu-tabs .tab").forEach(t => {
    t.addEventListener("click", () => {
      $$(".menu-tabs .tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const tab = t.dataset.tab;
      $$(".tab-panel").forEach(p => p.classList.remove("active"));
      $(`#tab-${tab}`).classList.add("active");
    });
  });

  // Avatar upload
  $("#avatarFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = loadData();
      data.student.avatar = reader.result;
      saveData(data);
      render(); // update avatar everywhere
    };
    reader.readAsDataURL(file);
  });

  // Save profile
  $("#saveProfileBtn").addEventListener("click", (ev) => {
    ev.preventDefault();
    const data = loadData();
    data.student.firstName = $("#profileFirstName").value.trim();
    data.student.lastName = $("#profileLastName").value.trim();
    data.student.university = $("#profileUniversity").value.trim();
    data.student.studentId = $("#profileStudentId").value.trim();
    saveData(data);
    render();
    $("#menuDialog").close();
  });

  // Save settings (PIN)
  $("#saveSettingsBtn").addEventListener("click", async (ev) => {
    ev.preventDefault();
    const np = $("#newPinFromMenu").value.trim();
    if (np) localStorage.setItem(PIN_KEY, await sha256(np));
    $("#menuDialog").close();
  });

  // Logout
  $("#logoutBtn").addEventListener("click", () => {
    setLocked(true);
    $("#menuDialog").close();
    render();
  });
}

// ---------- Charts
const chartRegistry = { gpaLine: null, ectsStacked: null, perSem: [] };
function destroyCharts() {
  if (chartRegistry.gpaLine) chartRegistry.gpaLine.destroy();
  if (chartRegistry.ectsStacked) chartRegistry.ectsStacked.destroy();
  chartRegistry.perSem.forEach(c => c?.destroy());
  chartRegistry.gpaLine = chartRegistry.ectsStacked = null; chartRegistry.perSem = [];
}
function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    ink: cs.getPropertyValue('--ink').trim() || '#e8eaed',
    border: cs.getPropertyValue('--border').trim() || 'rgba(255,255,255,.08)'
  };
}
function axisOpts() {
  const c = chartColors();
  return { ticks: { color: c.ink }, grid: { color: c.border } };
}
function renderCharts(data) {
  destroyCharts();
  const stats = computeSemesterStats(data);
  const c = chartColors();

  // Line: GPA per semester
  const gpaCtx = document.getElementById('gpaLine').getContext('2d');
  chartRegistry.gpaLine = new Chart(gpaCtx, {
    type: 'line',
    data: { labels: stats.labels, datasets: [{ label: 'Μ.Ο.', data: stats.avg, tension: .35, borderWidth: 2, pointRadius: 3 }] },
    options: { plugins: { legend: { labels: { color: c.ink } }, tooltip: { mode: 'index', intersect: false } },
               scales: { x: axisOpts(), y: axisOpts() } }
  });

  // Stacked bars: ECTS pass/fail
  const ectsCtx = document.getElementById('ectsStacked').getContext('2d');
  chartRegistry.ectsStacked = new Chart(ectsCtx, {
    type: 'bar',
    data: { labels: stats.labels,
            datasets: [{ label: 'Πέρασε (ECTS)', data: stats.ectsPassed, borderWidth: 1 },
                       { label: 'Απέτυχε (ECTS)', data: stats.ectsFailed, borderWidth: 1 }] },
    options: { plugins: { legend: { labels: { color: c.ink } } }, responsive: true,
               scales: { x: { ...axisOpts(), stacked: true }, y: { ...axisOpts(), stacked: true } } }
  });

  // Bars per semester
  stats.perSemester.forEach((sem, idx) => {
    const el = document.getElementById(`semBar-${idx}`); if (!el) return;
    const ctx = el.getContext('2d');
    const ch = new Chart(ctx, {
      type: 'bar',
      data: { labels: sem.labels, datasets: [{ label: 'Βαθμός', data: sem.grades, borderWidth: 1 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (tt) => `Βαθμός: ${toFixed2(tt.parsed.y)}` } } },
                 scales: { x: axisOpts(), y: { ...axisOpts(), suggestedMin: 0, suggestedMax: 10 } } }
    });
    chartRegistry.perSem.push(ch);
  });
}

// ---------- PWA
let deferredPrompt = null;
const installBtn = $("#installBtn"); // (προαιρετικά, αν το ξαναβάλεις)
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; installBtn?.removeAttribute("hidden"); });
installBtn?.addEventListener("click", async () => { installBtn.hidden = true; if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; } });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));

// ---------- Boot
document.getElementById("unlockBtn").addEventListener("click", () => openPinDialog("unlock"));
$("#menuBtn").addEventListener("click", () => {}); // placeholder to ensure existence
setupMenu();
setupTripleTap();
ensureDefaultPin();
if (localStorage.getItem(LOCK_KEY) == null) setLocked(false); // πρώτη φορά: unlocked
render();
