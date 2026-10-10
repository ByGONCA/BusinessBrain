import { redirect } from "next/navigation";

export default async function BillingSettingsPage() {
  redirect("/dashboard?settings=billing");
}
