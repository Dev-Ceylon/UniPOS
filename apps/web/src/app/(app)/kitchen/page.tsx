import { requireContext } from "@/lib/context";
import { KitchenDisplay } from "./kds";

export const metadata = { title: "Kitchen display" };

export default async function KitchenPage() {
  await requireContext("restaurant.use", "restaurant");
  return <KitchenDisplay />;
}
