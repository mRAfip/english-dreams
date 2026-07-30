import { createClient } from "@/lib/supabase/server";
import { getStudents } from "@/lib/student/directory";
import { getTrainers } from "@/lib/trainer/directory";
import type { FeeStatus } from "@/lib/student/directory";

// Admin home data — real counts and queues built from the live tables. Every
// figure here is derived from data that actually exists (students, trainers,
// access/fee flags, trainer links, certificates); nothing is fabricated. When
// there are no students and no trainers, `isEmpty` drives the onboarding screen.

export type AttentionReason = "suspended" | "fees" | "unassigned";

export type AttentionItem = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  reason: AttentionReason;
  detail: string;
  trainerName: string | null;
};

export type TrainerLoad = {
  id: string;
  name: string;
  students: number;
};

export type AdminOverviewData = {
  studentCount: number;
  trainerCount: number;
  feesDue: number;
  suspended: number;
  unassigned: number;
  certificatesIssued: number;
  attention: AttentionItem[];
  trainers: TrainerLoad[];
  isEmpty: boolean;
};

const ATTENTION_LIMIT = 8;

export async function getAdminOverview(): Promise<AdminOverviewData> {
  const [students, trainers] = await Promise.all([getStudents(), getTrainers()]);

  const supabase = await createClient();
  const { count: certCount } = await supabase
    .from("certificates")
    .select("student_id", { count: "exact", head: true });

  // Students per trainer, from each student's assigned trainer id.
  const loadByTrainer = new Map<string, number>();
  for (const s of students) {
    if (s.trainerId) {
      loadByTrainer.set(s.trainerId, (loadByTrainer.get(s.trainerId) ?? 0) + 1);
    }
  }
  const trainerLoads: TrainerLoad[] = trainers
    .map((t) => ({ id: t.id, name: t.name, students: loadByTrainer.get(t.id) ?? 0 }))
    .sort((a, b) => b.students - a.students);

  const feesDue = students.filter((s) => s.feeStatus === "unpaid").length;
  const suspended = students.filter((s) => !s.accessEnabled).length;
  const unassigned = students.filter((s) => !s.trainerId).length;

  // Attention queue — the single most urgent flag per student, worst first.
  const attention: AttentionItem[] = [];
  for (const s of students) {
    const reason = topReason(s.accessEnabled, s.feeStatus, s.trainerId);
    if (!reason) continue;
    attention.push({
      id: s.id,
      name: s.name,
      email: s.email,
      avatarUrl: s.avatarUrl,
      reason,
      detail: DETAIL[reason],
      trainerName: s.trainerName,
    });
  }
  attention.sort((a, b) => SEVERITY[a.reason] - SEVERITY[b.reason]);

  return {
    studentCount: students.length,
    trainerCount: trainers.length,
    feesDue,
    suspended,
    unassigned,
    certificatesIssued: certCount ?? 0,
    attention: attention.slice(0, ATTENTION_LIMIT),
    trainers: trainerLoads,
    isEmpty: students.length === 0 && trainers.length === 0,
  };
}

const SEVERITY: Record<AttentionReason, number> = {
  suspended: 0,
  fees: 1,
  unassigned: 2,
};

const DETAIL: Record<AttentionReason, string> = {
  suspended: "Access disabled",
  fees: "Fees unpaid",
  unassigned: "No trainer assigned",
};

function topReason(
  accessEnabled: boolean,
  feeStatus: FeeStatus,
  trainerId: string | null,
): AttentionReason | null {
  if (!accessEnabled) return "suspended";
  if (feeStatus === "unpaid") return "fees";
  if (!trainerId) return "unassigned";
  return null;
}
