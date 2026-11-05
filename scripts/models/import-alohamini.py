"""Extract the authoritative left-arm URDF without modifying the source repo.

Uses NumPy from the existing alohamini environment. Display meshes retain every
STL triangle and float32 vertex; only identical positions are welded in GLB.
"""
from pathlib import Path
import argparse, hashlib, json, struct, shutil, xml.etree.ElementTree as ET
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path.home()/'Alohamini');a=p.parse_args()
repo=Path(__file__).resolve().parents[2];model=a.source/'models/alohamini2pro';source=model/'urdf/alohamini2pro.urdf';tree=ET.parse(source).getroot();out=repo/'public/models/alohamini-left';out.mkdir(parents=True,exist_ok=True)
links={e.attrib['name']:e for e in tree.findall('link')};joints=tree.findall('joint');names=['left_Base'];selected=[]
for name in names:
 for j in joints:
  if j.find('parent').attrib['link']==name:
   selected.append(j);names.append(j.find('child').attrib['link'])
vec=lambda e,key,default: [float(v) for v in e.attrib.get(key,default).split()] if e is not None else [float(v) for v in default.split()]
desc=[];meshes=[];nodes=[];views=[];accessors=[];buffer=bytearray();manifest={'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'mesh_processing':'lossless float32 position welding; all triangles preserved; vertex normals computed for display','links':{}}
def append(data,target):
 while len(buffer)%4:buffer.append(0)
 i=len(views);views.append({'buffer':0,'byteOffset':len(buffer),'byteLength':len(data),'target':target});buffer.extend(data);return i
urdf=ET.Element('robot',{'name':'alohamini_left'})
for name in names:
 link=links[name];urdf.append(ET.fromstring(ET.tostring(link)));inertial=link.find('inertial');mass=float(inertial.find('mass').attrib['value']) if inertial is not None else 0
 origin=inertial.find('origin') if inertial is not None else None;I=inertial.find('inertia').attrib if inertial is not None else {}
 assert vec(origin,'rpy','0 0 0')==[0,0,0], 'Rotate nonzero inertial-frame tensors before importing'
 data={'name':name,'mass':mass,'com':vec(origin,'xyz','0 0 0'),'inertia':[float(I.get(k,0)) for k in ['ixx','iyy','izz','ixy','ixz','iyz']]}
 joint=next((j for j in selected if j.find('child').attrib['link']==name),None)
 if joint is not None:
  o=joint.find('origin');limit=joint.find('limit');data.update(parent=joint.find('parent').attrib['link'],joint=joint.attrib['name'],kind=joint.attrib['type'],offset=vec(o,'xyz','0 0 0'),rpy=vec(o,'rpy','0 0 0'),axis=vec(joint.find('axis'),'xyz','0 0 1'),limits={k:float(v) for k,v in limit.attrib.items()} if limit is not None else {})
 else:data.update(parent=None,offset=[0,0,0],rpy=[0,0,0],kind='fixed')
 visual=link.find('visual');mesh=visual.find('geometry/mesh') if visual is not None else None
 if mesh is not None:
  filename=mesh.attrib['filename'];path=model/'meshes/visual'/Path(filename).name;raw=path.read_bytes();count=struct.unpack_from('<I',raw,80)[0];tri=np.frombuffer(raw,dtype=np.dtype([('normal','<f4',(3,)),('vertex','<f4',(3,3)),('attr','<u2')]),count=count,offset=84)
  verts,indices=np.unique(tri['vertex'].reshape(-1,3),axis=0,return_inverse=True);verts=verts.astype('<f4');indices=indices.astype('<u4');vmin=verts.min(axis=0).tolist();vmax=verts.max(axis=0).tolist()
  pos=len(accessors);accessors.append({'bufferView':append(verts.tobytes(),34962),'componentType':5126,'count':len(verts),'type':'VEC3','min':vmin,'max':vmax});ind=len(accessors);accessors.append({'bufferView':append(indices.tobytes(),34963),'componentType':5125,'count':len(indices),'type':'SCALAR'})
  meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':pos},'indices':ind}]});nodes.append({'name':name,'mesh':len(meshes)-1});o=visual.find('origin');data['visual']={'origin':vec(o,'xyz','0 0 0'),'rpy':vec(o,'rpy','0 0 0'),'min':vmin,'max':vmax,'mesh':name}
  manifest['links'][name]={'source_file':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':count,'vertices':len(verts),'min':vmin,'max':vmax}
 desc.append(data)
for j in selected:urdf.append(ET.fromstring(ET.tostring(j)))
ET.indent(urdf);ET.ElementTree(urdf).write(out/'source.urdf',encoding='utf-8',xml_declaration=True)
gltf={'asset':{'version':'2.0','generator':'Anncatto lossless STL importer'},'scenes':[{'nodes':list(range(len(nodes)))}],'scene':0,'nodes':nodes,'meshes':meshes,'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':len(buffer)}]}
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buffer.extend(b'\0'*((-len(buffer))%4));glb=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buffer))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buffer),0x004e4942)+buffer;(out/'arm.glb').write_bytes(glb)
(out/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for name in ['LICENSE','NOTICE']:
 if (a.source/name).is_file():shutil.copy2(a.source/name,out/name)
(repo/'src/aloha-description.ts').write_text('// Generated by scripts/models/import-alohamini.py; SI units, source inertia tensors.\nexport const alohaDescription='+json.dumps(desc,separators=(',',':'))+' as const;\n')
shutil.copy2(a.source/'ros2/src/alohamini_validation/config/fk_golden.yaml',out/'fk-golden.yaml')
print(json.dumps({'links':len(desc),'mass':sum(d['mass'] for d in desc),'triangles':sum(d['triangles'] for d in manifest['links'].values()),'glb_bytes':len(glb)}))
