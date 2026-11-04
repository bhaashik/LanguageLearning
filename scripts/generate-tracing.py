"""Create practice centerlines from local, clean glyph PNGs. No handwriting claims.
Input is rendered with the bundled font by scripts/render-tracing.py.
Requires Python, NumPy, SciPy, Pillow (development only).
"""
import argparse
from collections import defaultdict, deque
import heapq
import json
from pathlib import Path
import numpy as np
from PIL import Image


def thin(binary):
    image=np.pad(binary.astype(bool),1)
    while True:
        removed=0
        for phase in (0,1):
            p=[np.roll(image,1,0),np.roll(np.roll(image,1,0),-1,1),np.roll(image,-1,1),np.roll(np.roll(image,-1,0),-1,1),np.roll(image,-1,0),np.roll(np.roll(image,-1,0),1,1),np.roll(image,1,1),np.roll(np.roll(image,1,0),1,1)]
            count=sum(n.astype(np.uint8) for n in p)
            transitions=sum((~p[i]&p[(i+1)%8]).astype(np.uint8) for i in range(8))
            a,b=(p[0]&p[2]&p[4],p[2]&p[4]&p[6]) if phase==0 else (p[0]&p[2]&p[6],p[0]&p[4]&p[6])
            remove=image&(count>=2)&(count<=6)&(transitions==1)&~a&~b
            removed+=int(remove.sum());image[remove]=False
        if not removed:return image[1:-1,1:-1]


def graph_of(mask):
    nodes={tuple(p) for p in np.argwhere(mask)}
    graph={p:set() for p in nodes}
    for y,x in nodes:
        for dy,dx in [(0,1),(1,0),(1,1),(1,-1)]:
            q=(y+dy,x+dx)
            if q not in nodes:continue
            if dy and dx and ((y,x+dx) in nodes or (y+dy,x) in nodes):continue
            graph[(y,x)].add(q);graph[q].add((y,x))
    return graph


def prune(graph):
    # Remove short medial-axis spurs caused by typographic thickness and terminals.
    for _ in range(4):
        drop=set()
        for start in list(graph):
            if len(graph[start])!=1:continue
            path=[start];prev=None;cur=start
            while True:
                nxt=[q for q in graph[cur] if q!=prev]
                if len(nxt)!=1:break
                prev,cur=cur,nxt[0];path.append(cur)
                if len(graph[cur])!=2:break
            if len(path)<=7 and len(graph[cur])>=3:drop.update(path[:-1])
        if not drop:break
        for p in drop:
            for q in graph[p]:graph[q].discard(p)
            del graph[p]
    return graph


def shortest(graph,start):
    dist={start:0};parent={};heap=[(0,start)]
    while heap:
        cost,p=heapq.heappop(heap)
        if cost!=dist[p]:continue
        for q in graph[p]:
            value=cost+(2**.5 if p[0]!=q[0] and p[1]!=q[1] else 1)
            if value<dist.get(q,float('inf')):
                dist[q]=value;parent[q]=p;heapq.heappush(heap,(value,q))
    return dist,parent


def continuous_walk(graph):
    odd=[p for p in graph if len(graph[p])%2]
    paths={p:shortest(graph,p) for p in odd}
    # Keep the furthest odd endpoints open; pair remaining endpoints with short retraces.
    endpoints=max(((paths[a][0].get(b,0),a,b) for a in odd for b in odd if a!=b),default=None)
    start=min((endpoints[1],endpoints[2]),key=lambda p:(p[1],p[0])) if endpoints else min(graph,key=lambda p:(p[0],p[1]))
    remaining=set(odd)-({endpoints[1],endpoints[2]} if endpoints else set())
    edges=defaultdict(lambda:defaultdict(int))
    for p,ns in graph.items():
        for q in ns:edges[p][q]=1
    while remaining:
        a=min(remaining);remaining.remove(a)
        b=min(remaining,key=lambda p:paths[a][0][p]);remaining.remove(b)
        cur=b;parent=paths[a][1]
        while cur!=a:
            prev=parent[cur];edges[prev][cur]+=1;edges[cur][prev]+=1;cur=prev
    stack=[start];walk=[]
    while stack:
        cur=stack[-1];available=[q for q,n in edges[cur].items() if n]
        if available:
            nxt=min(available);edges[cur][nxt]-=1;edges[nxt][cur]-=1;stack.append(nxt)
        else:walk.append(stack.pop())
    return list(reversed(walk))


def simplify(points,tolerance=1.0):
    if len(points)<3:return points
    a,b=np.array(points[0],dtype=float),np.array(points[-1],dtype=float)
    line=b-a;length=np.dot(line,line)
    p=np.array(points,dtype=float)
    nearest=a+np.clip((p-a)@line/length if length else np.zeros(len(p)),0,1)[:,None]*line
    distances=np.linalg.norm(p-nearest,axis=1);index=int(distances.argmax())
    if distances[index]<=tolerance:return [points[0],points[-1]]
    return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)


def build(folder):
    result={}
    for item in json.loads((folder/'items.json').read_text()):
        mask=np.array(Image.open(folder/(item['id']+'.png')).convert('L'))<160
        graph=prune(graph_of(thin(mask)));seen=set();paths=[]
        for root in sorted(graph):
            if root in seen:continue
            queue=[root];component=set()
            while queue:
                p=queue.pop()
                if p in component:continue
                component.add(p);queue.extend(graph[p]-component)
            seen.update(component)
            if len(component)<3:continue
            sub={p:graph[p]&component for p in component}
            walk=continuous_walk(sub)
            points=simplify([(int(x)*2,int(y)*2) for y,x in walk])
            if len(points)>1:paths.append(points)
        paths.sort(key=lambda p:(min(x for x,y in p),min(y for x,y in p)))
        if not paths:raise ValueError('No guide for '+item['id'])
        result[item['id']]={'ml':item['ml'],'paths':paths,'suggestedStrokes':len(paths),'source':'font-derived practice guide','reviewed':False}
    return {'version':1,'width':800,'height':400,'font':'Noto Sans Malayalam Regular','note':'Suggested practice centerlines, not verified handwriting stroke order. Connected paths may retrace. Detached marks remain separate.','guides':result}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('references',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
    data=build(args.references);args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    counts=defaultdict(int)
    for g in data['guides'].values():counts[g['suggestedStrokes']]+=1
    print('Generated',len(data['guides']),'practice guides. Suggested strokes:',dict(sorted(counts.items())))
