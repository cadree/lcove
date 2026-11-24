import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { callRpc } from '@/lib/rpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EtherWordmark } from '@/components/brand/EtherWordmark';

export default function MembershipVouch(){
 const {token=''}=useParams(); const {user,loading}=useAuth();
 const [context,setContext]=useState<{name:string;already_vouched:boolean}|null>(null);
 const [error,setError]=useState(''); const [note,setNote]=useState(''); const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!user)return;let cancelled=false;
  callRpc<{name:string;already_vouched:boolean}>('membership_vouch_context',{p_token:token}).then(c=>{if(!cancelled)setContext(c);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};
 },[user,token]);
 const submit=async()=>{if(busy)return;setBusy(true);setError('');try{await callRpc('submit_membership_vouch',{p_token:token,p_note:note});setContext(c=>c?{...c,already_vouched:true}:c);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}};
 return <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
  <EtherWordmark className="mx-auto mb-10 w-44"/>
  <h1 className="font-display text-3xl">Vouch for a creative</h1>
  {loading?<p>Loading…</p>:!user?<><p className="my-5 text-muted-foreground">Sign in as an approved ETHER member to support this application. Your name and note will be visible to admins.</p><Button asChild><Link to={`/auth?redirect=${encodeURIComponent('/vouch/'+token)}`}>Sign in to vouch</Link></Button></>:context?.already_vouched?<p role="status" className="my-5">Your vouch for {context.name} is recorded. Admins can see it while reviewing their application.</p>:context?<>
   <p className="my-5">You’re vouching for <strong>{context.name}</strong>. Only vouch if you personally know their creative work. This supports their review; it does not approve membership.</p>
   <label htmlFor="vouch-note">How do you know their work? (optional)</label><Textarea id="vouch-note" maxLength={280} value={note} onChange={e=>setNote(e.target.value)} className="my-3"/>
   <Button disabled={busy} onClick={()=>void submit()}>{busy?'Saving…':'Vouch for this creative'}</Button>
  </>:!error?<p>Loading request…</p>:null}
  {error&&<p role="alert" className="my-4 text-destructive">{error}</p>}
  <Link className="mt-8 text-sm underline" to="/">Return to ETHER</Link>
 </main>;
}
