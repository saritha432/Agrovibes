import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchMyHomePosts, fetchSocialNetwork, fetchUserHomePosts, sendFollowRequest } from "../api/home";
import type { HomePost } from "../api/types";
import {
  fetchProfileStats,
  fetchSavedHomePosts,
  fetchTaggedHomePosts,
  removeFollower,
  unfollowUser,
  type NetworkPerson,
  type ProfileStats
} from "../api/profile";
import { findIncomingFollowId, fetchSocialNotifications, respondToFollowRequestById } from "../api/social";
import { deleteHomePost } from "../api/posts";
import { getWebAppOrigin } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { ProfileGalleryIcon, PROFILE_GALLERY_TABS } from "../components/profile/ProfileGalleryIcons";
import { ProfileGridTile } from "../components/profile/ProfileGridTile";
import { ProfileReelViewer } from "../components/profile/ProfileReelViewer";
import {
  filterUserPosts,
  locationDisplay,
  parsePersonUserId,
  reelGridStillUri,
  userInitials,
  visibleGalleryPosts,
  type GalleryTab
} from "./profileUtils";
import { keepVisibleHomePost } from "../utils/feedOrder";
import "./ProfilePage.css";

export function ProfilePage() {
  const navigate = useNavigate();
  const { userId: userIdParam } = useParams();
  const { user, token } = useAuth();
  const requestedPublicId = Number(userIdParam);
  const isPublicView =
    Number.isFinite(requestedPublicId) && requestedPublicId > 0 && requestedPublicId !== Number(user?.id);
  const [allPosts, setAllPosts] = useState<HomePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<HomePost[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<HomePost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState<NetworkPerson[]>([]);
  const [followingList, setFollowingList] = useState<NetworkPerson[]>([]);
  const [incomingFollowActorIds, setIncomingFollowActorIds] = useState<Set<number>>(() => new Set());
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [followingMenuFor, setFollowingMenuFor] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<NetworkPerson | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [activeGalleryTab, setActiveGalleryTab] = useState<GalleryTab>("Posts");
  const [postsStat, setPostsStat] = useState(0);
  const [reelViewerIndex, setReelViewerIndex] = useState<number | null>(null);
  const [activeImagePost, setActiveImagePost] = useState<HomePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [publicStats, setPublicStats] = useState<ProfileStats | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [contentRestricted, setContentRestricted] = useState(false);

  useEffect(() => {
    if (Number.isFinite(requestedPublicId) && requestedPublicId > 0 && requestedPublicId === Number(user?.id)) {
      navigate("/profile", { replace: true });
    }
  }, [navigate, requestedPublicId, user?.id]);

  const loadPosts = useCallback(async () => {
    if (!token) {
      setAllPosts([]);
      setSavedPosts([]);
      setTaggedPosts([]);
      return;
    }
    if (isPublicView) {
      try {
        const data = await fetchUserHomePosts(token, requestedPublicId);
        setAllPosts(data.posts);
        setSavedPosts([]);
        setTaggedPosts([]);
        setContentRestricted(Boolean(data.restricted));
        if (typeof data.postsCount === "number" && Number.isFinite(data.postsCount)) {
          setPostsStat(data.postsCount);
        }
      } catch {
        setAllPosts([]);
        setSavedPosts([]);
        setTaggedPosts([]);
      }
      return;
    }
    setContentRestricted(false);
    try {
      const [homeData, savedData, taggedData] = await Promise.all([
        fetchMyHomePosts(token),
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
  }, [isPublicView, requestedPublicId, token]);

  const refreshStats = useCallback(async () => {
    if (!token) {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
      return;
    }
    const uid = isPublicView ? requestedPublicId : Number(user?.id);
    if (!Number.isFinite(uid) || uid <= 0) {
      setFollowersCount(0);
      setFollowingCount(0);
      setFollowersList([]);
      setFollowingList([]);
      return;
    }
    try {
      const stats = await fetchProfileStats(token, uid);
      setFollowersCount(Number(stats.followersCount || 0));
      setFollowingCount(Number(stats.followingCount || 0));
      setPostsStat(Number(stats.postsCount || 0));
      if (isPublicView) setPublicStats(stats);
      else setPublicStats(null);
    } catch {
      setFollowersCount(0);
      setFollowingCount(0);
    }
    try {
      const network = await fetchSocialNetwork(token, uid);
      setFollowersList(network.followers || []);
      setFollowingList(network.following || []);
    } catch {
      setFollowersList([]);
      setFollowingList([]);
    }
    if (isPublicView) {
      setIncomingFollowActorIds(new Set());
      return;
    }
    try {
      const notifs = await fetchSocialNotifications(token);
      setIncomingFollowActorIds(
        new Set(
          (notifs.followRequests || [])
            .map((n) => Number(n.actorId))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );
    } catch {
      setIncomingFollowActorIds(new Set());
    }
  }, [isPublicView, requestedPublicId, token, user?.id]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "Posts" || tab === "Reels" || tab === "Saved" || tab === "Tagged") {
      setActiveGalleryTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isPublicView) return;
    if (activeGalleryTab === "Saved" || activeGalleryTab === "Tagged") {
      setActiveGalleryTab("Posts");
    }
  }, [activeGalleryTab, isPublicView]);

  const reload = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPosts(), refreshStats()]);
    setLoading(false);
  }, [loadPosts, refreshStats]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const userPosts = useMemo(() => {
    if (isPublicView) return allPosts.filter((p) => keepVisibleHomePost(p));
    return user ? filterUserPosts(allPosts, user) : [];
  }, [allPosts, isPublicView, user]);

  const visiblePosts = useMemo(
    () => visibleGalleryPosts(activeGalleryTab, userPosts, savedPosts, taggedPosts),
    [activeGalleryTab, savedPosts, taggedPosts, userPosts]
  );

  const isReelTab =
    activeGalleryTab === "Reels" || activeGalleryTab === "Saved" || activeGalleryTab === "Tagged";

  const postsStatDisplay = Math.max(postsStat, userPosts.length);

  const confirmDeletePost = async (post: HomePost) => {
    if (!token) return;
    if (!window.confirm("Delete this post from your profile?")) return;
    try {
      await deleteHomePost(token, post.id);
      await loadPosts();
      await refreshStats();
    } catch {
      window.alert("Could not delete post.");
    }
  };

  const shareProfile = async () => {
    if (!user) return;
    const url = isPublicView
      ? `${getWebAppOrigin()}/u/${requestedPublicId}`
      : `${getWebAppOrigin()}/profile`;
    const name = isPublicView ? publicStats?.fullName || "this profile" : user.fullName;
    const text = `Check out ${name} on Cropvibe — ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} - Cropvibe`, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        window.alert("Profile link copied.");
      }
    } catch {
      // user cancelled share
    }
  };

  const followPublicUser = async () => {
    if (!token || !isPublicView || followBusy) return;
    const status = publicStats?.viewerStatus;
    if (status === "pending") return;
    setFollowBusy(true);
    try {
      if (status === "accepted") {
        await unfollowUser(token, requestedPublicId);
      } else {
        await sendFollowRequest(token, requestedPublicId);
      }
      await refreshStats();
      await loadPosts();
    } catch {
      window.alert("Could not update follow. Please try again.");
    } finally {
      setFollowBusy(false);
    }
  };

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

  const displayName = isPublicView ? publicStats?.fullName || "User" : user.fullName;
  const displayAvatar = isPublicView ? publicStats?.avatarUrl : user.avatarUrl;
  const initials = userInitials(displayName);
  const bioText = (isPublicView ? publicStats?.bio : user.bio)?.trim() || "";
  const website = isPublicView ? publicStats?.website : user.website;
  const locationLabel = isPublicView ? publicStats?.locationLabel : user.locationLabel;
  const isInstructor = !isPublicView && (user.role === "instructor" || user.role === "admin");
  const headerTitle = isPublicView
    ? publicStats?.username || publicStats?.fullName || "Profile"
    : user.username || user.fullName;
  const galleryTabs = isPublicView ? (["Posts", "Reels"] as GalleryTab[]) : PROFILE_GALLERY_TABS;
  const followStatus = publicStats?.viewerStatus || "none";
  const followLabel =
    followStatus === "accepted"
      ? "Following"
      : followStatus === "pending"
        ? "Requested"
        : publicStats?.canFollowBack
          ? "Follow back"
          : "Follow";

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

  const onAcceptFollow = async (person: NetworkPerson) => {
    const targetId = parsePersonUserId(person);
    if (!token || !targetId) return;
    try {
      const followId = await findIncomingFollowId(token, targetId);
      if (!followId) return;
      await respondToFollowRequestById(token, followId, "accept");
      await refreshStats();
    } catch {
      // ignore
    }
  };

  const onDeclineFollow = async (person: NetworkPerson) => {
    const targetId = parsePersonUserId(person);
    if (!token || !targetId) return;
    try {
      const followId = await findIncomingFollowId(token, targetId);
      if (!followId) return;
      await respondToFollowRequestById(token, followId, "decline");
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
        {isPublicView ? (
          <button type="button" className="profile-topbar__back" onClick={() => navigate(-1)} aria-label="Back">
            ←
          </button>
        ) : (
          <span className="profile-topbar__spacer" aria-hidden />
        )}
        <h1 className="profile-topbar__title">{headerTitle}</h1>
        {isPublicView ? (
          <span className="profile-topbar__spacer" aria-hidden />
        ) : (
          <Link to="/settings" className="profile-topbar__menu" aria-label="Menu">
            <img src="/icons/menu-icon.svg" alt="" width={34} height={34} />
          </Link>
        )}
      </header>

      <section className="profile-card">
        <div className="profile-card__mid">
          <div className="profile-card__avatar-wrap">
            <span className="profile-card__avatar">
              {displayAvatar ? <img src={displayAvatar} alt="" /> : initials}
            </span>
          </div>

          <div className="profile-card__stats">
            <div className="profile-card__stat">
              <strong>{postsStatDisplay}</strong>
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

        {bioText ? <p className="profile-card__bio">{bioText}</p> : null}
        {website ? <p className="profile-card__website">{website}</p> : null}
        {locationLabel?.trim() ? (
          <p className="profile-card__location">{locationDisplay(locationLabel)}</p>
        ) : null}

        <div className="profile-card__actions">
          {isPublicView ? (
            <>
              <button
                type="button"
                className="profile-card__action-btn"
                disabled={followBusy || followStatus === "pending"}
                onClick={() => void followPublicUser()}
              >
                {followBusy ? "…" : followLabel}
              </button>
              <Link to={`/messages/${requestedPublicId}`} className="profile-card__action-btn">
                Message
              </Link>
            </>
          ) : (
            <>
              <Link to="/profile/edit" className="profile-card__action-btn">
                Edit Profile
              </Link>
              <button type="button" className="profile-card__action-btn" onClick={() => void shareProfile()}>
                Share Profile
              </button>
            </>
          )}
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
      </section>

      <section className="profile-gallery">
        <div className="profile-gallery__tabs" role="tablist">
          {galleryTabs.map((tab) => (
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
              {contentRestricted
                ? "This account is private. Follow to see their posts."
                : activeGalleryTab === "Tagged"
                  ? "No tagged posts yet."
                  : activeGalleryTab === "Saved"
                    ? "Saved drops will appear here."
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
              onDelete={
                !isPublicView && (activeGalleryTab === "Posts" || activeGalleryTab === "Reels")
                  ? () => void confirmDeletePost(post)
                  : undefined
              }
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
                            {(() => {
                              const actorId = parsePersonUserId(person);
                              return actorId && incomingFollowActorIds.has(actorId) ? (
                              <>
                                <button type="button" onClick={() => void onAcceptFollow(person)}>
                                  Confirm
                                </button>
                                <button type="button" onClick={() => void onDeclineFollow(person)}>
                                  Delete
                                </button>
                              </>
                              ) : null;
                            })()}
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
