import { useEffect, useState } from "react";
import { DEFAULT_LOOK, LANGUAGES, load, quoteInApp, quoteOfDay, resetDB, save, type DB, type Route, uid, validPassword } from "./store";
import { Workspace } from "./workspace";
import logoImg from "./logo.png";

const NAV: { to: Route; label: string }[] = [
  { to: "/", label: "Conversation" },
  { to: "/ia-personnelle", label: "IA personnelle" },
  { to: "/historique", label: "Historique" },
  { to: "/projets", label: "Projets" },
  { to: "/artefacts", label: "Artefacts" },
  { to: "/connecteurs", label: "Connecteurs" },
  { to: "/creer-application", label: "Créer une application" },
  { to: "/studio-video", label: "Studio vidéo" },
  { to: "/reseaux", label: "Réseaux sociaux" },
  { to: "/alertes", label: "Alertes" },
  { to: "/admin", label: "Administration" },
  { to: "/sav", label: "SAV" },
  { to: "/presentation", label: "Présentation" },
];

function pathToRoute(p: string): Route {
  if (p === "/reset-password") return "/reset-password";
  if (p.startsWith("/partage")) return "/partage";
  if (NAV.some((n) => n.to === p)) return p as Route;
  if (p === "/") return "/";
  return "/404";
}

export default function App() {
  const [db, setDb] = useState<DB>(() => load());
  const [route, setRoute] = useState<Route>(() => pathToRoute(location.pathname));
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("heuusssiakdi-theme") !== "light");
  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("heuusssiakdi-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => save(db), [db]);
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']") || document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    icon.href = logoImg;
    if (!icon.parentElement) document.head.appendChild(icon);
  }, []);
  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (to: Route, path?: string) => {
    history.pushState({}, "", path ?? to);
    setRoute(to);
    setMenu(false);
  };
  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2600);
  };

  const user = db.users.find((u) => u.id === db.sessionId);
  const quote = quoteOfDay();
  const quoteApp = quoteInApp();

  useEffect(() => {
    const report = (title: string, detail: string) => {
      const ticket = { id: uid("sav"), email: user?.email || "application", title, body: detail, at: Date.now(), status: "ouvert" as const };
      setDb((prev) => ({ ...prev, tickets: [ticket, ...(prev.tickets || [])].slice(0, 30) }));
      const text = `SAV automatique HeuusssIAKDi\n${title}\n\n${detail}`;
      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.src = `mailto:drive.ia01@outlook.com?subject=${encodeURIComponent("SAV auto " + title)}&body=${encodeURIComponent(text.slice(0, 1500))}`;
      document.body.appendChild(frame);
      window.setTimeout(() => frame.remove(), 1500);
      flash("Erreur envoyée au SAV.");
    };
    const onErr = (e: ErrorEvent) => report(e.message || "Erreur", `${e.filename || ""}:${e.lineno || 0}`);
    const onReject = (e: PromiseRejectionEvent) => report("Promesse refusée", String(e.reason || "inconnue"));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, [user?.email]);
  useEffect(() => {
    const mark = document.querySelector("script[type='module']")?.getAttribute("src") || "";
    const check = async () => {
      try {
        const html = await fetch("/?v=" + Date.now()).then((r) => r.text());
        const next = html.match(/script[^>]+src="([^"]+)"/)?.[1] || "";
        if (mark && next && next !== mark) flash("Mise à jour disponible. Rechargez l’application.");
      } catch {
        /* hors ligne */
      }
    };
    void check();
    const id = window.setInterval(check, 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (db.locked) {
    return (
      <>
        <LockView db={db} setDb={setDb} flash={flash} quote={quote} />
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    );
  }

  if (!user) {
    return (
      <>
        {route === "/reset-password" ? (
          <ResetView db={db} setDb={setDb} flash={flash} goHome={() => go("/")} />
        ) : (
          <AuthView db={db} setDb={setDb} flash={flash} go={go} quote={quote} dark={dark} setDark={setDark} />
        )}
        {toast ? <div className="toast">{toast}</div> : null}
      </>
    );
  }

  return (
    <div className="app">
      <aside className={menu ? "side open" : "side"}>
        <img src={logoImg} alt="HeuusssIAKDi" className="logo" style={{ width: 56, height: 56, margin: "0 0 8px" }} />
        <h2>HeuusssIAKDi2.0</h2>
        <div className="muted">Intelligence assistée</div>
        <div className="muted">{user.email}</div>
        <div className="muted">Compte {user.email === "drive.ia01@outlook.com" ? "prioritaire · admin · coordinatrice" : user.role === "master" ? "maître" : user.role === "admin" ? "admin" : "sécurisé"}</div>
        <nav className="nav">
          {NAV.filter((n) => (n.to !== "/admin" && n.to !== "/presentation") || user.role === "master" || user.role === "admin")
            .filter((n) => n.to === "/sav" || !user.modules?.length || user.modules.includes(n.to) || n.to === "/")
            .map((n) => (
            <button key={n.to} className={route === n.to ? "on" : ""} onClick={() => go(n.to)}>
              {n.label}
            </button>
          ))}
          <button onClick={() => setDark((v) => !v)}>{dark ? "Mode clair" : "Mode sombre"}</button>
          <button onClick={() => { setDb({ ...db, sessionId: undefined }); go("/"); }}>Se déconnecter</button>
          <button
            onClick={() => {
              const token = uid("rst");
              setDb({ ...db, sessionId: undefined, resetTokens: [...db.resetTokens, { email: user.email, token, exp: Date.now() + 30 * 60 * 1000 }] });
              go("/reset-password", `/reset-password?token=${token}`);
            }}
          >
            Changer le mot de passe
          </button>
          {(user.role === "master" || user.role === "admin") && (
            <button
              className="danger"
              onClick={() => {
                if (!window.confirm("Verrouiller l’application ? Personne ne pourra entrer tant que le compte maître n’aura pas rouvert.")) return;
                setDb({ ...db, locked: true, sessionId: undefined });
                flash("Application verrouillée.");
              }}
            >
              Verrouiller
            </button>
          )}
          {(user.role === "master" || user.role === "admin") && (
            <button
              onClick={async () => {
                const text = "Mise à jour HeuusssIAKDi2.0 disponible. Ouvrez https://heuusssiakdi.vercel.app puis rechargez la page pour installer la nouvelle version.";
                setDb({ ...db, tickets: [{ id: uid("maj"), email: "mise-a-jour", title: "Mise à jour envoyée", body: text, at: Date.now(), status: "ouvert" }, ...(db.tickets || [])] });
                try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
                if (navigator.share) { try { await navigator.share({ title: "Mise à jour HeuusssIAKDi", text }); } catch { /* ignore */ } }
                flash("Avis de mise à jour copié. Envoyez-le, puis chacun recharge l’application.");
              }}
            >
              Envoyer la mise à jour
            </button>
          )}
        </nav>
        <div className="side-meta">
          <div className="muted">Pensée du jour</div>
          <div className="muted">« {quoteApp.text} »</div>
          <div className="muted">{quoteApp.source}</div>
          <div className="muted">{db.conversations.filter((c) => !c.archived).length} conversations</div>
          <div className="muted">{db.apps.length} applications</div>
          <div className="muted">{db.connectors.filter((c) => c.active).length} accès actifs</div>
          <label className="muted">Langue</label>
          <select className="field" value={db.language} onChange={(e) => setDb({ ...db, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      </aside>
      <main className="main">
        <div className="mobile-bar">
          <button className="btn btn-ghost" style={{ width: "auto", margin: 0 }} onClick={() => setMenu((v) => !v)}>Menu</button>
          <b>HeuusssIAKDi2.0</b>
        </div>
        <div className="top-quote">
          <b>Dicton du jour</b> — « {quoteApp.text} »
          <div><small>{quoteApp.source}</small></div>
        </div>
        <Workspace route={route} db={db} setDb={setDb} flash={flash} go={go} />
        {user.role !== "user" && db.users.some((u) => u.pending) ? (
          <div className="toast" style={{ display: "block" }}>
            Nouveau profil en attente : {db.users.filter((u) => u.pending).map((u) => u.email).join(", ")}. Ouvrez Administration.
          </div>
        ) : null}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function LockView({ db, setDb, flash, quote }: { db: DB; setDb: (d: DB) => void; flash: (s: string) => void; quote: { text: string; source: string } }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const unlock = () => {
    const mail = email.trim().toLowerCase();
    const found = db.users.find((u) => u.email === mail && u.password === password && u.role === "master" && !u.suspended);
    if (!found) {
      setErr("Seul le compte maître peut rouvrir l’application.");
      return;
    }
    setDb({ ...db, locked: false, sessionId: found.id });
    flash("Application rouverte.");
  };
  return (
    <div className="page">
      <div className="top-quote">
        <b>Pensée du jour</b> — « {quote.text} »
        <div><small>{quote.source}</small></div>
      </div>
      <div className="auth-wrap">
        <div className="card">
          <img src={logoImg} className="logo" alt="Logo HeuusssIAKDi" />
          <div className="brand">ACCÈS BLOQUÉ</div>
          <h1>Application verrouillée</h1>
          <div className="sub">Aucune connexion n’est acceptée. Seul le compte maître peut rouvrir.</div>
          <label>E-mail maître</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="drive.ia01@outlook.com" />
          <label>Mot de passe maître</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err ? <div className="err">{err}</div> : null}
          <button className="btn btn-cyan" onClick={unlock}>Rouvrir</button>
        </div>
      </div>
    </div>
  );
}

function AuthView({ db, setDb, flash, go, quote, dark, setDark }: { db: DB; setDb: (d: DB) => void; flash: (s: string) => void; go: (r: Route, path?: string) => void; quote: { text: string; source: string }; dark: boolean; setDark: (v: boolean | ((b: boolean) => boolean)) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [slide, setSlide] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const look = { ...DEFAULT_LOOK, ...(db.look || {}) };
  useEffect(() => {
    const id = window.setInterval(() => setSlide((n) => (n + 1) % Math.max(1, look.slides.length)), 3500);
    return () => window.clearInterval(id);
  }, [look.slides.length]);

  const submit = () => {
    setErr("");
    const mail = email.trim().toLowerCase();
    if (mode === "forgot") {
      const token = uid("rst");
      setDb({ ...db, resetTokens: [...db.resetTokens, { email: mail, token, exp: Date.now() + 30 * 60 * 1000 }] });
      flash("Choisissez le nouveau mot de passe.");
      go("/reset-password", `/reset-password?token=${token}`);
      return;
    }
    if (mode === "register") {
      if (!validPassword(password)) { setErr("Utilisez au moins 10 caractères avec une lettre et un chiffre."); return; }
      if (db.users.some((u) => u.email === mail)) { setErr("Un compte existe déjà."); return; }
      const user = { id: uid("u"), name: name || mail.split("@")[0], email: mail, password, role: "user" as const, pending: true };
      setDb({ ...db, users: [...db.users, user] });
      flash("Compte créé. Un administrateur doit autoriser l’accès avant connexion.");
      setMode("login");
      return;
    }
    const found = db.users.find((u) => u.email === mail && u.password === password);
    if (!found || found.suspended) { setErr("Identifiants invalides ou compte suspendu."); return; }
    if (found.pending) { setErr("Compte en attente d’autorisation administrateur."); return; }
    if (found.accessUntil && found.accessUntil < Date.now()) { setErr("Accès expiré. Demandez une nouvelle autorisation."); return; }
    setDb({ ...db, sessionId: found.id });
  };

  return (
    <div className="page">
      <div className="top-quote">
        <b>Pensée du jour</b> — « {quote.text} »
        <div><small>{quote.source}</small></div>
      </div>
      <label className="lang">
        <span className="muted">Langue</span>
        <select value={db.language} onChange={(e) => setDb({ ...db, language: e.target.value })}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
        </select>
        <button type="button" onClick={() => setDark((v) => !v)}>{dark ? "Mode clair" : "Mode sombre"}</button>
      </label>
      <div className="auth-wrap" style={{ fontFamily: look.font, background: look.background }}>
        <div className="card">
          <img src={logoImg} className="logo" alt="Logo HeuusssIAKDi — gants de boxe vintage" style={{ width: look.logoSize, height: look.logoSize }} />
          <div className="brand" style={{ color: look.color, fontSize: look.titleSize }}>{look.title}</div>
          <h1>{look.subtitle}</h1>
          <div className="sub">{look.slides[slide % look.slides.length]}</div>
          <div className="panel">
            <b>{look.quizQ}</b>
            {look.quiz.map((q, i) => (
              <button key={q} className="chip" onClick={() => setPicked(i)}>{q}</button>
            ))}
            {picked != null ? <div className="muted">{picked === look.quizOk ? "Bonne réponse." : "À revoir."}</div> : null}
          </div>
          {mode !== "forgot" && (
            <div className="tabs">
              <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Se connecter</button>
              <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Créer un compte</button>
            </div>
          )}
          {mode === "register" && (<><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" /></>)}
          <label>Adresse e-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="drive.ia01@outlook.com" />
          {mode !== "forgot" && (
            <>
              <label>Mot de passe</label>
              <div className="row-pass">
                <input type={show ? "text" : "password"} value={password} minLength={10} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 10 caractères" />
                <button type="button" onClick={() => setShow((s) => !s)}>{show ? "Masquer" : "Afficher"}</button>
              </div>
            </>
          )}
          {err ? <div className="err">{err}</div> : null}
          <button className="btn btn-cyan" onClick={submit}>{mode === "forgot" ? "Envoyer le lien" : mode === "register" ? "Créer un compte" : "Se connecter"}</button>
          {mode === "login" && <button className="link" onClick={() => setMode("forgot")}>Mot de passe oublié ?</button>}
          {mode === "forgot" && <button className="link" onClick={() => setMode("login")}>Retour à la connexion</button>}
          <button
            className="link"
            onClick={() => {
              if (!window.confirm("Effacer tous les profils et données locales, puis recommencer ?")) return;
              setDb(resetDB());
              flash("Espace réinitialisé. Créez un nouveau profil.");
              setMode("register");
            }}
          >
            Recommencer — nouveaux profils
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetView({ db, setDb, flash, goHome }: { db: DB; setDb: (d: DB) => void; flash: (s: string) => void; goHome: () => void }) {
  const token = new URLSearchParams(location.search).get("token") || "";
  const rec = db.resetTokens.find((t) => t.token === token && t.exp > Date.now());
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  if (!rec) {
    return <div className="auth-wrap"><div className="card"><h1>Sécurité du compte</h1><p className="sub">Lien expiré ou invalide.</p><button className="btn btn-cyan" onClick={goHome}>Retour à l’accueil</button></div></div>;
  }
  return (
    <div className="auth-wrap">
      <div className="card">
        <h1>Nouveau mot de passe</h1>
        <p className="sub">Au moins 10 caractères, une lettre et un chiffre.</p>
        <label>Nouveau mot de passe</label>
        <input type="password" value={a} onChange={(e) => setA(e.target.value)} />
        <label>Confirmer le mot de passe</label>
        <input type="password" value={b} onChange={(e) => setB(e.target.value)} />
        <button className="btn btn-cyan" onClick={() => {
          if (a !== b) return flash("Les deux mots de passe doivent être identiques.");
          if (!validPassword(a)) return flash("Mot de passe trop faible.");
          setDb({ ...db, users: db.users.map((u) => (u.email === rec.email ? { ...u, password: a } : u)), resetTokens: db.resetTokens.filter((t) => t.token !== token) });
          flash("Votre nouveau mot de passe est actif.");
          goHome();
        }}>Enregistrer le nouveau mot de passe</button>
      </div>
    </div>
  );
}
