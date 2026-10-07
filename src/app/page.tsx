import { getDailyRows } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export default async function Page() {
  const rows = await getDailyRows();
  return <Dashboard rows={rows} />;
}
