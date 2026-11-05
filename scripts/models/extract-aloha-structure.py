"""Read native CAD solids; report exact planar area properties, not beam validation.
Run with the existing /home/anncatto/miniconda3/envs/alohamini/bin/python.
Input B-reps and source transforms are read-only. All lengths below are mm unless
explicitly named otherwise. No mesh bounding box is used as a section.
"""
from pathlib import Path
import argparse,hashlib,json,math,sys,xml.etree.ElementTree as ET
import numpy as np
from OCP.BRep import BRep_Builder
from OCP.BRepTools import BRepTools,BRepTools_WireExplorer
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace,BRepBuilderAPI_Transform
from OCP.BRepGProp import BRepGProp
from OCP.BRepAdaptor import BRepAdaptor_Surface,BRepAdaptor_Curve
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.GProp import GProp_GProps
from OCP.GeomAbs import GeomAbs_Plane,GeomAbs_Cylinder
from OCP.TopAbs import TopAbs_FACE,TopAbs_SOLID,TopAbs_WIRE,TopAbs_REVERSED
from OCP.GCPnts import GCPnts_UniformDeflection,GCPnts_QuasiUniformDeflection
from OCP.TopExp import TopExp_Explorer
from OCP.TopTools import TopTools_ListOfShape
from OCP.TopoDS import TopoDS,TopoDS_Shape
from OCP.gp import gp_Pnt,gp_Dir,gp_Ax3,gp_Pln,gp_Trsf

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def entities(shape,kind):
    exp=TopExp_Explorer(shape,kind);out=[]
    while exp.More():out.append(exp.Current());exp.Next()
    return out

def read_brep(path):
    shape=TopoDS_Shape()
    if not BRepTools.Read_s(shape,str(path),BRep_Builder()):raise ValueError('B-rep read failed: '+str(path))
    if not BRepCheck_Analyzer(shape).IsValid():raise ValueError('Invalid input B-rep')
    if len(entities(shape,TopAbs_SOLID))!=1:raise ValueError('Expected one individual CAD solid')
    return shape

def transformed(shape,matrix):
    t=gp_Trsf();t.SetValues(*np.asarray(matrix)[:3,:4].reshape(-1).tolist())
    return BRepBuilderAPI_Transform(shape,t,True).Shape()

def basis_for(normal):
    n=np.array(normal,dtype=float,copy=True);n/=np.linalg.norm(n)
    ref=np.array([0.,0.,1.]) if abs(n[2])<.9 else np.array([1.,0.,0.])
    u=ref-n*np.dot(ref,n);u/=np.linalg.norm(u);v=np.cross(n,u)
    return n,u,v

def planar_section_properties(shape,point_mm,normal,in_plane_u=None,window_mm=1000,with_boundaries=False,boundary_deflection_mm=.002):
    """Boolean solid/plane intersection and surface integration; holes stay holes.
    Inputs: one valid B-rep solid in mm, plane point/normal, optional in-plane u.
    Area inertia is central about u/v; Iuv is integral(u*v dA), NOT its negative.
    polar_area_moment_mm4 is NOT a Saint-Venant torsion constant.
    """
    n,u,v=basis_for(normal)
    if in_plane_u is not None:
        u=np.array(in_plane_u,dtype=float,copy=True);u-=n*np.dot(u,n);u/=np.linalg.norm(u);v=np.cross(n,u)
    plane=gp_Pln(gp_Ax3(gp_Pnt(*map(float,point_mm)),gp_Dir(*n.tolist()),gp_Dir(*u.tolist())))
    face=BRepBuilderAPI_MakeFace(plane,-window_mm,window_mm,-window_mm,window_mm).Face()
    arguments=TopTools_ListOfShape();arguments.Append(shape)
    cutting_tools=TopTools_ListOfShape();cutting_tools.Append(face)
    op=BRepAlgoAPI_Common();op.SetArguments(arguments);op.SetTools(cutting_tools)
    op.SetNonDestructive(True);op.Build()
    if not op.IsDone():raise RuntimeError('Solid/plane boolean failed')
    section=op.Shape();faces=[TopoDS.Face_s(x) for x in entities(section,TopAbs_FACE)]
    if not faces:return {'area_mm2':0.,'Iu_mm4':0.,'Iv_mm4':0.,'Iuv_mm4':0.,'has_material':False,'centroid_link_mm':None,'face_count':0,'closed_wire_count':0,'boundary_faces':[],'valid':True}
    if not BRepCheck_Analyzer(section).IsValid():raise RuntimeError('Invalid section topology')
    if not all(BRepAdaptor_Surface(f).GetType()==GeomAbs_Plane for f in faces):raise RuntimeError('Non-planar section output')
    props=GProp_GProps();integration_error=BRepGProp.SurfaceProperties_s(section,props,1e-9,False)
    area=props.Mass();c=props.CentreOfMass();m=props.MatrixOfInertia();I=np.array([[m.Value(i+1,j+1) for j in range(3)]for i in range(3)])
    Iu=float(u@I@u);Iv=float(v@I@v);Iuv=-float(u@I@v)
    result={'area_mm2':area,'area_integration_relative_error_estimate':integration_error,'has_material':area>1e-9,'centroid_link_mm':[c.X(),c.Y(),c.Z()],
        'Iu_mm4':Iu,'Iv_mm4':Iv,'Iuv_mm4':Iuv,
        'principal_area_moments_mm4':np.linalg.eigvalsh([[Iu,-Iuv],[-Iuv,Iv]]).tolist(),
        'polar_area_moment_mm4':Iu+Iv,
        'face_count':len(faces),'closed_wire_count':sum(len(entities(f,TopAbs_WIRE)) for f in faces),'valid':True}
    if with_boundaries:
        center=np.array([c.X(),c.Y(),c.Z()]);boundary=[];polygon_area=0.;max_gap=0.;polygon_first=np.zeros(2);polygon_moments=np.zeros(3)
        for face in faces:
            outer=BRepTools.OuterWire_s(face);loops=[]
            for wire_shape in entities(face,TopAbs_WIRE):
                wire=TopoDS.Wire_s(wire_shape);walk=BRepTools_WireExplorer(wire,face);points=[]
                while walk.More():
                    edge=TopoDS.Edge_s(walk.Current());curve=BRepAdaptor_Curve(edge)
                    try:sample=GCPnts_UniformDeflection(curve,boundary_deflection_mm,True)
                    except RuntimeError:sample=GCPnts_QuasiUniformDeflection(curve,boundary_deflection_mm)
                    if not sample.IsDone():raise RuntimeError('Boundary discretisation failed')
                    vertices=[sample.Value(i) for i in range(1,sample.NbPoints()+1)]
                    if edge.Orientation()==TopAbs_REVERSED:vertices.reverse()
                    for point in vertices:
                        d=np.array([point.X(),point.Y(),point.Z()])-center;p=[round(float(d@u),6),round(float(d@v),6)]
                        if not points or np.linalg.norm(np.array(p)-points[-1])>1e-8:points.append(p)
                    walk.Next()
                gap=float(np.linalg.norm(np.array(points[0])-points[-1]));max_gap=max(max_gap,gap)
                if gap>max(1e-5,boundary_deflection_mm):raise RuntimeError('Boundary wire does not close at the requested tolerance')
                if gap>1e-8:points.append(points[0])
                is_outer=wire.IsSame(outer)
                xy=np.asarray(points);a=xy;b=np.roll(xy,-1,axis=0);cross=a[:,0]*b[:,1]-b[:,0]*a[:,1]
                signed_area=float(np.sum(cross)/2);sign=(1 if is_outer else -1)*(1 if signed_area>=0 else -1)
                polygon_area+=sign*signed_area
                polygon_first+=sign*np.sum((a+b)*cross[:,None],axis=0)/6
                polygon_moments+=sign*np.array([
                    np.sum((a[:,1]**2+a[:,1]*b[:,1]+b[:,1]**2)*cross)/12,
                    np.sum((a[:,0]**2+a[:,0]*b[:,0]+b[:,0]**2)*cross)/12,
                    np.sum((2*a[:,0]*a[:,1]+a[:,0]*b[:,1]+b[:,0]*a[:,1]+2*b[:,0]*b[:,1])*cross)/24])
                loops.append({'outer':is_outer,'uv_mm':points})
            boundary.append({'loops':loops})
        # An independent polygon check catches degenerate trimming/integration
        # cases. The cross moment uses sqrt(Iu*Iv) as scale since it may be zero.
        moment_error=max(abs(polygon_moments[0]/Iu-1),abs(polygon_moments[1]/Iv-1),abs(polygon_moments[2]-Iuv)/math.sqrt(Iu*Iv))
        result.update(boundary_faces=boundary,boundary_deflection_mm=boundary_deflection_mm,
                      boundary_polygon_area_mm2=polygon_area,boundary_area_relative_error=abs(polygon_area/area-1),
                      boundary_polygon_area_moments_mm4=polygon_moments.tolist(),boundary_moment_relative_error=moment_error,
                      boundary_polygon_centroid_offset_mm=(polygon_first/polygon_area).tolist(),max_wire_closure_gap_mm=max_gap)
        if max(result['boundary_area_relative_error'],moment_error)>.001:
            raise RuntimeError('Exact-face / sampled-boundary properties differ by over 0.1%; reject this section station')
    return result

def geometric_axial_envelope(shape,n,u,v):
    # This box only locates plane stations. Its dimensions never become A or I.
    t=np.eye(4);t[:3,:3]=[u,v,n];local=transformed(shape,t)
    b=Bnd_Box();BRepBndLib.AddOptimal_s(local,b,False,False)
    lo=b.CornerMin();hi=b.CornerMax();return [lo.Z(),hi.Z()]

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cad-root',type=Path,default=Path.home()/'Alohamini_workspace/simulation/cad');parser.add_argument('--model-root',type=Path,default=Path.home()/'Alohamini/models/alohamini2pro');parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[2]/'public/models/alohamini-left/structure.json');parser.add_argument('--samples',type=int,default=41);parser.add_argument('--boundary-deflection-mm',type=float,default=.002);parser.add_argument('--extreme-plane-inset-mm',type=float,default=2);parser.add_argument('--volume-check-points',type=int,default=96);args=parser.parse_args()
    if args.samples<41:parser.error('--samples must be at least 41')
    base=args.cad_root
    native=base/'alohamini2pro_20261027';inertia_path=base/'alohamini2pro_active_inertias_20261102/inertia.json'
    catalog_path=base/'alohamini2pro_cad_mass_nominal_20261029/component_masses.json'
    urdf_path=args.model_root/'urdf/alohamini2pro.urdf'
    inertia=json.loads(inertia_path.read_text());catalog=json.loads(catalog_path.read_text());manifest=json.loads((native/'cad.json').read_text());urdf=ET.parse(urdf_path).getroot()
    assert sha(urdf_path)==inertia['source_description_sha256']['urdf/alohamini2pro.urdf']
    assert sha(native/'cad.json')==inertia['source']['cad_manifest_sha256']
    assert sha(catalog_path)==inertia['source']['active_mass_catalog_sha256']
    report={'schema_version':1,'artifact_kind':'geometric_structural_profile_audit','units':'mm, mm^2, mm^4; masses kg',
      'sources':{str(p):sha(p) for p in [inertia_path,catalog_path,native/'cad.json',urdf_path]},
      'generator':{'script':'scripts/models/extract-aloha-structure.py','script_sha256':sha(__file__),'section_samples':args.samples,'boundary_deflection_mm':args.boundary_deflection_mm,'extreme_plane_inset_mm':args.extreme_plane_inset_mm,'boundary_property_relative_tolerance':.001},
      'material_evidence':{'family':'ABS','source':'User declaration, 2026-11-02','grade':None,'print_orientation':None,'infill_specification':None,'effective_elastic_modulus_Pa':None,'effective_shear_modulus_Pa':None},
      'method':'Native B-rep solid intersected with a finite planar face; adaptive OCCT surface integration on exact geometry (relative target 1e-9), with no triangulation.',
      'parts':[],'limitations':['Profile station axis follows the adjacent URDF joint-centre line only as a reproducible inspection reference; it is not a verified neutral axis or mechanical clamp line.',
        'No clamp/load-transfer faces, bolted-joint stiffness, material elastic/strength data, print direction or infill specification were established.',
        'CAD solid geometry may not describe the real printed infill. User-overridden mass divided by CAD volume is only an effective mass density.',
        'Disconnected section faces and varying area require load-path review; these profiles do not establish Euler-Bernoulli beam applicability.',
        'Polar area moment is not a torsion constant. No stress, compliance, mode or hardware prediction is produced.',
        'ABS family is user-declared; grade, print direction, infill and effective stiffness are unknown. A solid-ABS reference modulus is not an identified printed-part modulus.']}
    for link,definition in [('left_Upper_Arm','0:1:1:51'),('left_Lower_Arm','0:1:1:52')]:
        group=next(g for g in inertia['link_groups']if g['link']==link)
        source=next(s for s in group['sources']if s['properties']['frame']==definition)
        material=next(m for m in catalog['material_instances']if m['CAD_definition_id']==definition)
        item=manifest['definitions'][definition];path=native/item['file']
        assert sha(path)==material['native_brep_sha256']==manifest['files'][item['file']]
        native_shape=read_brep(path);T=np.asarray(source['T_link_source']);Tmm=T.copy();Tmm[:3,3]*=1000;shape=transformed(native_shape,Tmm)
        volume=GProp_GProps();volume_error=BRepGProp.VolumeProperties_s(native_shape,volume,1e-9,True,False);V=volume.Mass()
        next_joint=next(j for j in urdf.findall('joint')if j.find('parent').get('link')==link)
        distal=np.array(list(map(float,next_joint.find('origin').get('xyz').split())))*1000
        L=float(np.linalg.norm(distal));n,u,v=basis_for(distal);envelope=geometric_axial_envelope(shape,n,u,v)
        samples=[]
        stations=sorted(set([round(float(x),9) for x in np.linspace(envelope[0]+args.extreme_plane_inset_mm,envelope[1]-args.extreme_plane_inset_mm,args.samples)]+[0.,L]))
        for station in stations:
            fraction=(station-envelope[0])/(envelope[1]-envelope[0]);s=planar_section_properties(shape,n*station,n,u,with_boundaries=True,boundary_deflection_mm=args.boundary_deflection_mm);samples.append({'station_from_joint_mm':station,'geometric_span_fraction':fraction,'in_geometric_envelope':envelope[0]<=station<=envelope[1],**s})
            print(link,'station',round(station,3),'A',round(s['area_mm2'],3),'faces',s['face_count'],flush=True)
        volume_checks=[]
        if args.volume_check_points:
            xs,ws=np.polynomial.legendre.leggauss(args.volume_check_points);lo,hi=envelope
            areas=[planar_section_properties(shape,n*(lo+(float(x)+1)*(hi-lo)/2),n,u)['area_mm2']for x in xs]
            integral=float(np.dot(ws,areas)*(hi-lo)/2);volume_checks.append({'gauss_legendre_points':args.volume_check_points,'integrated_section_volume_mm3':integral,'relative_difference_from_brep_volume':abs(integral/V-1)})
        rows=[{'definition':s['properties']['frame'],'component_ids':s['component_ids'],'mass_kg':s['properties']['mass_kg']}for s in group['sources']]
        report['parts'].append({'link':link,'definition':definition,'name':item['name'],'occurrence':source['source_CAD_occurrence'],
          'source_brep':str(path),'source_brep_sha256':sha(path),'source_volume_mm3':V,'manifest_volume_mm3':item['volume_m3']*1e9,'volume_integration_relative_error_estimate':volume_error,
          'mass_kg':source['properties']['mass_kg'],'mass_classification':'User-overridden / reconstructed CAD nominal mass, not an intrinsic material density',
          'effective_mass_density_kg_m3':source['properties']['mass_kg']/(V*1e-9),
          'T_link_part_m':T.tolist(),'part_source_inertia':source['properties'],'link_component_partition':rows,
          'joint_centre_reference':{'next_joint':next_joint.get('name'),'distal_link_mm':distal.tolist(),'distance_mm':L},
          'section_basis_in_link':{'normal':n.tolist(),'u':u.tolist(),'v':v.tolist()},'geometric_axial_envelope_mm':envelope,
          'mechanically_validated_beam_span':None,'extreme_plane_inset_mm':args.extreme_plane_inset_mm,'section_volume_consistency':volume_checks,
          'default_segment':None,'interpolation_rule':'Never bridge a has_material=false station; user-selected sections define an explicit local model, not the original installation boundary.',
          'cross_section_profiles':samples})
    output=args.out;output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,separators=(',',':'))+'\n');print('WROTE',output,flush=True)
if __name__=='__main__':main()
