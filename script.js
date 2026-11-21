/* ============ Settings (edit these) ============ */
const GITHUB_USERNAME = "vxrlyjoyce-cpu";
const PROJECTS_FILE = "project.json";
/* Repos you do NOT want shown as project cards (repo names, any case) */
const HIDDEN_REPOS = ["vxrlyjoyce-cpu.github.io"];
/* How long (minutes) the GitHub list is remembered in the visitor's browser */
const CACHE_MINUTES = 10;

const $ = (id) => document.getElementById(id);
let allProjects = [];

/* ============ Footer year ============ */
const yearEl = $("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ============ Mobile menu ============ */
const menuToggle = $("menuToggle");
const mainMenu = $("mainMenu");
if (menuToggle && mainMenu) {
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
}

/* ============ Light / dark theme ============ */
const root = document.documentElement;
const themeToggle = $("themeToggle");
function applyTheme(theme) {
  if (!root || !themeToggle) return;
  root.dataset.theme = theme;
  themeToggle.innerHTML = theme === "dark" ? "&#9728;" : "&#9790;";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}
if (themeToggle) {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem("theme"); } catch (e) {}
  applyTheme(savedTheme || "light");
  themeToggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
}

/* ============ Photo fallback ============ */
const photo = document.querySelector(".hero-photo");
if (photo) {
  photo.addEventListener("error", () => {
    photo.src = "data:image/svg+xml;utf8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#7c3aed"/>' +
      '<text x="100" y="130" font-size="100" font-family="sans-serif" font-weight="800" text-anchor="middle" fill="#fff">V</text></svg>'
    );
  }, { once: true });
}

/* ============ Helpers for projects ============ */
const CANON = {
  html: "HTML", css: "CSS", javascript: "JavaScript", js: "JavaScript", typescript: "TypeScript",
  python: "Python", java: "Java", php: "PHP", nodejs: "Node.js", "node-js": "Node.js", node: "Node.js",
  react: "React", netlify: "Netlify", json: "JSON", "c#": "C#", "c++": "C++"
};
function canon(t) {
  const k = String(t).trim().toLowerCase();
  return CANON[k] || (k.charAt(0).toUpperCase() + k.slice(1));
}
function uniqueTech(list) {
  const seen = new Set();
  const out = [];
  list.forEach((t) => {
    const c = canon(t);
    if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push(c); }
  });
  return out;
}
const slug = (s) => String(s || "").toLowerCase().replace(/\.github\.io$/, "").replace(/[^a-z0-9]+/g, "");
const repoKey = (r) => String(r || "").trim().toLowerCase().replace(/\/+$/, "").split("/").pop();

function prettyTitle(name) {
  return name
    .replace(/\.github\.io$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || name;
}

function liveUrl(r) {
  if (r.homepage) return /^https?:\/\//i.test(r.homepage) ? r.homepage : "https://" + r.homepage;
  if (r.has_pages) {
    return /\.github\.io$/i.test(r.name)
      ? "https://" + r.name.toLowerCase() + "/"
      : "https://" + r.owner.toLowerCase() + ".github.io/" + r.name + "/";
  }
  return "";
}

/* A GitHub repo turned into a project card */
function repoToProject(r) {
  const live = liveUrl(r);
  return {
    title: prettyTitle(r.name),
    description: r.description || "A project I uploaded to GitHub. A full description is coming soon.",
    technologies: uniqueTech([r.language, ...(r.topics || [])].filter(Boolean)),
    role: "",
    screenshot: "https://opengraph.githubassets.com/1/" + r.owner + "/" + r.name,
    link: live || r.html_url,
    linkLabel: live ? "View project" : "View on GitHub",
    source: live ? r.html_url : ""
  };
}

/* ============ GitHub repositories (cached, one request for everything) ============ */
async function getRepos() {
  const cacheKey = "gh-repos-" + GITHUB_USERNAME;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch (e) {}
  if (cached && Date.now() - cached.time < CACHE_MINUTES * 60000) return cached.data;

  try {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=created&direction=desc&per_page=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = (await res.json()).map((r) => ({
      name: r.name, html_url: r.html_url, description: r.description, language: r.language,
      topics: r.topics || [], homepage: r.homepage, has_pages: r.has_pages, fork: r.fork,
      created_at: r.created_at, pushed_at: r.pushed_at, owner: r.owner.login
    }));
    try { localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data })); } catch (e) {}
    return data;
  } catch (err) {
    console.warn("GitHub data unavailable:", err);
    if (cached) return cached.data;   // show the last known list instead of nothing
    throw err;
  }
}

async function getManualProjects() {
  try {
    const res = await fetch(PROJECTS_FILE);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("project.json could not be loaded:", err);
    return [];
  }
}

/* ============ Build the project list ============ */
/* project.json first (your own cards, or a repo's card customised with "repo": "repo-name"),
   then every other public, non-fork repo from GitHub, newest first. */
function mergeProjects(manual, repos) {
  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const used = new Set();

  const fromFile = manual.map((p) => {
    const key = repoKey(p.repo);
    let r = key ? byName.get(key) : null;
    if (!r) r = repos.find((x) => slug(x.name) && slug(x.name) === slug(p.title)) || null;  // same name as a repo
    if (r) used.add(r.name.toLowerCase());
    const base = r ? repoToProject(r) : { technologies: [], link: "", linkLabel: "View project", source: "", role: "", screenshot: "" };
    if (!r && key && !p.link) {   // repo named in project.json but GitHub data not available: still link to it
      base.link = /^https?:\/\//i.test(p.repo) ? p.repo : "https://github.com/" + GITHUB_USERNAME + "/" + p.repo;
      base.linkLabel = "View on GitHub";
    }
    return {
      title: p.title || base.title,
      description: p.description || base.description,
      technologies: (p.technologies && p.technologies.length) ? uniqueTech(p.technologies) : base.technologies,
      role: p.role || "",
      screenshot: p.screenshot || base.screenshot,
      link: p.link || base.link,
      linkLabel: p.link ? "View project" : base.linkLabel,
      source: p.source || (r && p.link && p.link !== r.html_url ? r.html_url : base.source)
    };
  });

  const auto = repos
    .filter((r) => !r.fork && !used.has(r.name.toLowerCase()) &&
      !HIDDEN_REPOS.some((h) => h.toLowerCase() === r.name.toLowerCase()))
    .map(repoToProject);

  return fromFile.concat(auto);
}

async function loadProjects() {
  const msg = $("projectsMessage");
  const [manual, reposResult] = await Promise.all([
    getManualProjects(),
    getRepos().then((d) => ({ ok: true, data: d })).catch(() => ({ ok: false, data: [] }))
  ]);
  const repos = reposResult.data;

  allProjects = mergeProjects(manual, repos);
  if (allProjects.length) {
    buildFilters();
    renderProjects("All");
  } else if (msg) {
    msg.textContent = "Projects could not be loaded right now. Please try again later.";
    msg.classList.add("is-error");
    msg.hidden = false;
  }
  renderRepos(repos, reposResult.ok);
}

function buildFilters() {
  const bar = $("filterBar");
  if (!bar) return;
  bar.innerHTML = "";
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
  const list = $("projectsList");
  if (!list) return;
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
  if (p.screenshot) {
    const img = document.createElement("img");
    img.src = p.screenshot;
    img.alt = "Screenshot of " + p.title;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.remove();
      shot.classList.add("no-img");
    }, { once: true });
    shot.append(img);
  } else {
    shot.classList.add("no-img");
  }

  const body = document.createElement("div");
  body.className = "project-body";

  const h3 = document.createElement("h3");
  h3.textContent = p.title;
  body.append(h3);

  const desc = document.createElement("p");
  desc.textContent = p.description;
  body.append(desc);

  if (p.technologies.length) {
    const techText = document.createElement("p");
    techText.textContent = "Technologies: " + p.technologies.join(", ");
    body.append(techText);
  }
  if (p.role) {
    const role = document.createElement("p");
    role.className = "role";
    role.textContent = "My role: " + p.role;
    body.append(role);
  }

  const links = document.createElement("div");
  links.className = "card-links";
  const addLink = (href, label) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    links.append(a);
  };
  if (p.link) addLink(p.link, p.linkLabel || "View project");
  if (p.source) addLink(p.source, "Source code");
  if (links.children.length) body.append(links);

  card.append(shot, body);
  return card;
}

/* ============ Latest repositories list ============ */
function renderRepos(repos, ok) {
  const list = $("reposList");
  const msg = $("reposMessage");
  if (!list) return;
  list.innerHTML = "";
  if (!ok) {
    if (msg) {
      msg.textContent = "GitHub data is unavailable right now. Please try again later.";
      msg.classList.add("is-error");
      msg.hidden = false;
    }
    return;
  }
  if (!repos.length) {
    if (msg) { msg.textContent = "No public repositories yet."; msg.hidden = false; }
    return;
  }
  if (msg) msg.hidden = true;
  [...repos]
    .sort((a, b) => new Date(b.pushed_at || b.created_at) - new Date(a.pushed_at || a.created_at))
    .slice(0, 5)
    .forEach((r) => {
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
}

/* ============ Contact form ============ */
const form = $("contactForm");
if (form) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function check(input, errorId, message) {
    const errEl = $(errorId);
    if (errEl) errEl.textContent = message;
    if (input) input.classList.toggle("invalid", message !== "");
    return message === "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("formName");
    const email = $("formEmail");
    const text = $("formMessage");
    const thanks = $("formThanks");
    if (thanks) thanks.hidden = true;

    const emailValue = email ? email.value.trim() : "";
    const okName = check(name, "nameError", name && name.value.trim() ? "" : "Please enter your name.");
    const okEmail = check(email, "emailError",
      !emailValue ? "Please enter your email." :
      !emailPattern.test(emailValue) ? "Please enter a valid email address." : "");
    const okText = check(text, "messageError", text && text.value.trim() ? "" : "Please enter a message.");

    if (okName && okEmail && okText) {
      form.reset();
      if (thanks) thanks.hidden = false;
    }
  });
}

/* ============ Back to top ============ */
const backToTop = $("backToTop");
if (backToTop) {
  window.addEventListener("scroll", () => {
    backToTop.classList.toggle("show", window.scrollY > 400);
  });
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

loadProjects();
