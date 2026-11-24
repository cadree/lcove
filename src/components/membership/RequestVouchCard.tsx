import { publicWebOrigin } from "@/lib/appWebOrigin";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callRpc } from '@/lib/rpc';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function RequestVouchCard() {
 const { user } = useAuth();
 const [link,setLink] = useState('');
 const [error,setError] = useState('');
 const [attempt,setAttempt] = useState(0);
 useEffect(()=>{
  if(!user) return;
  let cancelled=false;
  setError('');
  const origin=publicWebOrigin();
  if(!origin){setError('Vouch links are not set up for this version of the app.');return;}
  callRpc<string>('get_my_membership_vouch_link').then(token=>{
   if(!cancelled) setLink(`${origin}/vouch/${token}`);
  }).catch(()=>{if(!cancelled) setError('Could not prepare your vouch link. Please retry.');});
  return ()=>{cancelled=true;};
 },[user,attempt]);
 const copy=async()=>{try{await navigator.clipboard.writeText(link);toast.success('Vouch link copied');}catch{toast.info('Select and copy the link below.');}};
 return <section className="file-panel my-6 w-full rounded-2xl p-5 text-left" aria-label="Ask a creative to vouch">
  <h2 className="font-display text-xl">Ask a creative to vouch</h2>
  <p className="mt-2 text-sm text-muted-foreground">Know an approved ETHER member? Send them this link to support your application. Admins will see who vouched for you. A vouch is optional and does not guarantee approval.</p>
  {error ? <><p role="alert" className="mt-3 text-sm">{error}</p><Button onClick={()=>setAttempt(n=>n+1)}>Retry</Button></> : !link ? <p role="status">Preparing your link…</p> : <>
   <Input className="mt-4" aria-label="Your vouch request link" value={link} readOnly onFocus={e=>e.currentTarget.select()}/>
   <div className="mt-3 flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>void copy()}>Copy link</Button><Button className="flex-1" onClick={()=>{
    if(!navigator.share){void copy();return;}
    void navigator.share({title:'Vouch for my ETHER application',text:'If you know my creative work, you can support my ETHER application.',url:link}).catch(e=>{if(e.name!=='AbortError')toast.error('Could not share. Copy the link instead.');});
   }}>Share</Button></div>
  </>}
 </section>;
}
