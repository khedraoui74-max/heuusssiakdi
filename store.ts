export type Role = "user" | "admin" | "master";
export type Route =
  | "/"
  | "/reset-password"
  | "/artefacts"
  | "/connecteurs"
  | "/creer-application"
  | "/ia-personnelle"
  | "/historique"
  | "/projets"
  | "/studio-video"
  | "/alertes"
  | "/reseaux"
  | "/admin"
  | "/partage"
  | "/404";

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  suspended?: boolean;
  pending?: boolean;
};

export type Message = { id: string; role: "user" | "assistant"; content: string; at: number };
export type WorkFile = { path: string; language: string; content: string };
export type TraceStep = {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "run" | "done" | "blocked";
  kind: "think" | "search" | "code" | "tool" | "policy" | "model";
  links?: { title: string; url: string }[];
};
export type Conversation = {
  id: string;
  title: string;
  archived?: boolean;
  projectId?: string;
  model: string;
  webSearch?: boolean;
  messages: Message[];
  trace?: TraceStep[];
  files?: WorkFile[];
};
export type Project = { id: string; name: string; archived?: boolean; note?: string };
export type RequestItem = { id: string; projectId?: string; text: string; status: "ouverte" | "terminée"; at: number };
export type Artifact = { id: string; kind: "link" | "text" | "file"; name: string; url?: string; description?: string };
export type Connector = { id: string; kind: "api" | "mcp" | "app"; name: string; url?: string; description?: string; active: boolean };
export type AlertItem = {
  id: string;
  name: string;
  keyword: string;
  frequency: "daily" | "frequent";
  results: string[];
  links?: { title: string; url: string }[];
  updatedAt?: number;
};
export type AppSpec = {
  id: string;
  name: string;
  problem: string;
  spec?: string;
  files?: string[];
  workFiles?: WorkFile[];
  kind?: string;
};
export type VideoProject = { id: string; idea: string; scenes: { id: string; title: string; narration: string; illustrated?: boolean }[] };
export type PromptItem = { id: string; folder: string; title: string; body: string };
export type Share = { token: string; projectId: string; canEdit: boolean };
export type SocialNet = "tiktok" | "instagram" | "youtube" | "facebook" | "x";
export type SocialAccount = {
  id: string;
  network: SocialNet;
  label: string;
  handle: string;
  connected: boolean;
};
export type SocialPost = {
  id: string;
  caption: string;
  mediaName?: string;
  mediaKind?: "image" | "video";
  accountIds: string[];
  status: "brouillon" | "file" | "ouvert";
  at: number;
};

export type DB = {
  users: User[];
  sessionId?: string;
  conversations: Conversation[];
  projects: Project[];
  requests: RequestItem[];
  artifacts: Artifact[];
  connectors: Connector[];
  alerts: AlertItem[];
  apps: AppSpec[];
  videos: VideoProject[];
  prompts: PromptItem[];
  shares: Share[];
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
  language: string;
  locked?: boolean;
  resetTokens: { email: string; token: string; exp: number }[];
};

const KEY = "heuusssiakdi-db-v3";

export function resetDB(): DB {
  return JSON.parse(JSON.stringify(seed)) as DB;
}

export const PRIORITY_ADMIN = "drive.ia01@outlook.com";

const seed: DB = {
  users: [
    {
      id: "master-1",
      name: "Administratrice",
      email: PRIORITY_ADMIN,
      password: "Heuusss01$",
      role: "master",
      pending: false,
    },
  ],
  conversations: [],
  projects: [],
  requests: [],
  artifacts: [],
  connectors: [],
  alerts: [],
  apps: [],
  videos: [],
  prompts: [],
  shares: [],
  socialAccounts: [],
  socialPosts: [],
  language: "fr",
  resetTokens: [],
};

export function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(seed);
    const parsed = JSON.parse(raw);
    const saved = (parsed.users || []).find((u) => u.email === PRIORITY_ADMIN);
    const only = {
      id: "master-1",
      name: "Administratrice",
      email: PRIORITY_ADMIN,
      password: saved?.password || "Heuusss01$",
      role: "master" as const,
      pending: false,
      suspended: false,
    };
    return {
      ...structuredClone(seed),
      ...parsed,
      users: [only],
      sessionId: parsed.sessionId === "master-1" ? "master-1" : undefined,
      socialAccounts: parsed.socialAccounts ?? [],
      socialPosts: parsed.socialPosts ?? [],
    };
  } catch {
    return structuredClone(seed);
  }
}

export function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function validPassword(p: string) {
  return p.length >= 10 && p.length <= 128 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

export const MODELS = {
  local: { label: "Atelier local", description: "Planification + génération de programmes hors ligne, toujours disponible." },
  qwen27: { label: "Qwen 27", description: "Voie interne rapide pour les échanges courants." },
  blockia: { label: "BlockIA", description: "Voie structurée, utile pour spécifier une application." },
  groq: { label: "Groq gratuit", description: "llama-3.1-8b-instant — clé gratuite sur groq.com." },
  openrouter: { label: "OpenRouter :free", description: "Modèles gratuits du catalogue si une clé est enregistrée." },
  hf: { label: "Hugging Face", description: "Inference Router — jeton gratuit hf.co." },
} as const;

export const QUOTES = [
  { text: "Apprendre sans réfléchir est vain ; réfléchir sans apprendre est dangereux.", source: "Confucius — Entretiens (Lúnyǔ)" },
  { text: "Celui qui pose une question est ignorant un instant ; celui qui ne pose pas de question reste ignorant longtemps.", source: "Confucius — attribution traditionnelle" },
  { text: "Exige beaucoup de toi-même et attends peu des autres.", source: "Confucius — attribution traditionnelle" },
  { text: "La vraie connaissance est de connaître l’étendue de son ignorance.", source: "Confucius — Entretiens" },
  { text: "La victoire la plus haute est de vaincre sans combattre.", source: "Sūn Zǐ — L’Art de la guerre" },
  { text: "Connais l’autre et connais-toi : cent batailles, cent issues." , source: "Sūn Zǐ — L’Art de la guerre" },
  { text: "Le bon général prépare le terrain avant d’engager la force.", source: "Sūn Zǐ — L’Art de la guerre" },
  { text: "Agir au bon moment vaut mieux que multiplier les efforts sans direction.", source: "Sūn Zǐ — L’Art de la guerre" },
  { text: "Allah n’impose à aucune âme une charge supérieure à sa capacité.", source: "Le Coran — sourate 2, Al-Baqara 286 (sens)" },
  { text: "En vérité, avec la difficulté est une facilité.", source: "Le Coran — sourate 94, Ash-Sharh 5–6 (sens)" },
  { text: "Dieu est avec ceux qui sont patients.", source: "Le Coran — sourate 2, Al-Baqara 153 (sens)" },
  { text: "Traite les autres comme tu voudrais qu’on te traite.", source: "La Bible — Matthieu 7,12" },
  { text: "Que ta parole soit oui, oui ; non, non.", source: "La Bible — Matthieu 5,37" },
  { text: "La lumière luit dans les ténèbres.", source: "La Bible — Jean 1,5" },
  { text: "Aime ton prochain comme toi-même.", source: "La Bible — Lévitique 19,18 / Matthieu 22,39" },
  { text: "Justice, justice tu poursuivras.", source: "La Torah — Deutéronome 16,20" },
  { text: "Aime l’étranger, car vous avez été étrangers au pays d’Égypte.", source: "La Torah — Deutéronome 10,19" },
  { text: "Ce n’est pas à toi d’achever la tâche, mais tu n’es pas libre de t’en détourner.", source: "La Torah — Pirkei Avot 2,16 (tradition)" },
  { text: "La haine ne cesse par la haine ; la haine cesse par l’absence de haine.", source: "Tripitaka — Dhammapada 5" },
  { text: "Mieux vaut un seul mot de sagesse que mille paroles vides.", source: "Tripitaka — Dhammapada 100" },
  { text: "Sois une lampe pour toi-même.", source: "Tripitaka — Mahāparinibbāna Sutta" },
];

export function quoteOfDay(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  return QUOTES[day % QUOTES.length];
}

export function quoteInApp(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  const login = QUOTES[day % QUOTES.length];
  const other = QUOTES.find((q, i) => i !== day % QUOTES.length && q.source.split("—")[0].trim() !== login.source.split("—")[0].trim());
  return other || QUOTES[(day + 7) % QUOTES.length];
}

export const LANGUAGES = [
  { code: "fr", label: "Français", nativeName: "Français" },
  { code: "en", label: "English", nativeName: "English" },
  { code: "ar", label: "Arabe standard", nativeName: "العربية" },
  { code: "ar-PS", label: "Arabe palestinien", nativeName: "العربية الفلسطينية" },
  { code: "es", label: "Español", nativeName: "Español" },
  { code: "de", label: "Allemand", nativeName: "Deutsch" },
  { code: "it", label: "Italien", nativeName: "Italiano" },
  { code: "pt", label: "Portugais", nativeName: "Português" },
  { code: "nl", label: "Néerlandais", nativeName: "Nederlands" },
  { code: "tr", label: "Turc", nativeName: "Türkçe" },
  { code: "ru", label: "Russe", nativeName: "Русский" },
  { code: "zh", label: "Chinois", nativeName: "中文" },
  { code: "ja", label: "Japonais", nativeName: "日本語" },
  { code: "ko", label: "Coréen", nativeName: "한국어" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी" },
];

export const ACCESS_CATALOG = [
  { name: "Atelier local", kind: "api" as const, url: "", description: "Générateur de programmes et journal de recherche, sans clé." },
  { name: "Web mondial", kind: "api" as const, url: "https://duckduckgo.com", description: "Recherche indexée : Google, Bing, DuckDuckGo, actualités, GitHub." },
  { name: "Groq", kind: "api" as const, url: "https://console.groq.com", description: "Modèles gratuits (clé personnelle, jamais dans le chat)." },
  { name: "OpenRouter", kind: "api" as const, url: "https://openrouter.ai", description: "Catalogue :free (clé personnelle)." },
  { name: "Hugging Face", kind: "api" as const, url: "https://huggingface.co", description: "Inference Router gratuit avec jeton." },
  { name: "GitHub", kind: "app" as const, url: "https://github.com", description: "Dépôts publics et allowlist." },
  { name: "Vercel", kind: "app" as const, url: "https://vercel.com", description: "Publication de l’application." },
  { name: "Netlify", kind: "app" as const, url: "https://netlify.com", description: "Publication alternative." },
  { name: "Notion", kind: "app" as const, url: "https://notion.so", description: "Notes et bases comme documents de référence." },
  { name: "Gmail", kind: "app" as const, url: "https://gmail.com", description: "Veille mail — jamais de mot de passe dans le chat." },
  { name: "Google Drive", kind: "app" as const, url: "https://drive.google.com", description: "Fichiers de référence privés." },
  { name: "Outlook", kind: "app" as const, url: "https://outlook.com", description: "Messagerie professionnelle." },
  { name: "Figma", kind: "app" as const, url: "https://figma.com", description: "Maquettes pour le générateur d’apps." },
  { name: "Canva", kind: "app" as const, url: "https://canva.com", description: "Visuels pour le studio." },
  { name: "MDN", kind: "app" as const, url: "https://developer.mozilla.org/fr/", description: "Référence programmation web." },
  { name: "TikTok", kind: "app" as const, url: "https://www.tiktok.com/upload", description: "Comptes multiples · ouverture du studio officiel." },
  { name: "Instagram", kind: "app" as const, url: "https://www.instagram.com/", description: "Comptes multiples · publication photo / reel via le studio Meta." },
  { name: "YouTube", kind: "app" as const, url: "https://studio.youtube.com", description: "Comptes / chaînes multiples · upload officiel." },
  { name: "Facebook", kind: "app" as const, url: "https://www.facebook.com/", description: "Pages et profils · composer officiel." },
  { name: "X", kind: "app" as const, url: "https://x.com/compose/post", description: "Comptes multiples · composer officiel X." },
  { name: "MCP personnalisé", kind: "mcp" as const, url: "", description: "Serveur MCP déclaré sans secret dans la fiche." },
];

export const SOCIAL_NETWORKS: {
  id: SocialNet;
  label: string;
  compose: string;
  home: string;
  media: string;
}[] = [
  { id: "tiktok", label: "TikTok", compose: "https://www.tiktok.com/upload", home: "https://www.tiktok.com/", media: "vidéo" },
  { id: "instagram", label: "Instagram", compose: "https://www.instagram.com/", home: "https://www.instagram.com/", media: "photo ou reel" },
  { id: "youtube", label: "YouTube", compose: "https://studio.youtube.com", home: "https://www.youtube.com/", media: "vidéo" },
  { id: "facebook", label: "Facebook", compose: "https://www.facebook.com/", home: "https://www.facebook.com/", media: "photo ou vidéo" },
  { id: "x", label: "X", compose: "https://x.com/compose/post", home: "https://x.com/", media: "photo ou vidéo" },
];

export function assistantReply(text: string, model: string, web: boolean) {
  const tone =
    model === "blockia"
      ? "Je structure la réponse avec soin."
      : model === "openrouter"
        ? "Catalogue OpenRouter : réponse générée localement en attendant la clé serveur."
        : "Réponse directe.";
  const search = web ? " Recherche web activée : sources à vérifier côté serveur." : "";
  return `${tone}${search}\n\nVous avez demandé : « ${text} ».\n\nHeuusssIAKDi2.0 reprend votre espace privé : conversation, projets, artefacts, alertes, studio et générateur. Les actions sensibles restent confirmées avant publication.`;
}
