import { redirect } from "next/navigation";

export default async function ReportRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/attempt/${params.id}`);
}
