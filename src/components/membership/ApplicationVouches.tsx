import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { callRpc } from '@/lib/rpc';
type Vouch={member_id:string;name:string;note:string;created_at:string};
export function ApplicationVouches({applicantId}:{applicantId:string}){
 const [rows,setRows]=useState<Vouch[]|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;setRows(null);setError(false);callRpc<Vouch[]>('membership_vouches_for_review',{p_applicant:applicantId}).then(r=>{if(!cancelled)setRows(r);}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;};},[applicantId]);
 return <section className="mt-5 border-t border-border pt-4" aria-label="Application vouches"><h4 className="font-medium">Application vouches</h4>
 {error?<p role="alert">Could not load vouches.</p>:rows===null?<p>Loading vouches…</p>:rows.length===0?<p className="mt-2 text-sm text-muted-foreground">No additional vouches yet.</p>:<ul className="mt-3 space-y-4">{rows.map(v=><li key={v.member_id}><Link className="text-primary underline" to={`/profile/${v.member_id}`}>{v.name}</Link><p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</p>{v.note&&<p className="mt-1 whitespace-pre-wrap break-words text-sm">{v.note}</p>}</li>)}</ul>}
 </section>;
}
