import { redirect } from "next/navigation";

export default async function ReportRedirectPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/attempt/${id}`);
}
