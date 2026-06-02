import { redirect } from "next/navigation"

export default function LegacyLoginLogsPage() {
  redirect("/dashboard/audit?action=login")
}
