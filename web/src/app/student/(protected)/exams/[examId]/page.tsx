import { notFound } from "next/navigation";
import { getExamPass } from "./actions";
import { ExamPass } from "@/components/student/exam-pass";

export default async function StudentExamPassPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const pass = await getExamPass(examId);

  if (!pass.ok) notFound();

  return (
    <div className="mx-auto w-full max-w-md">
      <ExamPass examId={examId} initial={pass} />
    </div>
  );
}
