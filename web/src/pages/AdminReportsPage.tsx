import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  dismissAdminPostReports,
  fetchAdminPostReportDetail,
  fetchAdminReportedPosts,
  removeAdminReportedPost,
  type AdminPostReportRow,
  type AdminReportedPost
} from "../api/adminReports";
import "./PrivacyPolicy.css";

export function AdminReportsPage() {
  const { token, user, loading } = useAuth();
  const [posts, setPosts] = useState<AdminReportedPost[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reports, setReports] = useState<AdminPostReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchAdminReportedPosts(token);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReview = async (postId: number) => {
    if (!token) return;
    setSelectedId(postId);
    setBusy(true);
    setError(null);
    try {
      const detail = await fetchAdminPostReportDetail(token, postId);
      setReports(Array.isArray(detail.reports) ? detail.reports : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = async () => {
    if (!token || !selectedId) return;
    setBusy(true);
    try {
      await dismissAdminPostReports(token, selectedId);
      setSelectedId(null);
      setReports([]);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to dismiss");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!token || !selectedId) return;
    if (!window.confirm("Remove this reel for guideline violation?")) return;
    setBusy(true);
    try {
      await removeAdminReportedPost(token, selectedId);
      setSelectedId(null);
      setReports([]);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="privacy-policy">
        <p>Loading…</p>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") {
    return (
      <div className="privacy-policy">
        <h1>Admin reports</h1>
        <p>Admin access required.</p>
      </div>
    );
  }

  const selected = posts.find((p) => p.id === selectedId) || null;

  return (
    <div className="privacy-policy">
      <header className="privacy-policy__header">
        <h1>Reported reels</h1>
        <p>Review community reports. High-priority reasons (scam, harmful advice) appear first.</p>
      </header>

      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}

      <section>
        <h2>Queue</h2>
        {posts.length === 0 ? <p>No pending reported reels.</p> : null}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {posts.map((post) => (
            <li
              key={post.id}
              style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid #404040"
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#111"
                }}
              >
                {post.thumbnailUrl || post.imageUrl ? (
                  <img
                    src={post.thumbnailUrl || post.imageUrl || ""}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div>
                <strong>{post.userName}</strong>
                <div style={{ color: "#a3a3a3", fontSize: 13 }}>
                  Reports: {post.reportCount ?? 0}
                  {post.latestReason ? ` · ${post.latestReason}` : ""}
                  {post.feedHiddenAt ? " · auto-hidden from feed" : ""}
                </div>
                <div style={{ color: "#d4d4d4", fontSize: 13, marginTop: 4 }}>
                  {(post.caption || "").slice(0, 120)}
                </div>
              </div>
              <button type="button" onClick={() => void openReview(post.id)} disabled={busy}>
                Review
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section style={{ marginTop: 28 }}>
          <h2>Review #{selected.id}</h2>
          {selected.videoUrl ? (
            <video src={selected.videoUrl} controls style={{ width: "100%", maxHeight: 360, background: "#000" }} />
          ) : selected.imageUrl ? (
            <img src={selected.imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
          ) : null}
          <p style={{ marginTop: 12 }}>{selected.caption}</p>
          <h3>Reports</h3>
          <ul>
            {reports.map((r) => (
              <li key={r.id}>
                <strong>{r.reporterName}</strong> — {r.reason || "—"}
                {r.description ? `: ${r.description}` : ""}
                <div style={{ color: "#a3a3a3", fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button type="button" onClick={() => void onDismiss()} disabled={busy}>
              Dismiss reports
            </button>
            <button type="button" onClick={() => void onRemove()} disabled={busy} style={{ color: "#fecaca" }}>
              Delete reel
            </button>
            <button type="button" onClick={() => setSelectedId(null)} disabled={busy}>
              Close
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
