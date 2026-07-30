import { requireUser } from "@/lib/auth/guards";
import { getInbox, getThreadWith } from "@/lib/inbox/conversations";
import { ConversationList } from "@/components/global/inbox/conversation-list";
import { ConversationView } from "@/components/global/inbox/conversation-view";

// Shared > Inbox — a people-first list of everyone the viewer may message (the
// permission matrix), each with their thread. The first person opens beside the
// list from `lg`, so the screen is never a dead end. Picking anyone on a smaller
// screen navigates to /inbox/u/[userId].
export default async function Page() {
  const user = await requireUser();

  const entries = await getInbox(user);
  const unread = entries.reduce((sum, e) => sum + e.unread, 0);
  const first = entries[0];
  const firstThread = first ? await getThreadWith(user, first.with.id) : null;

  return (
    <div>
      <header className="flex flex-col gap-1.5 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Inbox
        </h1>
        <p className="text-sm text-body">
          {entries.length} {entries.length === 1 ? "person" : "people"}
          {unread > 0 && ` · ${unread} unread`}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="mt-10 text-center text-sm text-mute">
          You don&apos;t have anyone to message yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
          <ConversationList
            entries={entries}
            activeUserId={first?.with.id}
            className="max-w-2xl"
          />
          {firstThread && (
            <ConversationView
              key={firstThread.with.id}
              thread={firstThread}
              meId={user.id}
              className="hidden lg:flex"
            />
          )}
        </div>
      )}
    </div>
  );
}
