import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ACCESS_CATALOG,
  MODELS,
  SOCIAL_NETWORKS,
  type AlertItem,
  type Artifact,
  type Conversation,
  type DB,
  type Route,
  type SocialNet,
  type WorkFile,
  uid,
} from "./store";
import {
  APP_TEMPLATES,
  detectKind,
  generateProgram,
  loadKeys,
  previewHtml,
  runEngine,
  saveKeys,
  searchClearnet,
  type TraceStep,
} from "./engine";

export function Workspace({
  route,
  db,
  setDb,
  flash,
  go,
}: {
  route: Route;
  db: DB;
  setDb: Dispatch<SetStateAction<DB>>;
  flash: (s: string) => void;
  go: (r: Route, path?: string) => void;
}) {
  if (route === "/") return <ChatView db={db} setDb={setDb} flash={flash} />;
  if (route === "/ia-personnelle") return <Hub go={go} db={db} />;
  if (route === "/historique") return <HistoryView db={db} setDb={setDb} flash={flash} go={go} />;
  if (route === "/artefacts") return <ArtifactsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/connecteurs") return <ConnectorsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/creer-application") return <BuilderView db={db} setDb={setDb} flash={flash} />;
  if (route === "/studio-video") return <VideoView db={db} setDb={setDb} flash={flash} />;
  if (route === "/reseaux") return <SocialView db={db} setDb={setDb} flash={flash} />;
  if (route === "/alertes") return <AlertsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/partage") return <ShareView db={db} />;
  return <div className="panel">L’espace n’a pas pu être affiché. Vous pouvez réessayer ou revenir à l’accueil.</div>;
}

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
    </div>
  );
}

function PreviewFrame({ html }: { html: string }) {
  if (!html) return <p className="muted">Aucun aperçu HTML pour ce fichier.</p>;
  return <iframe title="Aperçu de l’application" className="preview" sandbox="allow-scripts allow-same-origin" srcDoc={html} />;
}

function ChatView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [cid, setCid] = useState(db.conversations.find((c) => !c.archived)?.id);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveTrace, setLiveTrace] = useState<TraceStep[]>([]);
  const [fileOpen, setFileOpen] = useState<WorkFile | null>(null);
  const [tab, setTab] = useState<"journal" | "code" | "preview">("journal");
  const [keysOpen, setKeysOpen] = useState(false);
  const [keys, setKeys] = useState(loadKeys);
  const conv = db.conversations.find((c) => c.id === cid) ?? db.conversations.find((c) => !c.archived);
  const list = db.conversations.filter((c) => (showArchived || !c.archived) && c.title.toLowerCase().includes(q.toLowerCase()));
  const trace = liveTrace.length ? liveTrace : conv?.trace ?? [];
  const files = conv?.files ?? [];
  const html = useMemo(() => previewHtml(files), [files]);

  useEffect(() => {
    const box = document.querySelector(".msgs");
    if (box) box.scrollTop = box.scrollHeight;
  }, [conv?.messages.length, busy]);

  const send = async (preset?: string) => {
    const body = (preset ?? text).trim();
    if (!body || busy) return;
    const current: Conversation = conv ?? { id: uid("c"), title: body.slice(0, 42), model: "local", webSearch: true, messages: [] };
    const userMsg = { id: uid("m"), role: "user" as const, content: body, at: Date.now() };
    const thinking = { id: uid("m"), role: "assistant" as const, content: "Travail en cours — journal, code et aperçu à droite.", at: Date.now() };
    const seeded = {
      ...current,
      title: current.messages.length ? current.title : body.slice(0, 42),
      webSearch: current.webSearch !== false,
      messages: [...current.messages, userMsg, thinking],
      trace: [],
    };
    setDb((prev) => ({
      ...prev,
      conversations: [seeded, ...prev.conversations.filter((c) => c.id !== seeded.id)],
      requests: [{ id: uid("r"), projectId: current.projectId, text: body, status: "ouverte", at: Date.now() }, ...prev.requests],
    }));
    setCid(seeded.id);
    if (!preset) setText("");
    setBusy(true);
    setLiveTrace([]);
    setTab("journal");
    try {
      const result = await runEngine({
        text: body,
        model: current.model || "local",
        webSearch: current.webSearch !== false,
        connectors: db.connectors,
        onStep: setLiveTrace,
      });
      const next: Conversation = {
        ...seeded,
        messages: [...current.messages, userMsg, { ...thinking, content: result.reply }],
        trace: result.steps,
        files: result.files,
      };
      setDb((prev) => ({
        ...prev,
        conversations: [next, ...prev.conversations.filter((c) => c.id !== next.id)],
        apps: result.app ? [result.app, ...prev.apps] : prev.apps,
        artifacts: result.artifacts.length ? [...result.artifacts, ...prev.artifacts] : prev.artifacts,
      }));
      setLiveTrace(result.steps);
      if (result.files[0]) setFileOpen(result.files[0]);
      if (result.files.length) setTab("preview");
      if (result.blocked) flash("Demande hors périmètre — voir le journal.");
      else if (result.files.length) flash(`${result.files.length} fichier(s) · aperçu prêt.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workbench">
      <div className="chat">
        <div>
          <div className="toolbar">
            <button
              className="chip"
              onClick={() => {
                const created: Conversation = { id: uid("c"), title: "Nouvelle conversation", model: "local", webSearch: true, messages: [] };
                setDb({ ...db, conversations: [created, ...db.conversations] });
                setCid(created.id);
                setLiveTrace([]);
                setFileOpen(null);
              }}
            >
              Nouvelle conversation
            </button>
            <input className="field" style={{ maxWidth: 200 }} placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="muted">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archives
            </label>
            {conv && (
              <>
                <select
                  className="field"
                  style={{ maxWidth: 190 }}
                  value={conv.model}
                  onChange={(e) =>
                    setDb({
                      ...db,
                      conversations: db.conversations.map((c) => (c.id === conv.id ? { ...c, model: e.target.value as Conversation["model"] } : c)),
                    })
                  }
                >
                  {Object.entries(MODELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button
                  className="chip"
                  onClick={() =>
                    setDb({
                      ...db,
                      conversations: db.conversations.map((c) => (c.id === conv.id ? { ...c, webSearch: !c.webSearch } : c)),
                    })
                  }
                >
                  {conv.webSearch !== false ? "Recherche claire ON" : "Recherche claire OFF"}
                </button>
                <button className="chip" onClick={() => setKeysOpen((v) => !v)}>
                  Clés IA
                </button>
              </>
            )}
          </div>
          {keysOpen && (
            <div className="panel keys-box">
              <p className="muted">Clés uniquement dans ce navigateur. Ne les collez jamais dans le chat.</p>
              <label>Groq</label>
              <input type="password" value={keys.groq || ""} placeholder="gsk_…" onChange={(e) => setKeys({ ...keys, groq: e.target.value })} />
              <label>OpenRouter</label>
              <input type="password" value={keys.openrouter || ""} placeholder="sk-or-…" onChange={(e) => setKeys({ ...keys, openrouter: e.target.value })} />
              <label>Hugging Face</label>
              <input type="password" value={keys.huggingface || ""} placeholder="hf_…" onChange={(e) => setKeys({ ...keys, huggingface: e.target.value })} />
              <button
                className="btn btn-cyan"
                onClick={() => {
                  saveKeys(keys);
                  flash("Clés enregistrées localement.");
                  setKeysOpen(false);
                }}
              >
                Enregistrer les clés
              </button>
            </div>
          )}
          <div className="list conv-strip">
            {list.map((c) => (
              <button key={c.id} className={c.id === conv?.id ? "item on" : "item"} onClick={() => { setCid(c.id); setLiveTrace([]); setFileOpen(c.files?.[0] ?? null); }}>
                <span>
                  {c.title}
                  {c.archived ? " (archivé)" : ""}
                </span>
                <span
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDb({ ...db, conversations: db.conversations.map((x) => (x.id === c.id ? { ...x, archived: !x.archived } : x)) });
                  }}
                >
                  {c.archived ? "Restaurer" : "Archiver"}
                </span>
              </button>
            ))}
          </div>
          <div className="msgs">
            {!conv?.messages.length && (
              <div className="panel">
                <h3>Atelier conversation + programmes</h3>
                <p className="muted">
                  Décrivez l’application. Le journal, le code et l’aperçu s’affichent à droite. Tor n’est pas prévu : recherche claire uniquement.
                </p>
                <div className="toolbar">
                  {APP_TEMPLATES.map((t) => (
                    <button key={t.id} className="chip" onClick={() => void send(`Crée une application ${t.label} : ${t.hint}`)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {conv?.messages.map((m) => (
              <div key={m.id} className={`bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
          </div>
        </div>
        <div className="composer">
          <textarea
            placeholder="Décrivez le programme, l’application ou la recherche…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="toolbar">
            <span className="muted">{busy ? "Étapes visibles à droite…" : "Entrée = ligne · Maj + Entrée = lancer"}</span>
            <button className="btn btn-cyan" style={{ width: "auto", margin: 0 }} disabled={busy} onClick={() => void send()}>
              {busy ? "En cours" : "Lancer"}
            </button>
          </div>
        </div>
      </div>
      <aside className="research">
        <div className="tabs compact">
          <button className={tab === "journal" ? "on" : ""} onClick={() => setTab("journal")}>
            Journal
          </button>
          <button className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}>
            Code
          </button>
          <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>
            Aperçu
          </button>
        </div>
        {tab === "journal" && (
          <div className="trace">
            {!trace.length && <div className="muted">En attente d’une demande.</div>}
            {trace.map((s) => (
              <div key={s.id} className={`trace-step ${s.status} ${s.kind}`}>
                <div className="trace-head">
                  <span className="dot" />
                  <b>{s.label}</b>
                  <em>{s.status}</em>
                </div>
                <p>{s.detail}</p>
                {s.links?.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
        {tab === "code" && (
          <>
            <div className="list">
              {files.map((f) => (
                <button key={f.path} className="item" onClick={() => setFileOpen(f)}>
                  <span>{f.path}</span>
                  <span className="muted">{f.language}</span>
                </button>
              ))}
              {!files.length && <p className="muted">Aucun fichier pour l’instant.</p>}
            </div>
            {fileOpen && (
              <div className="panel code-panel">
                <div className="toolbar">
                  <b>{fileOpen.path}</b>
                  <button
                    className="chip"
                    onClick={() => {
                      void navigator.clipboard.writeText(fileOpen.content);
                      flash("Code copié.");
                    }}
                  >
                    Copier
                  </button>
                </div>
                <pre>{fileOpen.content}</pre>
              </div>
            )}
          </>
        )}
        {tab === "preview" && <PreviewFrame html={html} />}
      </aside>
    </div>
  );
}

function Hub({ go, db }: { go: (r: Route) => void; db: DB }) {
  const cards: [string, string, string, Route][] = [
    ["Conversation", `${db.conversations.filter((c) => !c.archived).length} fils`, "Journal, code, aperçu.", "/"],
    ["Projets", `${db.projects.length} projets · ${db.requests.length} demandes`, "Historique et partages.", "/historique"],
    ["Applications", `${db.apps.length} prototypes`, "Modèles + aperçu live.", "/creer-application"],
    ["Studio vidéo", `${db.videos.length} films`, "Scènes éditables.", "/studio-video"],
    ["Réseaux sociaux", `${(db.socialAccounts || []).length} comptes · ${(db.socialPosts || []).length} envois`, "TikTok, Instagram, YouTube, Facebook, X.", "/reseaux"],
    ["Artefacts", `${db.artifacts.length} pièces`, "Notes, liens, extraits.", "/artefacts"],
    ["Alertes", `${db.alerts.length} veilles`, "Wikipedia public.", "/alertes"],
    ["Connecteurs", `${db.connectors.filter((c) => c.active).length} actifs`, "IA gratuites et sites.", "/connecteurs"],
  ];
  return (
    <div>
      <PageHead title="Votre IA personnelle" sub="Un espace pour rechercher, programmer et assembler — web public uniquement." />
      <div className="stats">
        <div><b>{db.conversations.length}</b><span>conversations</span></div>
        <div><b>{db.apps.length}</b><span>apps</span></div>
        <div><b>{db.artifacts.length}</b><span>artefacts</span></div>
        <div><b>{db.connectors.filter((c) => c.active).length}</b><span>accès</span></div>
      </div>
      <div className="grid">
        {cards.map(([t, d, n, r]) => (
          <div className="panel hover" key={t}>
            <h3>{t}</h3>
            <p className="muted">{d}</p>
            <p className="muted">{n}</p>
            <button className="btn btn-ghost" onClick={() => go(r)}>
              Ouvrir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ db, setDb, flash, go }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void; go: (r: Route, path?: string) => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"toutes" | "ouverte" | "terminée">("toutes");
  const shown = db.requests.filter((r) => filter === "toutes" || r.status === filter);
  return (
    <div>
      <PageHead title="Historique" sub="Projets, demandes du chat et liens de lecture seule." />
      <div className="grid">
        <div className="panel">
          <h3>Nouveau projet</h3>
          <label>Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" />
          <label>Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Objectif, contraintes…" />
          <button
            className="btn btn-cyan"
            onClick={() => {
              if (!name.trim()) return flash("Ajoutez un nom de projet.");
              setDb({ ...db, projects: [{ id: uid("p"), name: name.trim(), note: note.trim() }, ...db.projects] });
              setName("");
              setNote("");
              flash("Projet créé.");
            }}
          >
            Créer le projet
          </button>
          <div className="list" style={{ marginTop: 12 }}>
            {db.projects.map((p) => (
              <div className="item" key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <div className="muted">{p.note || "Sans note."}</div>
                </div>
                <div className="row-actions">
                  <button
                    className="chip"
                    onClick={() => {
                      const token = uid("share");
                      setDb({ ...db, shares: [...db.shares, { token, projectId: p.id, canEdit: false }] });
                      flash(`Lien : /partage/${token}`);
                      go("/partage", `/partage/${token}`);
                    }}
                  >
                    Partager
                  </button>
                  <button className="danger" onClick={() => setDb({ ...db, projects: db.projects.filter((x) => x.id !== p.id) })}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
            {!db.projects.length && <div className="muted">Créez un projet pour regrouper vos demandes.</div>}
          </div>
        </div>
        <div className="panel">
          <h3>Demandes</h3>
          <div className="toolbar">
            {(["toutes", "ouverte", "terminée"] as const).map((f) => (
              <button key={f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <div className="list">
            {shown.map((r) => (
              <div className="item" key={r.id}>
                <div>
                  <div>{r.text}</div>
                  <div className="muted">{new Date(r.at).toLocaleString()}</div>
                </div>
                <button
                  className="chip"
                  onClick={() =>
                    setDb({
                      ...db,
                      requests: db.requests.map((x) => (x.id === r.id ? { ...x, status: x.status === "terminée" ? "ouverte" : "terminée" } : x)),
                    })
                  }
                >
                  {r.status}
                </button>
              </div>
            ))}
            {!shown.length && <div className="muted">Rien dans ce filtre.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactsView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [name, setName] = useState("");
  const [k, setK] = useState<Artifact["kind"]>("text");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [q, setQ] = useState("");
  const rows = db.artifacts.filter((a) => `${a.name} ${a.description || ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead title="Artefacts" sub="Notes, liens et extraits générés par l’atelier." />
      <div className="grid">
        <div className="panel">
          <label>Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Brief du projet" />
          <label>Type</label>
          <select className="field" value={k} onChange={(e) => setK(e.target.value as Artifact["kind"])}>
            <option value="link">Lien</option>
            <option value="text">Note</option>
            <option value="file">Fichier</option>
          </select>
          {k === "link" ? <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /> : null}
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ajoutez une note utile…" />
          <button
            className="btn btn-cyan"
            onClick={() => {
              if (!name.trim()) return;
              setDb({ ...db, artifacts: [{ id: uid("a"), kind: k, name: name.trim(), url, description }, ...db.artifacts] });
              flash("Artefact ajouté.");
              setName("");
              setDescription("");
            }}
          >
            Ajouter
          </button>
        </div>
        <div>
          <input className="field" placeholder="Filtrer" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list" style={{ marginTop: 10 }}>
            {rows.map((a) => (
              <div className="item" key={a.id}>
                <div>
                  <b>{a.name}</b>
                  <div className="muted">
                    {a.kind} — {a.description || "Aucune description."}
                  </div>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.url}
                    </a>
                  ) : null}
                </div>
                <button className="danger" onClick={() => setDb({ ...db, artifacts: db.artifacts.filter((x) => x.id !== a.id) })}>
                  Supprimer
                </button>
              </div>
            ))}
            {!rows.length && <div className="muted">Aucun artefact pour ce filtre.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorsView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"api" | "mcp" | "app">("api");
  const [url, setUrl] = useState("");
  const [q, setQ] = useState("");
  const toggleCatalog = (item: (typeof ACCESS_CATALOG)[number]) => {
    const existing = db.connectors.find((c) => c.name === item.name);
    if (existing) {
      setDb({ ...db, connectors: db.connectors.map((c) => (c.name === item.name ? { ...c, active: !c.active } : c)) });
      flash(existing.active ? `${item.name} en pause.` : `${item.name} activé.`);
      return;
    }
    setDb({
      ...db,
      connectors: [{ id: uid("k"), kind: item.kind, name: item.name, url: item.url, description: item.description, active: true }, ...db.connectors],
    });
    flash(`${item.name} ajouté.`);
  };
  return (
    <div>
      <PageHead title="Accès et outils" sub="Activez les voies utiles. Rien d’anonyme, rien d’illégal : web public et clés personnelles." />
      <input className="field" placeholder="Filtrer le catalogue" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid" style={{ marginTop: 12 }}>
        {ACCESS_CATALOG.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).map((item) => {
          const on = db.connectors.some((c) => c.name === item.name && c.active);
          return (
            <div className="panel hover" key={item.name}>
              <h3>{item.name}</h3>
              <p className="muted">{item.description}</p>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.url.replace("https://", "")}
                </a>
              ) : null}
              <button className={on ? "btn btn-ghost" : "btn btn-cyan"} onClick={() => toggleCatalog(item)}>
                {on ? "Mettre en pause" : "Activer"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Connecteur personnalisé</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <select className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="api">API</option>
          <option value="mcp">MCP</option>
          <option value="app">Application / site</option>
        </select>
        <button
          className="btn btn-cyan"
          onClick={() => {
            if (!name.trim()) return;
            setDb({ ...db, connectors: [{ id: uid("k"), kind, name: name.trim(), url, active: true }, ...db.connectors] });
            flash("Connecteur enregistré.");
            setName("");
            setUrl("");
          }}
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function BuilderView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [kind, setKind] = useState(APP_TEMPLATES[0].id);
  const [open, setOpen] = useState(db.apps[0]?.id);
  const current = db.apps.find((a) => a.id === open) ?? db.apps[0];
  const files = current?.workFiles ?? [];
  const [file, setFile] = useState<WorkFile | undefined>(files[0]);
  useEffect(() => setFile(files[0]), [current?.id]);
  return (
    <div>
      <PageHead title="Créer une application" sub="Choisissez un modèle, générez les fichiers, prévisualisez tout de suite." />
      <div className="grid">
        <div className="panel">
          <label>Nom</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon app" />
          <label>Problème résolu</label>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Que doit faire l’application ?" />
          <label>Modèle</label>
          <div className="toolbar">
            {APP_TEMPLATES.map((t) => (
              <button key={t.id} className={kind === t.id ? "chip on" : "chip"} onClick={() => setKind(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-cyan"
            onClick={() => {
              if (!name.trim()) return flash("Donnez un nom.");
              const brief = `${name}. ${problem} ${kind}`;
              const workFiles = generateProgram(brief, kind);
              const app = {
                id: uid("app"),
                name: name.trim(),
                problem,
                spec: workFiles.map((f) => f.path).join("\n"),
                files: workFiles.map((f) => f.path),
                workFiles,
                kind,
              };
              setDb({ ...db, apps: [app, ...db.apps] });
              setOpen(app.id);
              setName("");
              flash("Prototype généré — aperçu ci-dessous.");
            }}
          >
            Générer le prototype
          </button>
          <div className="list" style={{ marginTop: 12 }}>
            {db.apps.map((a) => (
              <button key={a.id} className={a.id === current?.id ? "item on" : "item"} onClick={() => setOpen(a.id)}>
                <span>
                  {a.name} <span className="muted">{a.kind || detectKind(a.problem)}</span>
                </span>
                <span
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDb({ ...db, apps: db.apps.filter((x) => x.id !== a.id) });
                  }}
                >
                  Supprimer
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          {!current && <p className="muted">Générez un premier prototype pour voir le code et l’aperçu.</p>}
          {current && (
            <>
              <h3>{current.name}</h3>
              <p className="muted">{current.problem || "Sans brief."}</p>
              <div className="list">
                {files.map((f) => (
                  <button key={f.path} className="item" onClick={() => setFile(f)}>
                    <span>{f.path}</span>
                    <span className="muted">{f.language}</span>
                  </button>
                ))}
              </div>
              {file && (
                <div className="code-panel">
                  <div className="toolbar">
                    <b>{file.path}</b>
                    <button
                      className="chip"
                      onClick={() => {
                        void navigator.clipboard.writeText(file.content);
                        flash("Copié.");
                      }}
                    >
                      Copier
                    </button>
                  </div>
                  <pre>{file.content}</pre>
                </div>
              )}
              <h3 style={{ marginTop: 14 }}>Aperçu</h3>
              <PreviewFrame html={previewHtml(files)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [idea, setIdea] = useState("");
  return (
    <div>
      <PageHead title="Studio vidéo" sub="Scénario, scènes éditables et storyboard coloré — export après relecture." />
      <div className="panel">
        <label>Sujet ou idée</label>
        <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ex. Présentation d’un atelier IA" />
        <button
          className="btn btn-cyan"
          onClick={() => {
            if (!idea.trim()) return;
            setDb({
              ...db,
              videos: [
                {
                  id: uid("v"),
                  idea,
                  scenes: [
                    { id: uid("s"), title: "Accroche", narration: `Ouverture sur ${idea}. Une phrase, un plan.` },
                    { id: uid("s"), title: "Problème", narration: "Ce que l’utilisateur veut résoudre." },
                    { id: uid("s"), title: "Démonstration", narration: "L’application en action, une idée par plan." },
                    { id: uid("s"), title: "Conclusion", narration: "Rappel de la promesse et appel à tester." },
                  ],
                },
                ...db.videos,
              ],
            });
            flash("Scénario créé.");
            setIdea("");
          }}
        >
          Créer le scénario
        </button>
      </div>
      {db.videos.map((v) => (
        <div className="panel" key={v.id} style={{ marginTop: 12 }}>
          <div className="toolbar">
            <b>{v.idea}</b>
            <button className="danger" onClick={() => setDb({ ...db, videos: db.videos.filter((x) => x.id !== v.id) })}>
              Supprimer
            </button>
          </div>
          <div className="storyboard">
            {v.scenes.map((s, i) => (
              <div className={`shot hue-${i % 4} ${s.illustrated ? "on" : ""}`} key={s.id}>
                <em>Scène {i + 1}</em>
                <input
                  value={s.title}
                  onChange={(e) =>
                    setDb({
                      ...db,
                      videos: db.videos.map((x) =>
                        x.id === v.id ? { ...x, scenes: x.scenes.map((sc) => (sc.id === s.id ? { ...sc, title: e.target.value } : sc)) } : x
                      ),
                    })
                  }
                />
                <textarea
                  value={s.narration}
                  onChange={(e) =>
                    setDb({
                      ...db,
                      videos: db.videos.map((x) =>
                        x.id === v.id ? { ...x, scenes: x.scenes.map((sc) => (sc.id === s.id ? { ...sc, narration: e.target.value } : sc)) } : x
                      ),
                    })
                  }
                />
                <button
                  className="chip"
                  onClick={() => {
                    setDb({
                      ...db,
                      videos: db.videos.map((x) =>
                        x.id === v.id ? { ...x, scenes: x.scenes.map((sc) => (sc.id === s.id ? { ...sc, illustrated: !sc.illustrated } : sc)) } : x
                      ),
                    });
                  }}
                >
                  {s.illustrated ? "Illustrée" : "Illustrer"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!db.videos.length && <p className="muted">Aucun film pour le moment.</p>}
    </div>
  );
}

function AlertsView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const refresh = async (item: AlertItem) => {
    const hits = await searchClearnet(item.keyword);
    setDb((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === item.id
          ? { ...a, results: hits.map((h) => h.snippet || h.title), links: hits.map(({ title, url }) => ({ title, url })), updatedAt: Date.now() }
          : a
      ),
    }));
    flash("Veille mise à jour.");
  };
  return (
    <div>
      <PageHead title="Alertes" sub="Veille sur le web public (Wikipedia). Relancez pour rafraîchir les extraits." />
      <div className="panel">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l’alerte" />
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Mot-clé" />
        <button
          className="btn btn-cyan"
          onClick={async () => {
            if (!keyword.trim()) return;
            const item: AlertItem = { id: uid("al"), name: name || keyword, keyword, frequency: "daily", results: [] };
            setDb({ ...db, alerts: [item, ...db.alerts] });
            setName("");
            setKeyword("");
            await refresh(item);
          }}
        >
          Ajouter et rechercher
        </button>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {db.alerts.map((a) => (
          <div className="panel" key={a.id}>
            <div className="toolbar">
              <div>
                <b>{a.name}</b>
                <div className="muted">
                  {a.keyword}
                  {a.updatedAt ? ` · ${new Date(a.updatedAt).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="row-actions">
                <button className="chip" onClick={() => void refresh(a)}>
                  Actualiser
                </button>
                <button className="danger" onClick={() => setDb({ ...db, alerts: db.alerts.filter((x) => x.id !== a.id) })}>
                  Supprimer
                </button>
              </div>
            </div>
            {(a.links || []).map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.title}
              </a>
            ))}
            {a.results.map((r) => (
              <p className="muted" key={r}>
                {r}
              </p>
            ))}
          </div>
        ))}
        {!db.alerts.length && <div className="muted">Aucune alerte configurée.</div>}
      </div>
    </div>
  );
}

function SocialView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const accounts = db.socialAccounts || [];
  const posts = db.socialPosts || [];
  const [network, setNetwork] = useState<SocialNet>("tiktok");
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [caption, setCaption] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [media, setMedia] = useState<{ name: string; kind: "image" | "video"; url: string } | null>(null);
  const net = SOCIAL_NETWORKS.find((n) => n.id === network)!;

  const toggle = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const addAccount = () => {
    if (!handle.trim()) return flash("Indiquez le @ ou le nom de la page.");
    const acc = {
      id: uid("soc"),
      network,
      label: label.trim() || handle.trim(),
      handle: handle.trim().replace(/^@/, ""),
      connected: true,
    };
    const connectorName = SOCIAL_NETWORKS.find((n) => n.id === network)!.label;
    const hasConn = db.connectors.some((c) => c.name === connectorName);
    setDb({
      ...db,
      socialAccounts: [acc, ...accounts],
      connectors: hasConn
        ? db.connectors.map((c) => (c.name === connectorName ? { ...c, active: true } : c))
        : [{ id: uid("k"), kind: "app", name: connectorName, url: net.home, description: "Compte social", active: true }, ...db.connectors],
    });
    setHandle("");
    setLabel("");
    flash(`${connectorName} · @${acc.handle} ajouté.`);
  };

  const queue = () => {
    if (!picked.length) return flash("Cochez au moins un compte.");
    const item = {
      id: uid("post"),
      caption: caption.trim(),
      mediaName: media?.name,
      mediaKind: media?.kind,
      accountIds: picked,
      status: "file" as const,
      at: Date.now(),
    };
    setDb({ ...db, socialPosts: [item, ...posts] });
    flash(`File d’attente : ${picked.length} compte(s).`);
  };

  const openOfficial = (accountIds: string[], text: string, postId?: string) => {
    const targets = accounts.filter((a) => accountIds.includes(a.id));
    const nets = [...new Set(targets.map((a) => a.network))];
    for (const n of nets) {
      const spec = SOCIAL_NETWORKS.find((s) => s.id === n);
      if (!spec) continue;
      const url = n === "x" && text ? `https://x.com/compose/post?text=${encodeURIComponent(text.slice(0, 250))}` : spec.compose;
      window.open(url, "_blank", "noopener,noreferrer");
    }
    if (text) void navigator.clipboard.writeText(text);
    setDb((prev) => ({
      ...prev,
      socialPosts: (prev.socialPosts || []).map((p) => (postId ? (p.id === postId ? { ...p, status: "ouvert" } : p) : p)),
    }));
    flash("Studio officiel ouvert. Légende copiée — déposez la photo ou la vidéo dans chaque compte.");
  };

  return (
    <div>
      <PageHead
        title="Réseaux sociaux"
        sub="Plusieurs comptes par réseau. Les fichiers restent locaux : l’envoi passe par le studio officiel de chaque plateforme. Aucun mot de passe ici."
      />
      <div className="grid">
        {SOCIAL_NETWORKS.map((n) => {
          const nAcc = accounts.filter((a) => a.network === n.id);
          return (
            <div className="panel hover" key={n.id}>
              <h3>{n.label}</h3>
              <p className="muted">
                {nAcc.length} compte{nAcc.length > 1 ? "s" : ""} · {n.media}
              </p>
              <a href={n.compose} target="_blank" rel="noreferrer">
                Ouvrir {n.label}
              </a>
              <div className="list" style={{ marginTop: 8 }}>
                {nAcc.map((a) => (
                  <div className="item" key={a.id}>
                    <span>
                      {a.label} <span className="muted">@{a.handle}</span>
                    </span>
                    <button className="danger" onClick={() => setDb({ ...db, socialAccounts: accounts.filter((x) => x.id !== a.id), socialPosts: posts.map((p) => ({ ...p, accountIds: p.accountIds.filter((id) => id !== a.id) })) })}>
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>Ajouter un compte</h3>
          <label>Réseau</label>
          <select className="field" value={network} onChange={(e) => setNetwork(e.target.value as SocialNet)}>
            {SOCIAL_NETWORKS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <label>Nom affiché</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Page boutique" />
          <label>@ ou identifiant</label>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="ex. heuusss" />
          <button className="btn btn-cyan" onClick={addAccount}>
            Enregistrer le compte
          </button>
        </div>

        <div className="panel">
          <h3>Publier sur plusieurs comptes</h3>
          <label>Légende</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Texte commun à tous les comptes cochés…" />
          <label>Photo ou vidéo</label>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (media?.url) URL.revokeObjectURL(media.url);
              setMedia({ name: f.name, kind: f.type.startsWith("video") ? "video" : "image", url: URL.createObjectURL(f) });
            }}
          />
          {media && (
            <div className="media-preview">
              {media.kind === "video" ? <video src={media.url} controls /> : <img src={media.url} alt={media.name} />}
              <div className="muted">{media.name}</div>
            </div>
          )}
          <label>Comptes destinataires</label>
          <div className="account-pick">
            {accounts.map((a) => (
              <label key={a.id} className={picked.includes(a.id) ? "chip on" : "chip"}>
                <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} /> {SOCIAL_NETWORKS.find((n) => n.id === a.network)?.label} · @{a.handle}
              </label>
            ))}
            {!accounts.length && <p className="muted">Ajoutez d’abord un compte à gauche.</p>}
          </div>
          <div className="toolbar">
            <button className="btn btn-ghost" style={{ width: "auto", margin: 0 }} onClick={queue}>
              Mettre en file
            </button>
            <button className="btn btn-cyan" style={{ width: "auto", margin: 0 }} onClick={() => openOfficial(picked, caption)}>
              Ouvrir les studios officiels
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 18 }}>File d’attente</h3>
      <div className="list">
        {posts.map((p) => (
          <div className="item" key={p.id}>
            <div>
              <b>{p.mediaName || "Texte seul"}</b>
              <div className="muted">
                {p.caption || "Sans légende"} · {p.accountIds.length} compte(s) · {p.status}
              </div>
            </div>
            <div className="row-actions">
              <button className="chip" onClick={() => openOfficial(p.accountIds, p.caption, p.id)}>
                Envoyer
              </button>
              <button className="danger" onClick={() => setDb({ ...db, socialPosts: posts.filter((x) => x.id !== p.id) })}>
                Retirer
              </button>
            </div>
          </div>
        ))}
        {!posts.length && <p className="muted">Aucun envoi en file.</p>}
      </div>
    </div>
  );
}

function ShareView({ db }: { db: DB }) {
  const token = location.pathname.split("/partage/")[1] || "";
  const share = db.shares.find((s) => s.token === token);
  const project = db.projects.find((p) => p.id === share?.projectId);
  if (!share || !project) {
    return (
      <div className="panel">
        <h3>Lien de partage</h3>
        <p className="muted">Lien introuvable ou projet retiré. Créez un partage depuis Historique.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <h3>{project.name}</h3>
      <p className="muted">Lecture seule · jeton {share.token}</p>
      <p>{project.note || "Aucune note."}</p>
    </div>
  );
}
