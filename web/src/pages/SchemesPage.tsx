import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  GOV_SCHEME_CATEGORIES,
  GOV_SCHEMES,
  formatSchemeDeadline,
  getGovSchemeById,
  isSchemeLikelyRelevant,
  searchGovSchemes,
  type GovSchemeCategory
} from "../data/govSchemes";
import "./SchemesPage.css";

const SAVED_KEY = "cropvibe.myGovSchemes";
type TabId = "relevant" | "browse" | "mine";

function readSaved(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
}

export function SchemesPage() {
  const { schemeId } = useParams();
  if (schemeId) return <SchemeDetail schemeId={schemeId} />;
  return <SchemeList />;
}

function SchemeList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("browse");
  const [filter, setFilter] = useState<GovSchemeCategory | "all">("all");
  const [savedIds, setSavedIds] = useState<string[]>(() => readSaved());

  useEffect(() => {
    setSavedIds(readSaved());
  }, []);

  const rows = useMemo(() => {
    let list = GOV_SCHEMES;
    if (tab === "relevant") {
      list = list.filter((row) => isSchemeLikelyRelevant(row, user?.locationLabel));
    } else if (tab === "mine") {
      const saved = new Set(savedIds);
      list = list.filter((row) => saved.has(row.id));
    }
    if (filter !== "all") list = list.filter((row) => row.category === filter);
    return searchGovSchemes(query, list);
  }, [filter, query, savedIds, tab, user?.locationLabel]);

  return (
    <div className="schemes-page">
      <div className="schemes-page__search-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schemes..."
          aria-label="Search schemes"
        />
        <label className="schemes-page__filter">
          <span className="schemes-page__filter-icon" aria-hidden>
            ▾
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as GovSchemeCategory | "all")}
            aria-label="Filter"
          >
            {GOV_SCHEME_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h1>Schemes & Support</h1>
      <p className="schemes-page__disclaimer">
        CropVibe is not a government service. We show likely relevance, never a guarantee of eligibility.
      </p>

      <div className="schemes-page__tabs">
        {(
          [
            ["relevant", "May be relevant"],
            ["browse", "Browse"],
            ["mine", "My schemes"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="schemes-page__list">
        {rows.length === 0 ? (
          <p className="schemes-page__empty">
            {tab === "mine" && !query.trim()
              ? "Save a scheme from details to see it here."
              : "No schemes match this search."}
          </p>
        ) : (
          rows.map((scheme) => (
            <article key={scheme.id} className="schemes-page__card">
              <header>
                <h2>{scheme.name}</h2>
                {isSchemeLikelyRelevant(scheme, user?.locationLabel) ? (
                  <span className="schemes-page__badge">Likely relevant</span>
                ) : null}
              </header>
              <p>{scheme.summary}</p>
              <p className="schemes-page__meta">{formatSchemeDeadline(scheme)}</p>
              <button type="button" className="schemes-page__view" onClick={() => navigate(`/schemes/${scheme.id}`)}>
                View details
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function SchemeDetail({ schemeId }: { schemeId: string }) {
  const scheme = getGovSchemeById(schemeId);
  const [saved, setSaved] = useState(() => readSaved().includes(schemeId));
  const [eligibleOpen, setEligibleOpen] = useState(false);

  useEffect(() => {
    setEligibleOpen(false);
    setSaved(readSaved().includes(schemeId));
  }, [schemeId]);

  if (!scheme) {
    return (
      <div className="schemes-page">
        <Link to="/schemes">Back</Link>
        <p>No schemes match this search.</p>
      </div>
    );
  }

  const selected = scheme;

  function toggleSaved() {
    const ids = readSaved();
    const next = saved ? ids.filter((id) => id !== selected.id) : [...ids, selected.id];
    writeSaved(next);
    setSaved(!saved);
  }

  return (
    <div className="schemes-page schemes-page--detail">
      <div className="schemes-page__detail-head">
        <Link to="/schemes" className="schemes-page__back">
          ←
        </Link>
        <button type="button" className="schemes-page__save" onClick={toggleSaved}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <p className="schemes-page__kicker">{selected.categoryLabel.toUpperCase()}</p>
      <h1>{selected.name}</h1>
      <p className="schemes-page__lead">{selected.description}</p>
      <p>
        <strong>Who it is for: </strong>
        {selected.whoFor}
      </p>
      <p>
        <strong>Documents typically needed: </strong>
        {selected.documents}
      </p>
      {selected.note ? <p className="schemes-page__note">{selected.note}</p> : null}
      <div className="schemes-page__actions">
        <button type="button" className="schemes-page__primary" onClick={() => setEligibleOpen(true)}>
          Check if likely eligible
        </button>
        {eligibleOpen ? (
          <section className="schemes-page__eligible" aria-live="polite">
            <h2>Likely eligibility</h2>
            <p>
              <strong>Who it is for: </strong>
              {selected.whoFor}
            </p>
            <p>
              <strong>Documents typically needed: </strong>
              {selected.documents}
            </p>
            <p className="schemes-page__note">This is not an official check. Confirm on the government website.</p>
            <button type="button" className="schemes-page__secondary-btn" onClick={() => setEligibleOpen(false)}>
              Done
            </button>
          </section>
        ) : null}
        <a className="schemes-page__secondary" href={selected.officialUrl} target="_blank" rel="noreferrer">
          Official site (external)
        </a>
      </div>
    </div>
  );
}
