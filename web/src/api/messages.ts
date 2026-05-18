import { API_BASE_URL, fetchWithAuth } from "./client";

export interface MessageThread {
  peerUserId: number;
  peerName: string;
  peerEmail?: string;
  peerAvatarUrl?: string | null;
  lastSenderId?: number;
  lastReceiverId?: number;
  lastMessage: string;
  lastAt: string;
  unreadCount?: number;
}

export interface DirectMessageItem {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  createdAt: string;
}

export async function fetchMessageThreads(token: string) {
  return (await fetchWithAuth(`${API_BASE_URL}/v1/messages/threads`, token)) as {
    threads: MessageThread[];
  };
}

export async function fetchMessageThread(token: string, peerUserId: number) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}`,
    token
  )) as {
    peer: {
      id: number;
      fullName: string;
      email?: string;
      phone?: string;
      avatarUrl?: string | null;
    };
    messages: DirectMessageItem[];
  };
}

export async function sendDirectMessage(token: string, peerUserId: number, text: string) {
  return (await fetchWithAuth(
    `${API_BASE_URL}/v1/messages/thread/${encodeURIComponent(String(peerUserId))}`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    }
  )) as { message: DirectMessageItem };
}
