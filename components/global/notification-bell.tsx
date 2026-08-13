"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { CurrentUser } from "@/lib/auth/guards";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({ user }: { user: CurrentUser }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch initial notifications
  const fetchNotifications = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        // Fallback gracefully if table does not exist yet
        console.warn("Notifications table query error:", error);
        setNotifications([]);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.warn("Error fetching notifications:", err);
    }
  }, [supabase]);

  React.useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime changes in notifications table
    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
            
            // Push toast notice
            toast.success(newNotif.title, {
              description: newNotif.body,
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, supabase, fetchNotifications]);

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      // Update state locally first for instant feedback
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds);

      if (error) {
        console.error("Error marking all read:", error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    setOpen(false);
    
    // Mark as read in db if unread
    if (!notif.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notif.id);
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const timeAgo = (dateStr: string) => {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open notifications"
        className={cn(
          "relative grid size-9 place-items-center rounded-lg text-mute transition-colors hover:bg-secondary hover:text-ink",
          open && "bg-secondary text-ink"
        )}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-white p-4 shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2.5">
            <h3 className="font-display text-sm font-extrabold text-ink">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-green hover:underline"
              >
                <Check className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-mute">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "w-full flex items-start gap-2.5 rounded-lg p-2 text-left text-xs transition-colors hover:bg-secondary",
                    !notif.read ? "bg-primary-pale/30 font-medium" : ""
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink truncate">{notif.title}</span>
                      <span className="text-[10px] text-mute whitespace-nowrap">
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-mute line-clamp-2 leading-relaxed">
                      {notif.body}
                    </p>
                  </div>
                  {!notif.read && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
