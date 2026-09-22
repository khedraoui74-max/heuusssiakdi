import type { AppSpec, Artifact, Connector } from "./store";
import { uid } from "./store";

export type TraceKind = "think" | "search" | "code" | "tool" | "policy" | "model";
export type TraceStep = {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "run" | "done" | "blocked";
  kind: TraceKind;
  links?: { title: string; url: string }[];
};

export type GeneratedFile = { path: string; language: string; content: string };

export type EngineResult = {
  reply: string;
  steps: TraceStep[];
  files: GeneratedFile[];
  app?: AppSpec;
  artifacts: Artifact[];
  blocked?: string;
};

const ILLEGAL =
  /\b(dark\s*web|darkweb|deep\s*web|onion|tor\s*browser|\.onion|marché noir|marche noir|silk road|drugs?|drogue|arme|exploit kit|ransomware|carding|doxx|ddos)\b/i;

const CODE_ASK =
  /\b(code|programme|programmation|application|app|script|api|react|python|html|css|typescript|javascript|fonction|algorithme|générer|genere|créer|creer|construire|développer|developper|site web|liste de t[aâ]ches|minuteur|calculatrice|dashboard|tableau de bord)\b/i;

export const FREE_MODELS = [
  { id: "local", label: "Atelier local", hint: "Planificateur + génération hors ligne (toujours disponible)." },
  { id: "qwen27", label: "Qwen 27", hint: "Voie interne rapide." },
  { id: "blockia", label: "BlockIA", hint: "Voie structurée." },
  { id: "groq", label: "Groq (gratuit avec clé)", hint: "llama-3.1-8b-instant — clé groq.com." },
  { id: "openrouter", label: "OpenRouter gratuit", hint: "Modèles :free si clé openrouter.ai." },
  { id: "hf", label: "Hugging Face", hint: "Inference Router si jeton hf.co." },
] as const;

export type ProviderId = (typeof FREE_MODELS)[number]["id"];

export function loadKeys() {
  try {
    return JSON.parse(localStorage.getItem("heuusssiakdi-keys") || "{}") as {
      groq?: string;
      openrouter?: string;
      huggingface?: string;
    };
  } catch {
    return {};
  }
}

export function saveKeys(k: ReturnType<typeof loadKeys>) {
  localStorage.setItem("heuusssiakdi-keys", JSON.stringify(k));
}

function step(kind: TraceKind, label: string, detail: string, status: TraceStep["status"] = "done"): TraceStep {
  return { id: uid("t"), kind, label, detail, status };
}

function extractTopic(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[«»"']/g, "")
    .slice(0, 140)
    .trim();
}

export async function searchClearnet(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const q = query.slice(0, 80) || "intelligence artificielle";
  const out: { title: string; url: string; snippet: string }[] = [];
  try {
    const url = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&origin=*&srlimit=4`;
    const res = await fetch(url);
    const data = await res.json();
    for (const hit of data?.query?.search ?? []) {
      out.push({
        title: hit.title,
        url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(String(hit.title).replace(/ /g, "_"))}`,
        snippet: String(hit.snippet || "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 220),
      });
    }
  } catch {
    /* réseau indisponible */
  }
  if (!out.length) {
    out.push({
      title: `Recherche claire · ${q}`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      snippet: "Source de repli : DuckDuckGo (web indexé public).",
    });
    out.push({
      title: `MDN / docs`,
      url: `https://developer.mozilla.org/fr/search?q=${encodeURIComponent(q)}`,
      snippet: "Documentation technique publique.",
    });
  }
  return out;
}

function langFromPath(path: string) {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "html";
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "app"
  );
}

export const APP_TEMPLATES = [
  { id: "taches", label: "Liste de tâches", hint: "tâches avec cases et mémoire locale" },
  { id: "notes", label: "Carnet de notes", hint: "notes datées persistantes" },
  { id: "chrono", label: "Minuteur", hint: "pomodoro simple" },
  { id: "calcul", label: "Calculatrice", hint: "opérations de base" },
  { id: "dashboard", label: "Tableau de bord", hint: "cartes KPI et activité" },
] as const;

export function detectKind(prompt: string) {
  const p = prompt.toLowerCase();
  if (/chrono|timer|pomodoro|minut/.test(p)) return "chrono";
  if (/calcul/.test(p)) return "calcul";
  if (/dashboard|tableau de bord|kpi|stat/.test(p)) return "dashboard";
  if (/note|carnet|journal/.test(p)) return "notes";
  return "taches";
}

export function previewHtml(files: { path: string; content: string }[]) {
  return files.find((f) => f.path.endsWith(".html"))?.content || "";
}

function shell(title: string, body: string, script: string) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; --bg:#0b0f12; --card:#12181c; --cyan:#7ee7f0; --line:rgba(255,255,255,.08); --muted:#8b99a3; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: DM Sans, system-ui, sans-serif; background:radial-gradient(1200px 600px at 10% -10%, #163038, var(--bg)); color:#f4f7f8; }
    main { max-width:760px; margin:32px auto; padding:0 16px 40px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 20px 50px rgba(0,0,0,.35); }
    h1 { margin:0 0 6px; font-size:26px; }
    p.lead { color:var(--muted); margin:0 0 18px; }
    input, textarea, button { font:inherit; border-radius:12px; padding:10px 12px; border:1px solid var(--line); }
    input, textarea { width:100%; background:#0c1114; color:inherit; }
    button { background:var(--cyan); color:#062026; font-weight:600; cursor:pointer; }
    button.ghost { background:#151c20; color:#d7e0e5; }
    .row { display:flex; gap:8px; margin:12px 0; }
    .row > * { flex:1; }
    ul { list-style:none; padding:0; margin:12px 0 0; }
    li { display:flex; justify-content:space-between; gap:8px; align-items:center; border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin:8px 0; background:#0f1518; }
    .kpi { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
    .kpi div { background:#0f1518; border:1px solid var(--line); border-radius:12px; padding:12px; }
    .kpi b { display:block; font-size:22px; color:var(--cyan); }
    .display { font-size:28px; text-align:right; padding:12px; background:#0c1114; border-radius:12px; margin-bottom:10px; }
    .pad { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .muted { color:var(--muted); font-size:13px; }
  </style>
</head>
<body>
  <main><div class="card">${body}</div></main>
  <script>${script}</script>
</body>
</html>`;
}

function htmlForKind(kind: string, title: string, id: string) {
  if (kind === "calcul") {
    return shell(
      title,
      `<h1>${escapeHtml(title)}</h1><p class="lead">Calculatrice générée par l’atelier.</p><div class="display" id="out">0</div><div class="pad" id="pad"></div>`,
      `const keys=["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];
const pad=document.getElementById("pad"); const out=document.getElementById("out");
let cur="0";
keys.forEach(k=>{const b=document.createElement("button"); b.textContent=k; if(k!=="=") b.className="ghost"; b.onclick=()=>{
  if(k==="="){ try{ cur=String(Function("return "+cur)()); }catch{ cur="Erreur"; } }
  else cur = cur==="0"||cur==="Erreur"? k : cur+k;
  out.textContent=cur;
}; pad.appendChild(b);});`
    );
  }
  if (kind === "chrono") {
    return shell(
      title,
      `<h1>${escapeHtml(title)}</h1><p class="lead">Minuteur 25 / 5 — mémoire de sessions.</p>
       <h1 id="clock">25:00</h1>
       <div class="row"><button id="start">Démarrer</button><button class="ghost" id="reset">Réinitialiser</button></div>
       <p class="muted" id="stat">0 session(s)</p>`,
      `let left=25*60, t=null, sessions=Number(localStorage.getItem("heuusss-chrono-${id}")||0);
const clock=document.getElementById("clock"); const stat=document.getElementById("stat");
const fmt=()=>{const m=String(Math.floor(left/60)).padStart(2,"0"); const s=String(left%60).padStart(2,"0"); clock.textContent=m+":"+s; stat.textContent=sessions+" session(s)";};
document.getElementById("start").onclick=()=>{ if(t) return; t=setInterval(()=>{ left--; if(left<=0){ clearInterval(t); t=null; sessions++; localStorage.setItem("heuusss-chrono-${id}", sessions); left=5*60;} fmt();},1000);};
document.getElementById("reset").onclick=()=>{ clearInterval(t); t=null; left=25*60; fmt();}; fmt();`
    );
  }
  if (kind === "dashboard") {
    return shell(
      title,
      `<h1>${escapeHtml(title)}</h1><p class="lead">Tableau de bord local.</p>
       <div class="kpi"><div><span class="muted">Demandes</span><b id="k1">0</b></div><div><span class="muted">Terminées</span><b id="k2">0</b></div><div><span class="muted">Ratio</span><b id="k3">—</b></div></div>
       <div class="row"><input id="item" placeholder="Nouvelle activité" /><button id="add">Ajouter</button></div>
       <ul id="list"></ul>`,
      `const key="heuusss-dash-${id}";
const load=()=>JSON.parse(localStorage.getItem(key)||"[]");
const save=r=>localStorage.setItem(key,JSON.stringify(r));
const render=()=>{const rows=load(); document.getElementById("list").innerHTML=rows.map((r,i)=>"<li>"+r.title+" <button data-i='"+i+"' class='ghost'>"+(r.ok?"OK":"Valider")+"</button></li>").join("");
  const done=rows.filter(r=>r.ok).length; document.getElementById("k1").textContent=rows.length; document.getElementById("k2").textContent=done;
  document.getElementById("k3").textContent=rows.length?Math.round(done/rows.length*100)+"%":"—";};
document.getElementById("add").onclick=()=>{const v=item.value.trim(); if(!v) return; save([{title:v,ok:false},...load()]); item.value=""; render();};
list.onclick=e=>{const i=e.target.dataset.i; if(i==null) return; const rows=load(); rows[Number(i)].ok=!rows[Number(i)].ok; save(rows); render();}; render();`
    );
  }
  if (kind === "notes") {
    return shell(
      title,
      `<h1>${escapeHtml(title)}</h1><p class="lead">Carnet privé — tout reste dans ce navigateur.</p>
       <textarea id="body" rows="5" placeholder="Écrire une note…"></textarea>
       <div class="row"><button id="add">Enregistrer</button></div>
       <ul id="list"></ul>`,
      `const key="heuusss-notes-${id}";
const load=()=>JSON.parse(localStorage.getItem(key)||"[]");
const save=r=>localStorage.setItem(key,JSON.stringify(r));
const render=()=>{list.innerHTML=load().map((r,i)=>"<li><div><b>"+new Date(r.at).toLocaleString()+"</b><div class='muted'>"+r.body+"</div></div><button class='ghost' data-i='"+i+"'>Supprimer</button></li>").join("");};
add.onclick=()=>{const el=document.getElementById("body"); const body=el.value.trim(); if(!body) return; save([{at:Date.now(),body},...load()]); el.value=""; render();};
list.onclick=e=>{const i=e.target.dataset.i; if(i==null) return; const rows=load(); rows.splice(Number(i),1); save(rows); render();}; render();`
    );
  }
  return shell(
    title,
    `<h1>${escapeHtml(title)}</h1><p class="lead">Liste persistante générée par HeuusssIAKDi2.0.</p>
     <div class="row"><input id="item" placeholder="Nouvelle tâche" /><button id="add">Ajouter</button></div>
     <ul id="list"></ul>`,
    `const key="heuusss-app-${id}";
const load=()=>JSON.parse(localStorage.getItem(key)||"[]");
const save=r=>localStorage.setItem(key,JSON.stringify(r));
const render=()=>{list.innerHTML=load().map((r,i)=>"<li><span>"+(r.ok?"✓ ":"")+r.title+"</span><span><button class='ghost' data-t='"+i+"'>OK</button> <button class='ghost' data-d='"+i+"'>×</button></span></li>").join("");};
add.onclick=()=>{const v=item.value.trim(); if(!v) return; save([{title:v,ok:false},...load()]); item.value=""; render();};
list.onclick=e=>{const rows=load(); if(e.target.dataset.t!=null){rows[Number(e.target.dataset.t)].ok=!rows[Number(e.target.dataset.t)].ok; save(rows);} if(e.target.dataset.d!=null){rows.splice(Number(e.target.dataset.d),1); save(rows);} render();}; render();`
  );
}

export function generateProgram(prompt: string, kindHint?: string): GeneratedFile[] {
  const title = extractTopic(prompt).slice(0, 48) || "Atelier";
  const id = slug(title);
  const kind = kindHint || detectKind(prompt);
  const wantsPy = /\bpython\b|\.py\b/i.test(prompt);
  const wantsTs = /\btypescript|\.tsx?\b|react\b/i.test(prompt);
  const files: GeneratedFile[] = [];
  files.push({ path: `apps/${id}/index.html`, language: "html", content: htmlForKind(kind, title, id) });

  if (wantsPy) {
    files.push({
      path: `apps/${id}/main.py`,
      language: "python",
      content: `#!/usr/bin/env python3
"""${title} — module généré par HeuusssIAKDi2.0 (atelier local)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Task:
    title: str
    done: bool = False


class Workspace:
    def __init__(self, name: str) -> None:
        self.name = name
        self.tasks: list[Task] = []

    def add(self, title: str) -> Task:
        task = Task(title=title)
        self.tasks.append(task)
        return task

    def summary(self) -> str:
        open_n = sum(1 for t in self.tasks if not t.done)
        return f"{self.name}: {open_n} ouverte(s) / {len(self.tasks)}"


def main() -> None:
    ws = Workspace(${JSON.stringify(title)})
    ws.add("Clarifier le besoin")
    ws.add("Écrire les tests")
    ws.add("Livrer une version minimale")
    print(ws.summary())


if __name__ == "__main__":
    main()
`,
    });
    files.push({
      path: `apps/${id}/test_main.py`,
      language: "python",
      content: `from main import Workspace

def test_summary():
    ws = Workspace("demo")
    ws.add("a")
    assert "1 ouverte" in ws.summary()
`,
    });
  }


  if (wantsTs) {
    files.push({
      path: `apps/${id}/App.tsx`,
      language: "typescript",
      content: `import { useState } from "react";

export default function App() {
  const [items, setItems] = useState<string[]>([]);
  const [value, setValue] = useState("");
  return (
    <main>
      <h1>${title.replace(/`/g, "")}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          setItems((xs) => [value.trim(), ...xs]);
          setValue("");
        }}
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit">Ajouter</button>
      </form>
      <ul>{items.map((it) => <li key={it}>{it}</li>)}</ul>
    </main>
  );
}
`,
    });
  }

  files.push({
    path: `apps/${id}/README.md`,
    language: "markdown",
    content: `# ${title}

Généré par HeuusssIAKDi2.0 (atelier local).

## Intention
${prompt.slice(0, 400)}

## Lancer
- HTML : ouvrir \`index.html\`
- Python : \`python3 main.py\`
- React : copier \`App.tsx\` dans le projet Vite existant

## Limites
Pas d’accès réseau anonyme, pas de dark web, pas d’actions illégales.
`,
  });

  return files;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c);
}

async function callFreeModel(provider: string, prompt: string): Promise<string | null> {
  const keys = loadKeys();
  try {
    if (provider === "groq" && keys.groq) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${keys.groq}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "Assistant technique francophone. Refuse les activités illégales. Produis du code précis." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }
    if (provider === "openrouter" && keys.openrouter) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys.openrouter}`,
          "Content-Type": "application/json",
          "HTTP-Referer": location.origin,
          "X-Title": "HeuusssIAKDi2.0",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.2-3b-instruct:free",
          messages: [
            { role: "system", content: "Assistant technique francophone. Refuse les activités illégales." },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }
    if (provider === "hf" && keys.huggingface) {
      const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${keys.huggingface}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/Llama-3.2-3B-Instruct",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function runEngine(opts: {
  text: string;
  model: string;
  webSearch: boolean;
  connectors: Connector[];
  onStep?: (s: TraceStep[]) => void;
}): Promise<EngineResult> {
  const { text, model, webSearch, connectors, onStep } = opts;
  const steps: TraceStep[] = [];
  const push = (s: TraceStep) => {
    steps.push(s);
    onStep?.([...steps]);
  };

  push(step("think", "Analyse de la demande", `Intention extraite : ${extractTopic(text)}`));

  if (ILLEGAL.test(text)) {
    const blocked =
      "Demande refusée : pas d’accès dark web, pas de Tor/.onion, pas d’aide à des activités illégales. Utilisez le web indexé public (Wikipedia, documentation officielle, GitHub public).";
    push({
      id: uid("t"),
      kind: "policy",
      label: "Garde-fou",
      detail: blocked,
      status: "blocked",
    });
    return { reply: blocked, steps, files: [], artifacts: [], blocked };
  }

  push(
    step(
      "model",
      `Voie ${model}`,
      FREE_MODELS.find((m) => m.id === model)?.hint ||
        "Atelier local +, si une clé gratuite est enregistrée, modèle cloud."
    )
  );

  const activeTools = connectors.filter((c) => c.active).map((c) => c.name);
  push(
    step(
      "tool",
      "Outils disponibles",
      activeTools.length
        ? `Connecteurs actifs : ${activeTools.join(", ")}.`
        : "Aucun connecteur actif — atelier local + recherche claire uniquement."
    )
  );

  let links: { title: string; url: string; snippet: string }[] = [];
  if (webSearch) {
    const running = step("search", "Recherche claire", `Requête : ${extractTopic(text)}`, "run");
    push(running);
    links = await searchClearnet(text);
    running.status = "done";
    running.detail = `${links.length} source(s) publiques.`;
    running.links = links.map(({ title, url }) => ({ title, url }));
    onStep?.([...steps]);
  } else {
    push(step("search", "Recherche web", "Désactivée — activez-la pour illustrer les sources.", "pending"));
  }

  let files: GeneratedFile[] = [];
  let app: AppSpec | undefined;
  if (CODE_ASK.test(text)) {
    const running = step("code", "Génération de programme", "Architecture minimale + fichiers.", "run");
    push(running);
    files = generateProgram(text);
    app = {
      id: uid("app"),
      name: extractTopic(text).slice(0, 48) || "Application",
      problem: text,
      spec: files.map((f) => f.path).join("\n"),
      files: files.map((f) => f.path),
      workFiles: files,
      kind: detectKind(text),
    };
    running.status = "done";
    running.detail = `${files.length} fichier(s) : ${files.map((f) => f.path).join(", ")}`;
    onStep?.([...steps]);
  }

  const remote = ["groq", "openrouter", "hf"].includes(model) ? await callFreeModel(model, text) : null;
  if (["groq", "openrouter", "hf"].includes(model) && !remote) {
    push(step("model", "Clé absente ou API indisponible", "Repli sur l’atelier local. Ajoutez une clé gratuite dans Outils.", "pending"));
  } else if (remote) {
    push(step("model", "Réponse modèle gratuit", "Complétion reçue du fournisseur choisi."));
  }

  const artifacts: Artifact[] = files.map((f) => ({
    id: uid("a"),
    kind: "text",
    name: f.path,
    description: f.content.slice(0, 180),
  }));

  const sourceBlock = links.length
    ? "\n\nSources consultées (web public) :\n" + links.map((l) => `• ${l.title} — ${l.url}\n  ${l.snippet}`).join("\n")
    : "";

  const fileBlock = files.length
    ? "\n\nFichiers générés :\n" + files.map((f) => `• ${f.path} (${langFromPath(f.path)})`).join("\n")
    : "";

  const localReply = `Voie ${model}. Travail effectué à l’écran : analyse, ${webSearch ? "recherche claire, " : ""}${
    files.length ? "génération de code, " : ""
  }synthèse.

Vous avez demandé : « ${text} ».

${
  files.length
    ? "Un prototype a été assemblé (HTML et/ou Python/React) et enregistré dans Créer une application + Artefacts. Ouvrez le panneau Fichiers pour copier le code."
    : "Pas de projet logiciel détecté. Reformulez avec « crée une application … » ou « programme en Python … » pour obtenir des fichiers complets."
}

Limite assumée : l’atelier exécute des recherches et du code sur le web public. Aucune passerelle Tor, aucun .onion.`;

  return {
    reply: (remote || localReply) + sourceBlock + fileBlock,
    steps,
    files,
    app,
    artifacts,
  };
}

export function filesToApp(files: GeneratedFile[], name: string, problem: string): AppSpec {
  return {
    id: uid("app"),
    name,
    problem,
    spec: files.map((f) => `## ${f.path}\n\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join("\n\n"),
    files: files.map((f) => f.path),
  };
}
