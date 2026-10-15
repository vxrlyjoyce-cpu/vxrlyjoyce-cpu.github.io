// ===== Settings =====
const GITHUB_USERNAME = "vxrlyjoyce-cpu";

const \$ = (id) => document.getElementById(id);
let allProjects = [];

// ----- Footer year -----
\$("year").textContent = new Date().getFullYear();

// ----- Mobile menu -----
const menuToggle = \$("menuToggle");
const mainMenu = \$("mainMenu");
menuToggle.addEventListener("click", () => {
  const open = mainMenu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
mainMenu.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    mainMenu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

// ----- Light / dark theme switch (my own feature) -----
const root = document.documentElement;
const themeToggle = \$("themeToggle");
function applyTheme(theme) {
  root.dataset.theme = theme;
  themeToggle.innerHTML = theme === "dark" ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("theme"); } catch (e) {}
applyTheme(savedTheme || "light");
themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// ----- Profile photo fallback (purple "V" if the image is missing) -----
const photo = document.querySelector(".hero-photo");
photo.addEventListener("error", () => {
  photo.src = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#7c3aed"/>' +
    '<text x="100" y="130" font-size="100" font-family="sans-serif" font-weight="800" text-anchor="middle" fill="#fff">V</text></svg>'
  );
}, { once: true });

// ----- Projects from project.json -----
async function loadProjects() {
  const msg = \$("projectsMessage");
  try {
    // FIXED: Changed path from "data/projects.json" to match your root "project.json" file
    const res = await fetch("project.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    allProjects = await res.json();
    buildFilters();
    renderProjects("All");
  } catch (err) {
    console.warn("Projects could not be loaded:", err);
    msg.textContent = "Projects could not be loaded right now. Please try again later.";
    msg.classList.add("is-error");
    msg.hidden = false;
  }
}

function buildFilters() {
  const bar = \$("filterBar");
  const techs = ["All", ...new Set(allProjects.flatMap((p) => p.technologies))];
  techs.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filter-btn";
    b.textContent = t;
    b.setAttribute("aria-pressed", String(t === "All"));
    b.addEventListener("click", () => {
      bar.querySelectorAll(".filter-btn").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      renderProjects(t);
    });
    bar.append(b);
  });
}

function renderProjects(tech) {
  const list = \$("projectsList");
  list.innerHTML = "";
  allProjects
    .filter((p) => tech === "All" || p.technologies.includes(tech))
    .forEach((p) => list.append(buildCard(p)));
}

function buildCard(p) {
  const card = document.createElement("article");
  card.className = "project-card";

  const shot = document.createElement("div");
  shot.className = "shot";
  const img = document.createElement("img");
  
  // NOTE: If screenshots don't show up, verify your root "images" folder exists
  img.src = p.screenshot.includes("/") ? p.screenshot : p.screenshot;
  img.alt = "Screenshot of " + p.title;
  img.loading = "lazy";
  img.addEventListener("error", () => { img.remove(); shot.classList.add("no-img"); }, { once: true });
  shot.append(img);

  const body = document.createElement("div");
  body.className = "project-body";
  const h3 = document.createElement("h3");
  h3.textContent = p.title;
  const desc = document.createElement("p");
  desc.textContent = p.description;
  const tech = document.createElement("p");
  tech.textContent = "Technologies: " + p.technologies.join(", ");
  const role = document.createElement("p");
  role.className = "role";
  role.textContent = "My role: " + p.role;
  const link = document.createElement("a");
  link.href = p.link;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "View project";

  body.append(h3, desc, tech, role, link);
  card.append(shot, body);
  return card;
}

// ----- Latest GitHub repositories -----
async function loadRepos() {
  const list = \$("reposList");
  const msg = \$("reposMessage");
  // FIXED: Added backticks around the API URL string to prevent crash syntax errors
  const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=5`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const repos = await res.json();
    if (repos.length === 0) {
      msg.textContent = "No public repositories yet.";
      return;
    }
    msg.hidden = true;
    repos.forEach((r) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = r.html_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = r.name;
      const lang = document.createElement("span");
      lang.className = "lang";
      lang.textContent = r.language || "No language listed";
      li.append(a, lang);
      list.append(li);
    });
  } catch (err) {
    console.warn("GitHub data unavailable:", err);
    msg.textContent = "GitHub data is unavailable right now. Please try again later.";
    msg.classList.add("is-error");
  }
}

// ----- Contact form validation -----
const form = \$("contactForm");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}\$/;

function check(input, errorId, message) {
  \$(errorId).textContent = message;
  input.classList.toggle("invalid", message !== "");
  return message === "";
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = \$("formName");
  const email = \$("formEmail");
  const text = \$("formMessage");
  const thanks = \$("formThanks");
  thanks.hidden = true;

  const emailValue = email.value.trim();
  const okName = check(name, "nameError", name.value.trim() ? "" : "Please enter your name.");
  const okEmail = check(email, "emailError",
    !emailValue ? "Please enter your email." :
    !emailPattern.test(emailValue) ? "Please enter a valid email address." : "");
  const okText = check(text, "messageError", text.value.trim() ? "" : "Please enter a message.");

  if (okName && okEmail && okText) {
    form.reset();
    thanks.hidden = false;
  }
});

// ----- Back to top button -----
const backToTop = \$("backToTop");
window.addEventListener("scroll", () => {
  backToTop.classList.toggle("show", window.scrollY > 400);
});
backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// ----- Start -----
loadProjects();
loadRepos();
