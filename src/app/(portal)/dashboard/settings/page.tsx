import { redirect } from "next/navigation";

export default function ClientSettingsIndex() {
  redirect("/settings/profile");
}
