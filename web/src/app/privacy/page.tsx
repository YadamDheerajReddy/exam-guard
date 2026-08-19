import Link from "next/link";
import { Logo } from "@/components/logo";
import { ShieldCheck } from "lucide-react";

const LAST_UPDATED = "19 August 2026";
const PLATFORM_CONTACT = process.env.GMAIL_USER ?? "privacy@examguard.internal";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-charcoal">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="inline-flex items-center gap-2">
        <Logo size={22} withWordmark />
      </Link>

      <div className="mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
        <ShieldCheck className="size-4" strokeWidth={2} />
        Privacy Policy
      </div>
      <h1 className="mt-2 text-2xl font-bold text-ink">How ExamGuard handles your personal data</h1>
      <p className="mt-1 text-xs text-slate">Last updated {LAST_UPDATED} · Governed by India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act)</p>

      <Section title="Who this applies to">
        <p>
          ExamGuard is exam-allocation and identity-verification software used by educational institutions
          (&quot;institutions&quot;) to manage exam halls, seating, and attendance verification for their own
          students, invigilators, and staff.
        </p>
        <p>
          Under the DPDP Act, each institution using ExamGuard is the <strong>Data Fiduciary</strong> for its
          own students and staff — it decides why and how their personal data is processed, and is responsible
          for having lawful basis (including parental consent for any student who is a minor) before enrolling
          them. ExamGuard acts as the <strong>Data Processor</strong>: we process data only on an institution&apos;s
          instructions, through the product, and never independently sell, share, or repurpose it.
        </p>
      </Section>

      <Section title="What we collect, and why">
        <p>For students: full name, roll number, institutional email, department, and a photo used solely to let an invigilator visually confirm identity at the exam hall door. For an exam: hall, seat, and schedule assignment.</p>
        <p>For invigilators and institution admins: full name and institutional email, used to authenticate them and scope their access to their own institution&apos;s data.</p>
        <p>Verification records: a timestamped log of each identity check at the hall (who, when, which invigilator, outcome) — kept as the institution&apos;s audit trail for exam integrity and dispute resolution, and to satisfy the Act&apos;s own accountability requirements.</p>
        <p>We do not collect biometric templates, do not track location or behavior outside the product, and do not use any of this data for advertising.</p>
      </Section>

      <Section title="Consent">
        <p>
          Because students and staff are enrolled by their institution rather than signing up directly, the
          institution is responsible for informing them (and, for minors, their parents/guardians) about this
          processing and obtaining the necessary consent before uploading their data — this is a condition
          every institution affirms when they set up their ExamGuard account.
        </p>
        <p>Consent can be withdrawn at any time by contacting your institution&apos;s administrator, who can deactivate or remove your account.</p>
      </Section>

      <Section title="Security">
        <p>Practical measures already built into the product:</p>
        <ul className="ml-4 list-disc">
          <li>Row-level database security scoping every institution&apos;s data to itself — no cross-institution access is possible even at the database layer.</li>
          <li>Photos are stored in private object storage and only ever served via short-lived signed links, never a public URL.</li>
          <li>Exam pass barcodes rotate every 90 seconds and are cryptographically signed — a screenshot stops working almost immediately.</li>
          <li>Password reset links are single-use, expire in 30 minutes, and are stored as a one-way hash — even a database compromise can&apos;t be turned into a working reset link.</li>
          <li>The verification audit trail is append-only: corrections are recorded as new entries referencing the original, never edits or deletions, so the record can&apos;t be silently altered.</li>
        </ul>
        <p>If a security incident affects personal data, we will notify the affected institution(s) without undue delay so they can meet their own notification obligations to the Data Protection Board of India and their Data Principals.</p>
      </Section>

      <Section title="Retention">
        <p>
          Exam and verification records are retained for the institution&apos;s exam cycle plus a reasonable
          period afterward for audit and dispute-resolution purposes, after which an institution may request
          their deletion. A student or staff member may request earlier deletion of their own data at any
          time (see below) — an institution may decline a request while a specific record is still needed to
          resolve an active dispute, consistent with the Act&apos;s own retention exceptions.
        </p>
      </Section>

      <Section title="Your rights as a Data Principal">
        <p>Under the DPDP Act you have the right to:</p>
        <ul className="ml-4 list-disc">
          <li><strong>Access</strong> a summary of the personal data held about you.</li>
          <li><strong>Correct</strong> inaccurate or outdated data.</li>
          <li><strong>Erase</strong> your data once it&apos;s no longer needed for the purpose it was collected for.</li>
        </ul>
        <p>
          Students can view their own stored data and submit any of these requests directly from the{" "}
          <strong>Privacy</strong> page inside the Student Portal. Admins and invigilators can request the
          same by contacting their institution&apos;s administrator or Grievance Officer directly.
        </p>
      </Section>

      <Section title="Children's data">
        <p>
          Some institutions on ExamGuard are schools whose students are minors. For those institutions we
          require verifiable parental/guardian consent to be obtained by the institution before a minor&apos;s
          data is uploaded, and we do not permit behavioral tracking or targeted advertising involving any
          student account, minor or otherwise.
        </p>
      </Section>

      <Section title="Grievance redressal">
        <p>
          Each institution publishes its own designated Grievance Officer&apos;s contact details to its students
          inside the Student Portal, as required under the Act. For matters concerning ExamGuard itself as
          the Data Processor, contact:
        </p>
        <p className="font-mono text-xs text-ink">{PLATFORM_CONTACT}</p>
      </Section>

      <Section title="Regulatory body">
        <p>
          The DPDP Act, 2023 is enforced by the Data Protection Board of India. This policy will be updated as
          the Act&apos;s rules and compliance timelines (final compliance across all provisions is scheduled by
          13 May 2027) come into effect.
        </p>
      </Section>
    </main>
  );
}
