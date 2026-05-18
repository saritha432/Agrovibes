import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchHomePosts, fetchSocialNetwork, sendFollowRequest } from "../api/home";
import type { HomePost } from "../api/types";
import {
  fetchProfileStats,
  fetchSavedHomePosts,
  fetchTaggedHomePosts,
  removeFollower,
  unfollowUser,
  type NetworkPerson
} from "../api/profile";
import { useAuth } from "../auth/AuthContext";
import { ProfileGalleryIcon, PROFILE_GALLERY_TABS } from "../components/profile/ProfileGalleryIcons";
import { ProfileGridTile } from "../components/profile/ProfileGridTile";
import { ProfileReelViewer } from "../components/profile/ProfileReelViewer";
import {
  displayHandle,
  filterUserPosts,
  locationDisplay,
  parsePersonUserId,
  reelGridStillUri,
  roleLabel,
  userInitials,
  visibleGalleryPosts,
  type GalleryTab
} from "./profileUtils";
import "./ProfilePage.css";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, signOut } = useAuth();
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<NetworkPerson[]>([]);
  const [followingList, setFollowingList] = useState<NetworkPerson[]>([]);
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [followingMenuFor, setFollowingMenuFor] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<NetworkPerson | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [activeGalleryTab, setActiveGalleryTab] = useState<GalleryTab>("Reels");
  const [reelViewerIndex, setReelViewerIndex] = useState<number | null>(null);
  const [activeImagePost, setActiveImagePost] = useState<HomePost | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    if (!token) {
      setAllPosts([]);
      setSavedPosts([]);
      setTaggedPosts([]);
      return;
    }
    try {
      const [homeData, savedData, taggedData] = await Promise.all([
        fetchHomePosts(token),
        fetchSavedHomePosts(token),
        fetchTaggedHomePosts(token)
      ]);
      setAllPosts(homeData.posts);
      setSavedPosts(savedData.posts);
      setTaggedPosts(taggedData.posts);
    } catch {
      setAllPosts([]);
      setSavedPosts([]);
      setTaggedPosts([]);
    }
  }, [token]);

  const refreshStats = useCallback(async () => {
    if (!token || !user?.id) {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
      return;
    }
    try {
      const uid = Number(user.id);
      const [stats, network] = await Promise.all([
        fetchProfileStats(token, uid),
        fetchSocialNetwork(token, uid)
      ]);
      setFollowersCount(Number(stats.followersCount || 0));
      setFollowingCount(Number(stats.followingCount || 0));
      setFollowersList(network.followers || []);
      setFollowingList(network.following || []);
    } catch {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
    }
  }, [token, user?.id]);

  const reload = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPosts(), refreshStats()]);
    setLoading(false);
  }, [loadPosts, refreshStats]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const userPosts = useMemo(
    () => (user ? filterUserPosts(allPosts, user) : []),
    [allPosts, user]
  );

  const visiblePosts = useMemo(
    () => visibleGalleryPosts(activeGalleryTab, userPosts, savedPosts, taggedPosts),
    [activeGalleryTab, savedPosts, taggedPosts, userPosts]
  );

  const isReelTab =
    activeGalleryTab === "Reels" || activeGalleryTab === "Saved" || activeGalleryTab === "Tagged";

  const postsStat = userPosts.length;

  const singleGridVideoPreviewId = useMemo(() => {
    if (!isReelTab) return null;
    for (const p of visiblePosts) {
      if (!p.videoUrl || reelGridStillUri(p)) continue;
      return p.id;
    }
    return null;
  }, [isReelTab, visiblePosts]);

  const reelPostsForViewer = useMemo(
    () => visiblePosts.filter((p) => !!p.videoUrl),
    [visiblePosts]
  );

  if (!user) {
    return (
      <div className="profile-page">
        <p>Sign in to view your profile.</p>
      </div>
    );
  }

  const handle = displayHandle(user);
  const initials = userInitials(user.fullName);
  const bioText =
    user.bio?.trim() ||
    `${user.fullName} — growing and trading fresh produce. Share tips and connect with the community.`;
  const isInstructor = user.role === "instructor" || user.role === "admin";

  const personRowId = (p: NetworkPerson) => `${String(p.key || "").toLowerCase()}::${p.name}`;

  const onFollowBack = async (person: NetworkPerson) => {
    const targetId = parsePersonUserId(person);
    if (!token || !targetId) return;
    try {
      await sendFollowRequest(token, targetId);
      await refreshStats();
    } catch {
      // ignore
    }
  };

  const onUnfollow = async (person: NetworkPerson) => {
    const targetId = parsePersonUserId(person);
    if (!token || !targetId) return;
    try {
      await unfollowUser(token, targetId);
      setFollowingMenuFor(null);
      await refreshStats();
    } catch {
      // ignore
    }
  };

  const onRemoveFollower = async (person: NetworkPerson) => {
    const targetId = parsePersonUserId(person);
    if (!token || !targetId) return;
    setRemoveBusy(true);
    try {
      await removeFollower(token, targetId);
      setRemoveConfirm(null);
      await refreshStats();
    } catch {
      // ignore
    } finally {
      setRemoveBusy(false);
    }
  };

  const activeList = activeListType === "followers" ? followersList : followingList;

  return (
    <div className={`profile-page${reelViewerIndex != null ? " profile-page--reel-open" : ""}`}>
      <header className="profile-topbar">
        <Link to="/search" className="profile-topbar__btn" aria-label="Search">
          ⌕
        </Link>
      </header>

      <section className="profile-card">
        <p className="profile-card__handle">{handle}</p>

        <div className="profile-card__mid">
          <div className="profile-card__avatar-wrap">
            <span className="profile-card__avatar">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
            </span>
            <span className="profile-card__shield" aria-hidden>
              ✓
            </span>
          </div>

          <div className="profile-card__stats">
            <div className="profile-card__stat">
              <strong>{postsStat}</strong>
              <span>Posts</span>
            </div>
            <button
              type="button"
              className="profile-card__stat profile-card__stat--btn"
              onClick={() => setActiveListType("followers")}
            >
              <strong>{followersCount}</strong>
              <span>Followers</span>
            </button>
            <button
              type="button"
              className="profile-card__stat profile-card__stat--btn"
              onClick={() => setActiveListType("following")}
            >
              <strong>{followingCount}</strong>
              <span>Following</span>
            </button>
          </div>
        </div>

        <div className="profile-card__name-row">
          <h1>{user.fullName}</h1>
          <span className="profile-card__kyc">✓ KYC Verified</span>
        </div>

        <p className="profile-card__role">
          {roleLabel(user.role)} <span aria-hidden>🌾</span>
        </p>
        <p className="profile-card__bio">{bioText}</p>
        {user.website ? <p className="profile-card__website">{user.website}</p> : null}
        <p className="profile-card__location">📍 {locationDisplay(user.locationLabel)}</p>

        <div className="profile-card__rating">
          <span className="profile-card__stars" aria-hidden>
            ★★★★☆
          </span>
          <span>4.8</span>
        </div>

        <div className="profile-card__actions">
          <Link to="/profile/edit" className="profile-card__edit">
            ✎ Edit Profile
          </Link>
          <button
            type="button"
            className="profile-card__share"
            onClick={() => window.alert("Share coming soon.")}
          >
            ↗
          </button>
        </div>

        {isInstructor ? (
          <button
            type="button"
            className="profile-card__studio"
            onClick={() => navigate("/learn")}
          >
            Instructor Studio →
          </button>
        ) : null}

        <button type="button" className="profile-card__logout" onClick={() => void signOut()}>
          Log out
        </button>
      </section>

      <section className="profile-gallery">
        <div className="profile-gallery__tabs" role="tablist">
          {PROFILE_GALLERY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeGalleryTab === tab}
              aria-label={tab}
              className={`profile-gallery__tab${activeGalleryTab === tab ? " profile-gallery__tab--active" : ""}`}
              onClick={() => setActiveGalleryTab(tab)}
            >
              <ProfileGalleryIcon tab={tab} />
              <span className="profile-gallery__tab-line" />
            </button>
          ))}
        </div>

        {loading ? <p className="profile-gallery__loading">Loading…</p> : null}

        <div className={`profile-grid${isReelTab ? " profile-grid--reels" : ""}`}>
          {!loading && visiblePosts.length === 0 ? (
            <p className="profile-grid__empty">
              {activeGalleryTab === "Tagged"
                ? "No tagged posts yet."
                : activeGalleryTab === "Saved"
                  ? "Saved reels will appear here."
                  : "No posts in this tab yet."}
            </p>
          ) : null}
          {visiblePosts.map((post) => (
            <ProfileGridTile
              key={post.id}
              post={post}
              isReelTab={isReelTab}
              allowMutedPreview={reelViewerIndex == null && post.id === singleGridVideoPreviewId}
              onOpenReel={() => {
                const ix = reelPostsForViewer.findIndex((p) => p.id === post.id);
                setReelViewerIndex(ix >= 0 ? ix : 0);
              }}
              onOpenImage={() => setActiveImagePost(post)}
            />
          ))}
        </div>
      </section>

      {activeListType ? (
        <div className="profile-sheet-overlay" role="presentation">
          <button
            type="button"
            className="profile-sheet-overlay__backdrop"
            aria-label="Close"
            onClick={() => {
              setFollowingMenuFor(null);
              setActiveListType(null);
            }}
          />
          <div className="profile-sheet" role="dialog" aria-modal="true">
            <header className="profile-sheet__head">
              <h2>{activeListType === "followers" ? "Followers" : "Following"}</h2>
              <button
                type="button"
                onClick={() => {
                  setFollowingMenuFor(null);
                  setActiveListType(null);
                }}
              >
                ×
              </button>
            </header>
            <ul className="profile-sheet__list">
              {activeList.length === 0 ? (
                <li className="profile-sheet__empty">No users found.</li>
              ) : (
                activeList.map((person) => {
                  const rowId = personRowId(person);
                  const menuOpen = activeListType === "following" && followingMenuFor === rowId;
                  return (
                    <li key={rowId} className="profile-sheet__row">
                      <span className="profile-sheet__avatar">
                        {person.avatarUrl ? (
                          <img src={person.avatarUrl} alt="" />
                        ) : (
                          person.name.charAt(0)
                        )}
                      </span>
                      <span className="profile-sheet__name">{person.name}</span>
                      <div className="profile-sheet__actions">
                        {activeListType === "followers" ? (
                          <>
                            {parsePersonUserId(person) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveListType(null);
                                  navigate(`/messages/${parsePersonUserId(person)}`);
                                }}
                              >
                                Message
                              </button>
                            ) : null}
                            {person.canFollowBack && person.viewerStatus === "none" ? (
                              <button type="button" onClick={() => void onFollowBack(person)}>
                                Follow back
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="profile-sheet__danger"
                              onClick={() => setRemoveConfirm(person)}
                              aria-label={`Remove ${person.name}`}
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            {parsePersonUserId(person) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveListType(null);
                                  navigate(`/messages/${parsePersonUserId(person)}`);
                                }}
                              >
                                Message
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="profile-sheet__more"
                              onClick={() =>
                                setFollowingMenuFor((prev) => (prev === rowId ? null : rowId))
                              }
                            >
                              ⋮
                            </button>
                            {menuOpen ? (
                              <button type="button" onClick={() => void onUnfollow(person)}>
                                Unfollow
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {removeConfirm ? (
        <div className="profile-confirm-overlay" role="presentation">
          <button
            type="button"
            className="profile-sheet-overlay__backdrop"
            aria-label="Dismiss"
            onClick={() => !removeBusy && setRemoveConfirm(null)}
          />
          <div className="profile-confirm" role="alertdialog">
            <h3>Remove follower?</h3>
            <p>
              <strong>{removeConfirm.name}</strong> will be removed from your followers.
            </p>
            <div className="profile-confirm__actions">
              <button type="button" disabled={removeBusy} onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="profile-confirm__danger"
                disabled={removeBusy}
                onClick={() => void onRemoveFollower(removeConfirm)}
              >
                {removeBusy ? "…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeImagePost ? (
        <div className="profile-viewer" role="dialog" aria-modal="true">
          <button type="button" className="profile-viewer__close" onClick={() => setActiveImagePost(null)}>
            ×
          </button>
          <div className="profile-viewer__media">
            {(activeImagePost.imageUrls?.length
              ? activeImagePost.imageUrls
              : activeImagePost.imageUrl
                ? [activeImagePost.imageUrl]
                : []
            ).map((uri, i) => (
              <img key={`${activeImagePost.id}-${i}`} src={uri} alt="" />
            ))}
          </div>
          <div className="profile-viewer__caption">
            <strong>{activeImagePost.userName}</strong>
            {activeImagePost.caption ? <p>{activeImagePost.caption}</p> : null}
          </div>
        </div>
      ) : null}

      {reelViewerIndex != null && reelPostsForViewer.length > 0 ? (
        <ProfileReelViewer
          posts={reelPostsForViewer}
          initialIndex={Math.min(reelViewerIndex, reelPostsForViewer.length - 1)}
          onClose={() => setReelViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}
