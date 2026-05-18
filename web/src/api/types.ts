export type UserRole = "student" | "instructor" | "admin";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  website?: string;
  locationLabel?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  isNewUser?: boolean;
}

export interface HomePost {
  id: number;
  userId?: number | null;
  userName: string;
  location: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoUrl?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  thumbnailUrl?: string;
  musicLabel?: string | null;
  createdAt: string;
  viewerHasLiked?: boolean;
  viewerHasSaved?: boolean;
  authorAvatarUrl?: string | null;
}

export interface UserSearchRecord {
  id: number;
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  followingCount: number;
  viewerStatus: "none" | "pending" | "accepted" | "self";
  canFollowBack?: boolean;
}
