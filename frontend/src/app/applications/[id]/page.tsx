import { ApplicationWorkspacePage } from "@/components/dashboard/application-workspace-page";

export default async function ApplicationDetails({
  params,
}: PageProps<"/applications/[id]">) {
  const { id } = await params;
  return <ApplicationWorkspacePage applicationId={id} />;
}
