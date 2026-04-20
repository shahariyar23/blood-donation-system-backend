import { Request } from "express";
import { UserActivity } from "../index";

type ActivityEvent =
  | "register"
  | "login"
  | "logout"
  | "login_failed"
  | "password_reset"
  | "donor_search"
  | "donor_view"
  | "donor_contact"
  | "availability_toggle"
  | "request_create"
  | "request_view"
  | "request_respond"
  | "request_cancel"
  | "bank_search"
  | "bank_view"
  | "bank_call"
  | "bank_directions"
  | "profile_view"
  | "profile_update"
  | "avatar_upload"
  | "page_view"
  | "page_exit"
  | "notification_read"
  | "report_submit"
  | "account_delete";

const extractIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  const raw = forwarded
    ? forwarded.split(",")[0].trim()
    : req.ip || req.socket.remoteAddress || "";

  return raw.replace("::ffff:", "").replace("::1", "127.0.0.1");
};

type LogActivityInput = {
  userId?: string;
  sessionId?: string;
  event: ActivityEvent;
  meta?: Record<string, any>;
};

export const logActivity = async (req: Request, payload: LogActivityInput) => {
  if (!payload.userId) return;

  await UserActivity.create({
    userId: payload.userId,
    sessionId: payload.sessionId || req.user?.sessionId,
    event: payload.event,
    meta: payload.meta || {},
    ip: extractIp(req),
    userAgent: req.headers["user-agent"] || "",
    timestamp: new Date(),
  }).catch(() => {});
};
