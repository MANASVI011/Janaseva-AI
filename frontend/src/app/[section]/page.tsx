import { notFound } from "next/navigation";
import { SectionPage } from "@/components/dashboard/section-page";
import { sectionLabels, type ApplicationStatus } from "@/lib/dashboard-i18n";

const validSections = new Set(Object.keys(sectionLabels));
const validStatuses: readonly ApplicationStatus[] = [
  "review",
  "documents",
  "field",
  "approved",
  "returned",
];

function isApplicationStatus(value: string): value is ApplicationStatus {
  return validStatuses.some((status) => status === value);
}

export default async function DashboardSection({
  params,
  searchParams,
}: PageProps<"/[section]">) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (!validSections.has(section)) notFound();

  const requestedStatus = query.status;
  const initialStatus =
    typeof requestedStatus === "string" && isApplicationStatus(requestedStatus)
      ? requestedStatus
      : "all";

  return <SectionPage section={section} initialStatus={initialStatus} />;
}
