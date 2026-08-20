import { notFound } from "next/navigation";
import { getExamGroupPass } from "./actions";
import { ExamGroupPass } from "@/components/student/exam-group-pass";

export default async function StudentExamGroupPassPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const pass = await getExamGroupPass(groupId);

  if (!pass.ok) notFound();

  return (
    <div className="mx-auto w-full max-w-md">
      <ExamGroupPass groupId={groupId} initial={pass} />
    </div>
  );
}
