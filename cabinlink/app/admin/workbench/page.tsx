import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { workbenchUser } from '@/lib/personal-server';
import Workbench from '@/components/study-workbench';
export const dynamic = 'force-dynamic';
export default async function AdminWorkbench() {
    const incoming = await headers();
    const request = new Request('http://localhost/admin/workbench', {headers: {cookie: incoming.get('cookie') || ''}});
    if (!await workbenchUser(request)) notFound();
    return <Workbench/>;
}
