import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ACCESS_CATALOG,
  DEFAULT_LOOK,
  MODELS,
  SOCIAL_NETWORKS,
  type AlertItem,
  type Artifact,
  type Conversation,
  type DB,
  type Role,
  type Route,
  type SocialNet,
  type WorkFile,
  uid,
} from "./store";
import {
  APP_TEMPLATES,
  detectKind,
  generateProgram,
  loadExtras,
  loadKeys,
  previewHtml,
  runEngine,
  saveExtras,
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
  if (route === "/projets") return <ProjectsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/artefacts") return <ArtifactsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/connecteurs") return <ConnectorsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/creer-application") return <BuilderView db={db} setDb={setDb} flash={flash} />;
  if (route === "/studio-video") return <VideoView db={db} setDb={setDb} flash={flash} />;
  if (route === "/reseaux") return <SocialView db={db} setDb={setDb} flash={flash} />;
  if (route === "/alertes") return <AlertsView db={db} setDb={setDb} flash={flash} />;
  if (route === "/admin") return <AdminView db={db} setDb={setDb} flash={flash} />;
  if (route === "/sav") return <SavView db={db} setDb={setDb} flash={flash} />;
  if (route === "/android") return <AndroidView />;
  if (route === "/presentation") return <LookView db={db} setDb={setDb} flash={flash} />;
  if (route === "/partage") return <ShareView db={db} />;
  return <div className="panel">L’espace n’a pas pu être affiché. Vous pouvez réessayer ou revenir à l’accueil.</div>;
}


function SavView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const me = db.users.find((u) => u.id === db.sessionId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const tickets = db.tickets || [];
  const mine = me?.role === "master" || me?.role === "admin" ? tickets : tickets.filter((t) => t.email === me?.email);
  return (
    <div>
      <PageHead title="SAV" sub="Signalez un problème de l’application. Le message part vers drive.ia01@outlook.com et reste dans Administration." />
      <div className="panel">
        <label>Sujet</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ce qui ne marche pas" />
        <label>Problème</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Décrivez l’écran, le bouton et ce que vous attendiez." />
        <button
          className="btn btn-cyan"
          onClick={() => {
            if (!title.trim() || !body.trim()) return flash("Sujet et description requis.");
            const ticket = { id: uid("sav"), email: me?.email || "inconnu", title: title.trim(), body: body.trim(), at: Date.now(), status: "ouvert" as const };
            setDb({ ...db, tickets: [ticket, ...tickets] });
            const text = `SAV HeuusssIAKDi\nDe : ${ticket.email}\n${ticket.title}\n\n${ticket.body}`;
            location.href = `mailto:drive.ia01@outlook.com?subject=${encodeURIComponent("SAV " + ticket.title)}&body=${encodeURIComponent(text)}`;
            flash("Problème enregistré. Le mail SAV s’ouvre.");
            setTitle("");
            setBody("");
          }}
        >
          Envoyer au SAV
        </button>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {mine.map((t) => (
          <div className="panel" key={t.id}>
            <b>{t.title}</b>
            <div className="muted">{t.email} · {new Date(t.at).toLocaleString()} · {t.status}</div>
            <p>{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const me = db.users.find((u) => u.id === db.sessionId);
  const [mail, setMail] = useState("");
  const [pass, setPass] = useState("");
  const [days, setDays] = useState("30");
  const [mods, setMods] = useState<string[]>(["/", "/projets"]);
  const choices = ["/", "/historique", "/projets", "/artefacts", "/connecteurs", "/ia-personnelle", "/creer-application", "/reseaux", "/alertes", "/studio-video", "/android", "/sav"];
  if (!me || (me.role !== "master" && me.role !== "admin")) {
    return <div className="panel">Accès réservé aux administrateurs.</div>;
  }
  const setUser = (id: string, patch: Partial<(typeof db.users)[0]>) => {
    setDb({ ...db, users: db.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  };
  const pending = db.users.filter((u) => u.pending);
  return (
    <div>
      <PageHead title="Administration" sub="Alerte à chaque profil en attente. Envoyez un accès avec la durée et les pages que vous choisissez." />
      {pending.length ? (
        <div className="panel">
          <b>Nouveau profil</b>
          <p>{pending.map((u) => u.email).join(", ")} attend votre autorisation.</p>
        </div>
      ) : null}
      <div className="panel">
        <h3>Envoyer un accès</h3>
        <label>E-mail</label>
        <input value={mail} onChange={(e) => setMail(e.target.value)} placeholder="personne@exemple.com" />
        <label>Mot de passe provisoire</label>
        <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="10 caractères, lettre et chiffre" />
        <label>Durée en jours</label>
        <input value={days} onChange={(e) => setDays(e.target.value)} />
        <div className="toolbar">
          <button className="chip" onClick={() => setMods(choices)}>Toutes les habilitations</button>
          {choices.map((c) => (
            <label key={c} className="chip">
              <input
                type="checkbox"
                checked={mods.includes(c)}
                onChange={(e) => setMods(e.target.checked ? [...mods, c] : mods.filter((x) => x !== c))}
              />{" "}
              {c === "/" ? "Conversation" : c.slice(1)}
            </label>
          ))}
        </div>
        <button
          className="btn btn-cyan"
          onClick={async () => {
            const email = mail.trim().toLowerCase();
            if (!email || pass.length < 10) return flash("E-mail et mot de passe d’au moins 10 caractères.");
            const accessUntil = Date.now() + Math.max(1, Number(days) || 30) * 86400000;
            const user = { id: uid("u"), name: email.split("@")[0], email, password: pass, role: "user" as const, pending: false, accessUntil, modules: mods };
            setDb({ ...db, users: [user, ...db.users.filter((u) => u.email !== email)] });
            const text = `Accès HeuusssIAKDi\nhttps://heuusssiakdi.vercel.app\n${email}\nMot de passe : ${pass}\nJusqu’au ${new Date(accessUntil).toLocaleDateString()}\nPages : ${mods.join(", ")}`;
            try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
            if (navigator.share) { try { await navigator.share({ title: "Accès HeuusssIAKDi", text }); } catch { /* ignore */ } }
            flash("Accès créé et texte copié. Envoyez-le à la personne.");
            setMail("");
            setPass("");
          }}
        >
          Créer et envoyer l’accès
        </button>
      </div>
      <div className="list">
        {db.users.map((u) => (
          <div className="panel" key={u.id}>
            <b>{u.name}</b>
            <div className="muted">{u.email} · {u.role}{u.pending ? " · en attente" : ""}{u.suspended ? " · suspendu" : ""}{u.accessUntil ? ` · jusqu’au ${new Date(u.accessUntil).toLocaleDateString()}` : ""}</div>
            <div className="toolbar" style={{ marginTop: 8 }}>
              {u.pending ? (
                <button className="btn btn-cyan" onClick={() => { setUser(u.id, { pending: false }); flash("Accès autorisé."); }}>
                  Autoriser
                </button>
              ) : null}
              {u.role !== "master" ? (
                <button className="chip" onClick={() => { setUser(u.id, { suspended: !u.suspended }); flash(u.suspended ? "Compte réactivé." : "Compte suspendu."); }}>
                  {u.suspended ? "Réactiver" : "Suspendre"}
                </button>
              ) : null}
              {me.role === "master" && u.id !== me.id && u.role !== "master" ? (
                <select
                  value={u.role}
                  onChange={(e) => setUser(u.id, { role: e.target.value as Role, pending: false })}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ProjectsView({ db, setDb, flash }: { db: DB; setDb: Dispatch<SetStateAction<DB>>; flash: (s: string) => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [pid, setPid] = useState(db.projects[0]?.id || "");
  const [withKeys, setWithKeys] = useState(false);
  const project = db.projects.find((p) => p.id === pid) || db.projects[0];

  const packOf = (p = project) => {
    if (!p) return null;
    const conversations = db.conversations.filter((c) => c.projectId === p.id);
    const apps = db.apps.filter((a) => conversations.some((c) => (c.files || []).some((f) => (a.files || []).includes(f.path))) || true);
    return {
      kind: "heuusssiakdi-pack",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: p,
      conversations: db.conversations.filter((c) => !p || c.projectId === p.id || conversations.length === 0),
      apps: db.apps,
      artifacts: db.artifacts,
      connectors: db.connectors,
      keys: withKeys ? loadKeys() : undefined,
    };
  };

  const exportPack = () => {
    const pack = packOf();
    if (!pack) return flash("Créez d’abord un projet.");
    downloadJson(`${(project?.name || "projet").replace(/\s+/g, "-")}.heuusss.json`, pack);
    flash("Pack téléchargé (code, artefacts, connecteurs" + (withKeys ? ", clés" : "") + ").");
  };

  const sendPack = async () => {
    const pack = packOf();
    if (!pack) return flash("Créez d’abord un projet.");
    const text = JSON.stringify(pack, null, 2);
    try {
      if (navigator.share) {
        const file = new File([text], `${project?.name || "projet"}.heuusss.json`, { type: "application/json" });
        await navigator.share({ title: project?.name, files: [file], text: project?.name });
        flash("Partage ouvert.");
        return;
      }
    } catch {
      /* repli */
    }
    await navigator.clipboard?.writeText(text);
    downloadJson(`${(project?.name || "projet").replace(/\s+/g, "-")}.heuusss.json`, pack);
    flash("Pack copié et téléchargé — envoyez le fichier .json.");
  };

  return (
    <div>
      <PageHead title="Projets" sub="Enregistrer ou envoyer le lot : conversations, code, artefacts, connecteurs et, si vous le cochez, les clés IA." />
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
              if (!name.trim()) return flash("Ajoutez un nom.");
              const created = { id: uid("p"), name: name.trim(), note: note.trim() };
              setDb({ ...db, projects: [created, ...db.projects] });
              setPid(created.id);
              setName("");
              setNote("");
              flash("Projet créé.");
            }}
          >
            Créer
          </button>
        </div>
        <div className="panel">
          <h3>Pack à enregistrer / envoyer</h3>
          <label>Projet</label>
          <select className="field" value={project?.id || ""} onChange={(e) => setPid(e.target.value)}>
            {db.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label className="muted">
            <input type="checkbox" checked={withKeys} onChange={(e) => setWithKeys(e.target.checked)} /> Inclure les clés IA (fichier privé, ne pas publier)
          </label>
          <div className="toolbar">
            <button className="btn btn-cyan" onClick={exportPack}>Enregistrer le pack</button>
            <button className="btn btn-ghost" onClick={() => void sendPack()}>Envoyer le pack</button>
          </div>
          <p className="muted">Le fichier .heuusss.json contient le projet, le code généré, les artefacts et les connecteurs.</p>
          <label>Importer un pack</label>
          <input
            type="file"
            accept=".json,.heuusss.json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const pack = JSON.parse(await file.text());
                if (pack?.kind !== "heuusssiakdi-pack") return flash("Fichier non reconnu.");
                setDb({
                  ...db,
                  projects: pack.project ? [pack.project, ...db.projects.filter((p) => p.id !== pack.project.id)] : db.projects,
                  conversations: [...(pack.conversations || []), ...db.conversations],
                  apps: [...(pack.apps || []), ...db.apps],
                  artifacts: [...(pack.artifacts || []), ...db.artifacts],
                  connectors: [...(pack.connectors || []), ...db.connectors],
                });
                if (pack.keys) saveKeys({ ...loadKeys(), ...pack.keys });
                flash("Pack importé.");
              } catch {
                flash("Import impossible.");
              }
            }}
          />
        </div>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {db.projects.map((p) => (
          <div className="panel" key={p.id}>
            <b>{p.name}</b>
            <div className="muted">{p.note || "Sans note."}</div>
            <div className="toolbar">
              <button className="chip" onClick={() => { setPid(p.id); exportPack(); }}>Enregistrer</button>
              <button className="danger" onClick={() => setDb({ ...db, projects: db.projects.filter((x) => x.id !== p.id) })}>Retirer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
