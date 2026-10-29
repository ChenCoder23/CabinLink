import CabinetWorkspace from "@/components/cabinet-workspace";
export default async function CabinetPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <CabinetWorkspace token={token} />; }
