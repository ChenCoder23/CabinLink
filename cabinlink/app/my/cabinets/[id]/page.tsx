import CabinetWorkspace from "@/components/cabinet-workspace";
export default async function OwnedCabinetPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CabinetWorkspace ownerCabinetId={id} />; }
