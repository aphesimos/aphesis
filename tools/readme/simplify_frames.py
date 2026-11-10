import json,re,numpy as np,sys
d=json.load(open('engine_frames.json'))
def rdp(P,eps):
    if len(P)<3: return P
    a,b=P[0],P[-1]; ab=b-a; n=np.hypot(*ab) or 1
    dist=np.abs(ab[0]*(P[:,1]-a[1])-ab[1]*(P[:,0]-a[0]))/n; i=int(np.argmax(dist))
    if dist[i]>eps: return np.vstack([rdp(P[:i+1],eps)[:-1],rdp(P[i:],eps)])
    return np.array([a,b])
def simp(path,eps):
    out=[]
    for sub in re.findall(r'M[^M]*',path):
        P=np.array(list(map(float,re.findall(r'-?\d+\.?\d*',sub)))).reshape(-1,2)
        if len(P)<3: continue
        # a closed outline starts and ends side by side: split it at the point farthest from the start, simplify both halves
        k=int(np.argmax(np.hypot(*(P-P[0]).T)))
        Q=np.vstack([rdp(P[:k+1],eps)[:-1],rdp(P[k:],eps)]) if 0<k<len(P)-1 else rdp(P,eps)
        Q=np.round(Q).astype(int)
        out.append('M%d %d'%tuple(Q[0])+''.join('l%d %d'%tuple(q) for q in np.diff(Q,axis=0))+'z')
    return ''.join(out)
eps=float(sys.argv[1]) if len(sys.argv)>1 else 1.0
fr=[simp(p,eps) for p in d['frames']]
print(len(fr), sum(map(len,fr))//1024,'KB')
json.dump({'dur':d['dur'],'frames':fr,'viewBox':d['viewBox']},open('engine_frames_s.json','w'))
