(() => {
  "use strict";

  const DEFAULT_COPY = {
    ".brand small": "Build your own path",
    "#dashboard .page-head .section-kicker": "BASE CAMP",
    "#dashboard .page-head p": "Projetos, dinheiro, estudos, livros, agenda, notas e animais — tudo no mesmo mapa.",
    "#dashboard .today-card .section-kicker": "TODAY",
    "#habits .page-head .section-kicker": "RHYTHM",
    "#projects .page-head .section-kicker": "TRAILS",
    "#studies .page-head .section-kicker": "STUDY CAMP",
    "#vehicles .page-head .section-kicker": "GARAGE",
    "#books .page-head .section-kicker": "LIBRARY",
    "#finance .page-head .section-kicker": "LEDGER",
    "#calendar .page-head .section-kicker": "TRAIL CALENDAR",
    "#notes .page-head .section-kicker": "FIELD NOTES",
    "#pets .page-head .section-kicker": "RANCH",
    "#pets .stats-grid .stat-card:first-child small": "no seu rancho",
    "#settings .page-head .section-kicker": "BASE SETTINGS",
    "#alerts .page-head .section-kicker": "WATCHTOWER",
    "#projectModal .section-kicker": "NEW TRAIL",
    "#projectDetailModal .section-kicker": "PROJECT CAMP",
    "#projectEditModal .section-kicker": "EDIT TRAIL",
    "#financeModal .section-kicker": "LEDGER ENTRY",
    "#accountModal .section-kicker": "WALLET",
    "#calendarModal .section-kicker": "NEW DATE",
    "#studyModal .section-kicker": "STUDY LOG",
    "#vehicleModal .section-kicker": "NEW RIDE",
    "#vehicleDetailModal .section-kicker": "GARAGE FILE",
    "#petModal .section-kicker": "NEW RANCH MEMBER",
    "#petDetailModal .section-kicker": "RANCH FILE",
    "#bookModal .section-kicker": "NEW BOOK",
    "#bookDetailModal .section-kicker": "READING FILE",
    "#habitModal .section-kicker": "NEW RHYTHM",
    "#monthlyReviewModal .section-kicker": "MONTHLY REVIEW"
  };

  const BARBIE_COPY = {
    ".brand small": "Dream it. Live it.",
    "#dashboard .page-head .section-kicker": "DREAMHOUSE",
    "#dashboard .page-head p": "Projetos, dinheiro, estudos, livros, agenda, notas e animais — seu mundo Frontier em um só lugar.",
    "#dashboard .today-card .section-kicker": "TODAY IN PINK",
    "#habits .page-head .section-kicker": "GLOW ROUTINE",
    "#projects .page-head .section-kicker": "DREAM PLANS",
    "#studies .page-head .section-kicker": "STUDY STUDIO",
    "#vehicles .page-head .section-kicker": "DREAM GARAGE",
    "#books .page-head .section-kicker": "BOOK CLUB",
    "#finance .page-head .section-kicker": "GLAM BUDGET",
    "#calendar .page-head .section-kicker": "DREAM CALENDAR",
    "#notes .page-head .section-kicker": "PINK NOTES",
    "#pets .page-head .section-kicker": "PET CLUB",
    "#pets .stats-grid .stat-card:first-child small": "no seu pet club",
    "#settings .page-head .section-kicker": "STYLE STUDIO",
    "#alerts .page-head .section-kicker": "SPARKLE CENTER",
    "#projectModal .section-kicker": "NEW DREAM PLAN",
    "#projectDetailModal .section-kicker": "DREAM PROJECT",
    "#projectEditModal .section-kicker": "EDIT DREAM PLAN",
    "#financeModal .section-kicker": "BUDGET ENTRY",
    "#accountModal .section-kicker": "PINK WALLET",
    "#calendarModal .section-kicker": "NEW DREAM DATE",
    "#studyModal .section-kicker": "STUDY DIARY",
    "#vehicleModal .section-kicker": "DREAM RIDE",
    "#vehicleDetailModal .section-kicker": "DREAM GARAGE",
    "#petModal .section-kicker": "NEW PET",
    "#petDetailModal .section-kicker": "PET PROFILE",
    "#bookModal .section-kicker": "BOOK CLUB",
    "#bookDetailModal .section-kicker": "READING DIARY",
    "#habitModal .section-kicker": "NEW GLOW ROUTINE",
    "#monthlyReviewModal .section-kicker": "MONTHLY GLOW"
  };

  const KUROMI_COPY = {
    ".brand small": "Cute chaos. Your path.",
    "#dashboard .page-head .section-kicker": "KUROMI WORLD",
    "#dashboard .page-head p": "Projetos, dinheiro, estudos, livros, agenda, notas e animais — seu lado dark & cute dentro do Frontier.",
    "#dashboard .today-card .section-kicker": "TODAY'S MISCHIEF",
    "#habits .page-head .section-kicker": "MISCHIEF ROUTINE",
    "#projects .page-head .section-kicker": "DARK PLANS",
    "#studies .page-head .section-kicker": "STUDY DEN",
    "#vehicles .page-head .section-kicker": "MIDNIGHT GARAGE",
    "#books .page-head .section-kicker": "MIDNIGHT LIBRARY",
    "#finance .page-head .section-kicker": "DARK WALLET",
    "#calendar .page-head .section-kicker": "MISCHIEF CALENDAR",
    "#notes .page-head .section-kicker": "SECRET NOTES",
    "#pets .page-head .section-kicker": "PET HIDEOUT",
    "#pets .stats-grid .stat-card:first-child small": "no seu pet hideout",
    "#settings .page-head .section-kicker": "STYLE LAB",
    "#alerts .page-head .section-kicker": "MISCHIEF CENTER",
    "#projectModal .section-kicker": "NEW DARK PLAN",
    "#projectDetailModal .section-kicker": "DARK PROJECT",
    "#projectEditModal .section-kicker": "EDIT DARK PLAN",
    "#financeModal .section-kicker": "DARK WALLET ENTRY",
    "#accountModal .section-kicker": "DARK WALLET",
    "#calendarModal .section-kicker": "NEW MISCHIEF DATE",
    "#studyModal .section-kicker": "STUDY DIARY",
    "#vehicleModal .section-kicker": "NEW MIDNIGHT RIDE",
    "#vehicleDetailModal .section-kicker": "MIDNIGHT GARAGE",
    "#petModal .section-kicker": "NEW PET",
    "#petDetailModal .section-kicker": "PET PROFILE",
    "#bookModal .section-kicker": "MIDNIGHT BOOK",
    "#bookDetailModal .section-kicker": "READING DIARY",
    "#habitModal .section-kicker": "NEW MISCHIEF ROUTINE",
    "#monthlyReviewModal .section-kicker": "MONTHLY MOOD"
  };

  function activeTheme() {
    if (document.body.classList.contains("theme-barbie")) return "barbie";
    if (document.body.classList.contains("theme-kuromi")) return "kuromi";
    return "default";
  }

  function copyForTheme(theme) {
    if (theme === "barbie") return { ...DEFAULT_COPY, ...BARBIE_COPY };
    if (theme === "kuromi") return { ...DEFAULT_COPY, ...KUROMI_COPY };
    return DEFAULT_COPY;
  }

  function applyWorldCopy() {
    const copy = copyForTheme(activeTheme());
    for (const [selector, value] of Object.entries(copy)) {
      const el = document.querySelector(selector);
      if (el && el.textContent !== value) el.textContent = value;
    }
  }

  let scheduled = false;
  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyWorldCopy();
    });
  }

  // Reaplica quando o app troca o tema ou renderiza conteúdo novo.
  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  document.addEventListener("DOMContentLoaded", scheduleApply);
  window.addEventListener("load", scheduleApply);
  window.FrontierThemeWorlds = { apply: applyWorldCopy };
  scheduleApply();
})();
