import type { UserRole } from "../auth/AuthContext";
import type { AppRole } from "./types";

export function appRoleToApiRole(app: AppRole): UserRole {
  return app === "buyer" ? "student" : "instructor";
}
