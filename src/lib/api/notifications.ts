import { api } from "./client";

export interface OutboxNotification {
  id: string;
  channel: "EMAIL" | "SMS" | string;
  recipient: string;
  subject: string | null;
  body: string;
  status: "SENT" | "FAILED" | "QUEUED" | string;
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  related_user_id: string | null;
}

export interface OutboxResponse {
  total: number;
  items: OutboxNotification[];
}

export interface SMSStatusResponse {
  provider: string;
  sender_id: string;
  configured: boolean;
  balance_info: {
    status?: string;
    message?: string;
    balance?: string | number;
    [key: string]: unknown;
  } | null;
}

export interface SendTestSMSResponse {
  success: boolean;
  notification_id: string;
  status: string;
  provider: string;
  recipient: string;
  provider_message_id: string | null;
  error_message: string | null;
}

export const notificationsApi = {
  getOutbox(params?: {
    channel?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<OutboxResponse> {
    const qs = new URLSearchParams();
    if (params?.channel) qs.set("channel", params.channel);
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<OutboxResponse>(`/notifications/outbox${suffix}`);
  },

  getSMSStatus(): Promise<SMSStatusResponse> {
    return api<SMSStatusResponse>("/notifications/sms/status");
  },

  sendTestSMS(payload: { recipient: string; message: string }): Promise<SendTestSMSResponse> {
    return api<SendTestSMSResponse>("/notifications/sms/send-test", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  retryNotification(id: string): Promise<OutboxNotification> {
    return api<OutboxNotification>(`/notifications/${id}/retry`, {
      method: "POST",
    });
  },
};
