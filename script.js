/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรองตาม mood
   - order.html   : เติมฟอร์มจาก URL parameter + ส่งคำสั่งซื้อ
   - admin.html   : แสดงคำสั่งซื้อจาก Google Sheet (CSV)
   ========================================================== */

var APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzQ8datsD0Od3D1FXufFqaCYi8lRVDF7KMJuEicHxUTajlcpqfyI-ninElqsp95ul7vrg/exec";

var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYXBEy6fQIW_10eX3UvQp0qGeV09xpwFSiSDQaucrTdXsw2GkLhay_OQM9JkiCYQcy7h7JO_f5JPls/pub?gid=0&single=true&output=csv";

var MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" }
];

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

/* ==========================================================
   1) product.html
   ========================================================== */
function initProductPage() {
  var filterBar = document.getElementById("filter-bar");
  var list = document.getElementById("product-list");
  var products = [];
  var currentMood = "all";

  list.textContent = "กำลังโหลดสินค้า...";

  fetch("products.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;

      var param = new URLSearchParams(window.location.search).get("mood");
      if (param && isValidMood(param)) currentMood = param.toLowerCase();

      buildFilterBar();
      renderProducts();
    })
    .catch(function (err) {
      console.error("โหลด products.json ไม่สำเร็จ:", err);
      list.textContent = "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง";
    });

  function isValidMood(value) {
    return MOODS.some(function (m) {
      return m.key === String(value).toLowerCase();
    });
  }

  function buildFilterBar() {
    if (!filterBar) return;
    filterBar.innerHTML = "";

    MOODS.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.label;
      btn.dataset.mood = m.key;
      if (m.key !== "all") btn.classList.add("mood-" + m.key);

      btn.addEventListener("click", function () {
        currentMood = m.key;
        updateUrl();
        renderProducts();
      });

      filterBar.appendChild(btn);
    });
  }

  function updateFilterState() {
    if (!filterBar) return;
    var buttons = filterBar.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].dataset.mood === currentMood;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function updateUrl() {
    var url = new URL(window.location.href);
    if (currentMood === "all") url.searchParams.delete("mood");
    else url.searchParams.set("mood", currentMood);
    window.history.replaceState(null, "", url);
  }

  function renderProducts() {
    updateFilterState();
    list.innerHTML = "";

    var shown = products.filter(function (p) {
      return currentMood === "all" || p.mood === currentMood;
    });

    if (shown.length === 0) {
      list.textContent = "ไม่พบสินค้าในหมวดนี้";
      return;
    }

    shown.forEach(function (p) {
      list.appendChild(createCard(p));
    });
  }

  function createCard(p) {
    var card = document.createElement("article");
    card.className = "product-card mood-" + p.mood;

    var media = document.createElement("div");
    media.className = "product-card__media";
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name + " " + p.size;
    img.loading = "lazy";
    media.appendChild(img);

    var body = document.createElement("div");
    body.className = "product-card__body";

    var meta = document.createElement("div");
    meta.className = "product-card__meta";
    var moodLabel = document.createElement("span");
    moodLabel.className = "mood-label";
    moodLabel.textContent = capitalize(p.mood);
    meta.appendChild(moodLabel);

    var name = document.createElement("h3");
    name.className = "product-card__name";
    name.textContent = p.name;

    var foot = document.createElement("div");
    foot.className = "product-card__foot";

    var size = document.createElement("span");
    size.className = "size-tag";
    size.textContent = p.size;

    var price = document.createElement("span");
    price.className = "price";
    price.textContent = Number(p.price).toLocaleString("th-TH") + " ";
    var unit = document.createElement("small");
    unit.textContent = "บาท";
    price.appendChild(unit);

    foot.appendChild(size);
    foot.appendChild(price);

    var buy = document.createElement("a");
    buy.className = "btn btn--gold btn--block";
    buy.textContent = "สั่งซื้อ";
    var params = new URLSearchParams();
    params.set("item", p.name + " " + p.size);
    params.set("price", p.price);
    buy.href = "order.html?" + params.toString();

    body.appendChild(meta);
    body.appendChild(name);
    body.appendChild(foot);
    body.appendChild(buy);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }
}

function capitalize(s) {
  s = String(s || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById("orderForm");
  var itemsField = document.getElementById("items");
  var totalField = document.getElementById("total");
  var submitBtn = form.querySelector('[type="submit"]');

  /* เติมค่าจาก URL parameter ทันทีที่โหลดหน้า (ทั้ง items และ total) */
  var params = new URLSearchParams(window.location.search);
  var item = params.get("item");
  var price = params.get("price");

  if (item !== null && itemsField) itemsField.value = item;
  if (price !== null && totalField) totalField.value = price;

  /* พื้นที่แสดงข้อความสถานะ (ใช้ #formMessage ถ้ามี ไม่มีก็สร้างให้) */
  var message = document.getElementById("formMessage");
  if (!message) {
    message = document.createElement("p");
    message.id = "formMessage";
    message.className = "form-message";
    message.setAttribute("role", "status");
    form.appendChild(message);
  }

  function showMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("form-message--error", !!isError);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var totalRaw = totalField.value.trim();
    var payload = {
      customerName: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      items: itemsField.value.trim(),
      total: totalRaw !== "" && !isNaN(totalRaw) ? Number(totalRaw) : totalRaw,
      note: document.getElementById("note").value.trim()
    };

    if (submitBtn) submitBtn.disabled = true;
    showMessage("กำลังส่งคำสั่งซื้อ...", false);

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        showMessage("ส่งคำสั่งซื้อเรียบร้อยแล้ว ขอบคุณที่ไว้วางใจ Body Scent", false);
      })
      .catch(function (err) {
        console.error("ส่งคำสั่งซื้อไม่สำเร็จ:", err);
        showMessage("ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", true);
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */
function initAdminPage() {
  var tbody = document.querySelector("#ordersTable tbody");
  var COLS = 6;

  setStatusRow("กำลังโหลดข้อมูล...");

  fetch(SHEET_CSV_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      /* ตัดแถวหัวตาราง (ถ้ามี) และแถวว่าง */
      rows = rows.filter(function (r) {
        return r.some(function (cell) {
          return cell.trim() !== "";
        });
      });
      if (rows.length && isHeaderRow(rows[0])) rows.shift();

      /* appendRow เพิ่มต่อท้ายตามลำดับเวลา จึงกลับลำดับให้ล่าสุดขึ้นก่อน */
      rows.reverse();

      if (rows.length === 0) {
        setStatusRow("ยังไม่มีคำสั่งซื้อ");
        return;
      }
      renderRows(rows);
    })
    .catch(function (err) {
      console.error("โหลดข้อมูลคำสั่งซื้อไม่สำเร็จ:", err);
      setStatusRow("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    });

  function isHeaderRow(row) {
    var first = (row[0] || "").trim();
    return first !== "" && isNaN(Date.parse(first)) && !/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(first);
  }

  function setStatusRow(text) {
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = COLS;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderRows(rows) {
    tbody.innerHTML = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      for (var i = 0; i < COLS; i++) {
        var td = document.createElement("td");
        td.textContent = r[i] !== undefined ? r[i] : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }
}

/* ----------------------------------------------------------
   CSV parser (เขียนเอง ไม่ใช้ library)
   รองรับ: เครื่องหมายคำพูด "...", "" แทน " ภายในช่อง,
   ขึ้นบรรทัดใหม่ภายในช่อง, ท้ายบรรทัดแบบ \n และ \r\n, BOM
   ---------------------------------------------------------- */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);

    if (inQuotes) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  /* แถวสุดท้ายที่ไม่มีการขึ้นบรรทัดใหม่ปิดท้าย */
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
