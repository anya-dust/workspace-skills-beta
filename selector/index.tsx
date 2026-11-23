import { useState } from 'react';
import { FrameRoot } from '@dust/frame';
import { useFrameFunctionMutation } from '@dust/react-hooks';
export default function App(){
 const [selected,setSelected]=useState(false); const [status,setStatus]=useState('');
 const check=useFrameFunctionMutation('check-setup');
 async function choose(value:boolean){setSelected(value);setStatus('');if(!value)return;try{const result=await check.trigger({}) as {message:string};setStatus(result.message);}catch{setStatus('Setup check unavailable. Ask a workspace admin to check your role and connections in Dust. Nothing was installed.');}}
 return <FrameRoot className="min-h-screen bg-background text-foreground"><main className="mx-auto max-w-2xl space-y-6 px-5 py-8"><h1 className="text-2xl font-semibold">Choose pilot skills</h1><p>Select a skill to check its setup requirements. This won’t install anything.</p><section className="space-y-3 border-y border-border py-5"><label className="flex items-center gap-3 text-lg font-semibold"><input type="checkbox" checked={selected} disabled={check.isMutating} onChange={e=>void choose(e.target.checked)}/>Frank’s account map</label><p>Map a company’s contacts, deal roles and reporting lines in a Dust Pod.</p><p className="text-sm"><strong>Required:</strong> workspace admin for setup, a writable Pod and a people-search connection for research.</p><p className="text-sm"><strong>Optional:</strong> LinkedIn for gaps; CRM, calendar and email for existing relationships.</p></section>{selected && <p role="status" className="border-l-2 border-primary pl-3">{check.isMutating?'Checking your workspace role…':status}</p>}</main></FrameRoot>;
}
