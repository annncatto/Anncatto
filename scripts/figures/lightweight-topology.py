"""Generate an educational simply-supported SIMP beam; NumPy, SciPy, Matplotlib.
Method reference: Sigmund (2001), DOI 10.1007/s001580050176.
Q4 plane-stress elements assembled by 2x2 Gauss integration; sensitivity filter;
optimality-criteria volume update. Unitless E=1, load=1, thickness=1.
"""
from pathlib import Path
import json
from PIL import Image
import io
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import spsolve
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
nx,ny,volume,penal,rmin=120,36,.4,3,2.2
nu=.3;C=np.array([[1,nu,0],[nu,1,0],[0,0,(1-nu)/2]])/(1-nu*nu)
ke=np.zeros((8,8));corners=np.array([[-1,-1],[1,-1],[1,1],[-1,1]])
for xi in [-1/np.sqrt(3),1/np.sqrt(3)]:
 for eta in [-1/np.sqrt(3),1/np.sqrt(3)]:
  dx=corners[:,0]*(1+corners[:,1]*eta)/2;dy=corners[:,1]*(1+corners[:,0]*xi)/2
  B=np.zeros((3,8));B[0,0::2]=dx;B[1,1::2]=dy;B[2,0::2]=dy;B[2,1::2]=dx;ke+=B.T@C@B/4
nodes=np.arange((nx+1)*(ny+1)).reshape(nx+1,ny+1)
conn=np.array([[nodes[x,y],nodes[x+1,y],nodes[x+1,y+1],nodes[x,y+1]] for x in range(nx) for y in range(ny)])
dofs=(2*conn[:,:,None]+np.arange(2)).reshape(-1,8);nd=2*nodes.size
iK=np.repeat(dofs,8,axis=1).ravel();jK=np.tile(dofs,(1,8)).ravel()
fixed=np.array([2*nodes[0,0],2*nodes[0,0]+1,2*nodes[-1,0]+1]);free=np.setdiff1d(np.arange(nd),fixed)
f=np.zeros(nd);f[2*nodes[nx//2,ny]+1]=-1
rr=[];cc=[];vv=[]
for ix in range(nx):
 for iy in range(ny):
  e=ix*ny+iy
  for jx in range(max(0,ix-2),min(nx,ix+3)):
   for jy in range(max(0,iy-2),min(ny,iy+3)):
    v=max(0,rmin-np.hypot(ix-jx,iy-jy))
    if v:rr.append(e);cc.append(jx*ny+jy);vv.append(v)
H=coo_matrix((vv,(rr,cc)),shape=(nx*ny,nx*ny)).tocsr();Hs=np.asarray(H.sum(1)).ravel()
x=np.full(nx*ny,volume);history=[];saved={};frames=[];out=Path('content/images/lightweight');out.mkdir(exist_ok=True)
for iteration in range(81):
 E=x**penal
 K=coo_matrix((np.einsum('i,j->ij',E,ke.ravel()).ravel(),(iK,jK)),shape=(nd,nd)).tocsc();u=np.zeros(nd);u[free]=spsolve(K[free,:][:,free],f[free])
 ce=np.einsum('ei,ij,ej->e',u[dofs],ke,u[dofs]);compliance=float(E@ce);residual=float(np.linalg.norm((K@u-f)[free]));history.append({'iteration':iteration,'compliance':compliance,'volume':float(x.mean()),'free_residual':residual})
 if iteration % 2 == 0 or iteration in [0,15,40,80]:
  saved[iteration]=x.copy();fig,ax=plt.subplots(figsize=(9,3.5),dpi=200);ax.imshow(x.reshape(nx,ny).T,cmap='Blues',origin='lower',vmin=0,vmax=1,extent=[0,nx,0,ny],interpolation='nearest')
  ax.annotate('F',xy=(nx/2,ny),xytext=(nx/2,ny+9),ha='center',fontsize=13,color='#245f7e',arrowprops={'arrowstyle':'-|>','color':'#245f7e','lw':1.7})
  ax.plot([0,nx],[0,0],'^',ms=10,color='#6bb493',clip_on=False);ax.plot([nx-.8,nx+.8],[-2,-2],'o',ms=2,color='#6bb493',clip_on=False)
  ax.set_xlim(-4,nx+4);ax.set_ylim(-5,ny+13);ax.axis('off');fig.tight_layout(pad=.3);
  if iteration in [0,15,40,80]:fig.savefig(out/f'topology-{iteration:02}.png',facecolor='white')
  if iteration%2==0:
   ax.text(2,ny+8,f'SIMP · iteration {iteration} · volume 40%',fontsize=10,color='#245f7e')
   buf=io.BytesIO();fig.savefig(buf,format='png',facecolor='white');buf.seek(0);im=Image.open(buf).convert('RGB');im.thumbnail((900,350));frames.append(im.copy())
  plt.close(fig)
 if iteration==80:break
 dc=-penal*x**(penal-1)*ce;dc=np.asarray(H@(x*dc))/Hs/np.maximum(.001,x)
 lo,hi=0.,1e9
 for _ in range(100):
  mid=(lo+hi)/2;candidate=np.clip(x*np.sqrt(np.maximum(0,-dc/mid)),np.maximum(.001,x-.2),np.minimum(1,x+.2))
  if candidate.mean()>volume:lo=mid
  else:hi=mid
  if (hi-lo)/(hi+lo+1e-30)<1e-5:break
 x=candidate
assert history[-1]['compliance']<history[0]['compliance']
assert max(h['free_residual'] for h in history)<1e-7
assert abs(x.mean()-volume)<1e-4
Path('content/images/lightweight/topology-results.json').write_text(json.dumps({'mesh':[nx,ny],'volume_fraction':volume,'penalty':penal,'filter_radius':rmin,'history':history},indent=2)+'\n')
print(json.dumps({'initial':history[0],'final':history[-1]}))

frames[0].save(out/'topology-evolution.gif',save_all=True,append_images=frames[1:],duration=[600]+[140]*(len(frames)-2)+[1800],loop=0,optimize=True)
