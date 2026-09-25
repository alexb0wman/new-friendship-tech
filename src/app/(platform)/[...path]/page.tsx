import { Platform } from "@/components/platform";
export default async function Page({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <Platform path={path} />;
}
