import { useEffect, useState } from "react";
import { LANGUAGES, load, quoteOfDay, resetDB, save, type DB, type Route, uid, validPassword } from "./store";
import { Workspace } from "./workspace";
import logoImg from "./logo.png";

const NAV: { to: Route; label: string }[] = [
  { to: "/", label: "Conversation" },
  { to: "/ia-personnelle", label: "IA personnelle" },
  { to: "/historique", label: "Historique" },
  { to: "/artefacts", label: "Artefacts" },
  { to: "/connecteurs", label: "Connecteurs" },
  { to: "/creer-application", label: "Créer une application" },
  { to: "/studio-video", label: "Studio vidéo" },
  { to: "/reseaux", label: "Réseaux sociaux" },
  { to: "/alertes", label: "Alertes" },
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

  useEffect(() => save(db), [db]);
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

  if (!user) {
    return (
      <>
        {route === "/reset-password" ? (
          <ResetView db={db} setDb={setDb} flash={flash} goHome={() => go("/")} />
        ) : (
          <AuthView db={db} setDb={setDb} flash={flash} go={go} quote={quote} />
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
        <div className="muted">Compte {user.role === "master" ? "maître" : "sécurisé"}</div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.to} className={route === n.to ? "on" : ""} onClick={() => go(n.to)}>
              {n.label}
            </button>
          ))}
          <button onClick={() => { setDb({ ...db, sessionId: undefined }); go("/"); }}>Se déconnecter</button>
        </nav>
        <div className="side-meta">
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
        <Workspace route={route} db={db} setDb={setDb} flash={flash} go={go} />
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function AuthView({ db, setDb, flash, go, quote }: { db: DB; setDb: (d: DB) => void; flash: (s: string) => void; go: (r: Route) => void; quote: { text: string; source: string } }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    const mail = email.trim().toLowerCase();
    if (mode === "forgot") {
      const token = uid("rst");
      setDb({ ...db, resetTokens: [...db.resetTokens, { email: mail, token, exp: Date.now() + 30 * 60 * 1000 }] });
      flash("Si l’adresse correspond à un compte, un lien valable 30 minutes a été créé.");
      history.pushState({}, "", `/reset-password?token=${token}`);
      go("/reset-password");
      return;
    }
    if (mode === "register") {
      if (!validPassword(password)) { setErr("Utilisez au moins 10 caractères avec une lettre et un chiffre."); return; }
      if (db.users.some((u) => u.email === mail)) { setErr("Un compte existe déjà."); return; }
      const user = { id: uid("u"), name: name || mail.split("@")[0], email: mail, password, role: "user" as const };
      setDb({ ...db, users: [...db.users, user], sessionId: user.id });
      return;
    }
    const found = db.users.find((u) => u.email === mail && u.password === password);
    if (!found || found.suspended) { setErr("Identifiants invalides ou compte suspendu."); return; }
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
      </label>
      <div className="auth-wrap">
        <div className="card">
          <img src={logoImg} className="logo" alt="Logo HeuusssIAKDi — gants de boxe vintage" />
          <div className="brand">HEUUSSSIAKDI2.0</div>
          <h1>Conversation assistée</h1>
          <div className="sub">Historique sécurisé</div>
          {mode !== "forgot" && (
            <div className="tabs">
              <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Se connecter</button>
              <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Créer un compte</button>
            </div>
          )}
          {mode === "register" && (<><label>Nom</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" /></>)}
          <label>Adresse e-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
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
          <div className="or">ou</div>
          <button className="btn btn-ghost" onClick={() => { const master = db.users.find((u) => u.role === "master") ?? db.users[0]; setDb({ ...db, sessionId: master.id }); }}>Utiliser Manus</button>
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
