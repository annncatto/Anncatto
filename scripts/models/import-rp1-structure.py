#!/usr/bin/env python3
"""Extract real RP1 part sections; this does not certify a whole-leg beam model.

Run with /home/anncatto/miniconda3/envs/alohamini/bin/python.
Only M447 is enabled: its original STEP imports as a valid solid. Source mass
properties and the workbench rigid-body model are never changed by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.BRepAlgoAPI import BRepAlgoAPI_Common
from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeFace, BRepBuilderAPI_Transform
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepBndLib import BRepBndLib
from OCP.Bnd import Bnd_Box
from OCP.GCPnts import GCPnts_QuasiUniformDeflection
from OCP.GeomAbs import GeomAbs_Plane
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPControl import STEPControl_Reader
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.TopoDS import TopoDS
from OCP.TopTools import TopTools_ListOfShape
from OCP.gp import gp_Ax3, gp_Dir, gp_Pln, gp_Pnt, gp_Trsf

ROOT = Path(__file__).resolve().parents[2]
COMMIT = 'c595061d2d27bb6bef43ebebd7dcdb0607582581'
URDF_COMMIT = '8c12d13ae05143bc1f67f51f1046ddb14cc9d112'
URDF_SHA256 = 'd0c86d45773974d91445b728d148ecec965267746ec73e71afc6a7ffbce708d5'
MESH_SHA256 = 'ffe17fc9ba1614ae86610dc1b657461a3d1d70350729296c9210f68f3934d01d'
STEP_PATH = '01_Mechanic/02_Manufacturing/01_CNC/Common/YCL.M000447 小腿本体右.STEP'
DRAWING_PATH = STEP_PATH.removesuffix('.STEP') + '.pdf'
BOM_PATH = '01_Mechanic/02_Manufacturing/01_CNC/RP1_CNC_BOM.xlsx'
FILES = {
    STEP_PATH: 'b83e3886a145361e511084f170d0d1b0d7ffcce9',
    DRAWING_PATH: '8ff564bf86f4adc9191af0ccba667a30c18fbfbe',
    BOM_PATH: '80ea789039aa5590be1892b680381133760630b6',
    'LICENSE': '0f882860afce5f8dea62795cfcd8ee0d422d873b',
    'LICENSES.md': '0c44b4cfe22583e709b4ad8120603490fb2fb49e',
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def entities(shape, kind):
    exp = TopExp_Explorer(shape, kind)
    while exp.More():
        yield exp.Current()
        exp.Next()


def source_files(destination, cache, offline):
    records = []
    for relative, expected in FILES.items():
        target = destination / 'source' / relative
        cached = cache / relative if cache else target
        if cached.exists():
            data = cached.read_bytes()
        elif offline:
            raise FileNotFoundError(cached)
        else:
            url = f'https://raw.githubusercontent.com/Roboparty/rp1_hardware/{COMMIT}/' + urllib.parse.quote(relative)
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read()
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if blob != expected:
            raise ValueError('Source Git blob mismatch: ' + relative)
        if target.exists() and target.read_bytes() != data:
            raise ValueError('Refusing to replace changed source: ' + str(target))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        records.append({'path': relative, 'gitBlob': blob, 'sha256': sha256(target), 'bytes': len(data)})
    return records


def registered_shape(path):
    reader = STEPControl_Reader()
    if reader.ReadFile(str(path)) != IFSelect_RetDone:
        raise ValueError('STEP read failed')
    # The source declares SI_UNIT(.MILLI.,.METRE.). OCCT coordinates below are mm.
    reader.SetSystemLengthUnit(1.0)
    if reader.TransferRoots() != 1:
        raise ValueError('STEP did not transfer its single root')
    native = reader.OneShape()
    if not BRepCheck_Analyzer(native).IsValid() or len(list(entities(native, TopAbs_SOLID))) != 1:
        raise ValueError('Unmodified source must be one valid solid')
    volume = GProp_GProps()
    BRepGProp.VolumeProperties_s(native, volume, 1e-9, True, False)
    # Orthogonal datum planes, independently checked against the ankle bore axis.
    # These offsets register the CNC part to the right knee link, not to a PCA axis.
    translation = np.array([8.72000027447939 - 6.911716417572593, -30.80900013446808, -61.16599962115288 + 60])
    transform = gp_Trsf()
    transform.SetValues(1, 0, 0, translation[0], 0, 1, 0, translation[1], 0, 0, 1, translation[2])
    shape = BRepBuilderAPI_Transform(native, transform, True).Shape()
    return shape, translation, volume.Mass() * 1e-9


def section_shape(shape, origin, normal, u, station):
    point = origin + normal * station
    plane = gp_Pln(gp_Ax3(gp_Pnt(*point.tolist()), gp_Dir(*normal.tolist()), gp_Dir(*u.tolist())))
    cutter = BRepBuilderAPI_MakeFace(plane, -1000, 1000, -1000, 1000).Face()
    arguments, cutters = TopTools_ListOfShape(), TopTools_ListOfShape()
    arguments.Append(shape)
    cutters.Append(cutter)
    operation = BRepAlgoAPI_Common()
    operation.SetArguments(arguments)
    operation.SetTools(cutters)
    # Repeated cuts must not mutate input tolerances or shared sub-shapes.
    operation.SetNonDestructive(True)
    operation.Build()
    if not operation.IsDone():
        raise ValueError('Section boolean failed')
    result = operation.Shape()
    faces = [TopoDS.Face_s(x) for x in entities(result, TopAbs_FACE)]
    if not faces or not BRepCheck_Analyzer(result).IsValid():
        raise ValueError('Empty or invalid section at ' + str(station))
    if any(BRepAdaptor_Surface(face).GetType() != GeomAbs_Plane for face in faces):
        raise ValueError('Section contains a non-planar face')
    properties = GProp_GProps()
    BRepGProp.SurfaceProperties_s(result, properties, 1e-9, False)
    return result, faces, properties


def section(shape, origin, normal, u, v, station):
    result, faces, properties = section_shape(shape, origin, normal, u, station)
    centroid = np.array(properties.CentreOfMass().Coord())
    tensor = properties.MatrixOfInertia()
    matrix = np.array([[tensor.Value(i + 1, j + 1) for j in range(3)] for i in range(3)])
    boundary = []
    for edge in entities(result, TopAbs_EDGE):
        edge = TopoDS.Edge_s(edge)
        if BRep_Tool.Degenerated_s(edge):
            continue
        curve = BRepAdaptor_Curve(edge)
        samples = GCPnts_QuasiUniformDeflection(curve, 0.010)
        if not samples.IsDone():
            raise ValueError('Could not sample a section boundary edge')
        for index in range(1, samples.NbPoints() + 1):
            relative = np.array(samples.Value(index).Coord()) - centroid
            boundary.append([float(relative @ u) * .001, float(relative @ v) * .001])
    boundary = np.unique(np.round(boundary, 12), axis=0)
    if len(boundary) < 3:
        raise ValueError('Incomplete section boundary')
    return {
        'sM': station * .001,
        'areaM2': properties.Mass() * 1e-6,
        'iuuM4': float(u @ matrix @ u) * 1e-12,
        'ivvM4': float(v @ matrix @ v) * 1e-12,
        # Product of area integral(u*v*dA); the tensor off-diagonal is its negative.
        'iuvM4': -float(u @ matrix @ v) * 1e-12,
        'centroidLinkM': (centroid * .001).tolist(),
        'boundaryUVm': boundary.tolist(),
        'boundaryRepresentation': 'unordered samples from all boundary edges, relative to the section centroid; not a connected polygon',
        'boundaryChordDeflectionM': 1e-5,
        'sectionFaces': len(faces),
        'valid': True,
    }


def volume_check(shape, normal, u, v, volume):
    transform = gp_Trsf()
    transform.SetValues(*np.column_stack([np.array([u, v, normal]), np.zeros(3)]).reshape(-1).tolist())
    aligned = BRepBuilderAPI_Transform(shape, transform, True).Shape()
    bounds = Bnd_Box()
    BRepBndLib.AddOptimal_s(aligned, bounds, False, False)
    lo, hi = bounds.CornerMin().Z(), bounds.CornerMax().Z()
    checks = []
    for count in [96, 192]:
        xs, weights = np.polynomial.legendre.leggauss(count)
        areas = []
        interpolated_nodes = []
        for x in xs:
            station = lo + (float(x) + 1) * (hi - lo) / 2
            try:
                _, _, properties = section_shape(shape, np.zeros(3), normal, u, station)
                areas.append(properties.Mass())
            except ValueError as error:
                # This is a quadrature estimate, not a published section. A
                # failed boolean never becomes a zero area. Record the narrow
                # bracketing interval and both actually evaluated areas.
                bracket = None
                for distance in [.1, .25, .5, .75, 1.]:
                    try:
                        neighbors = [section_shape(shape, np.zeros(3), normal, u, station + sign * distance)[2].Mass() for sign in [-1, 1]]
                        bracket = {'requestedSM': station * .001, 'halfWidthM': distance * .001, 'neighborAreasM2': [value * 1e-6 for value in neighbors], 'method': 'symmetric linear interpolation for volume quadrature only'}
                        break
                    except ValueError:
                        continue
                if bracket is None:
                    raise ValueError(f'Volume quadrature at {station} mm: {error}') from error
                areas.append(sum(neighbors) / 2)
                interpolated_nodes.append(bracket)
        integral = float(np.dot(weights, areas) * (hi - lo) / 2) * 1e-9
        check = {'quadrature': 'Gauss-Legendre', 'points': count, 'integratedVolumeM3': integral, 'relativeError': abs(integral / volume - 1), 'interpolatedNodes': interpolated_nodes}
        checks.append(check)
        print('Volume consistency', json.dumps(check), flush=True)
    return {'fullGeometricIntervalM': [lo * .001, hi * .001], 'nativeCadVolumeM3': volume, 'checks': checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, help='Existing pinned hardware source directory')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--out', type=Path, default=ROOT / 'public/models/rp1-24/structural')
    args = parser.parse_args()
    files = source_files(args.out, args.cache, args.offline)
    urdf = ROOT / 'public/models/rp1-24/source.urdf'
    if sha256(urdf) != URDF_SHA256:
        raise ValueError('URDF version mismatch; repeat datum registration')
    if sha256(ROOT / 'public/models/rp1-24/source/meshes/right_knee_link.STL') != MESH_SHA256:
        raise ValueError('Registration mesh version mismatch')
    robot = ET.parse(urdf).getroot()
    joint = next(j for j in robot.findall('joint') if j.get('name') == 'right_ankle_pitch_joint')
    tip = np.array([float(x) for x in joint.find('origin').get('xyz').split()]) * 1000
    origin = np.zeros(3)
    normal = tip / np.linalg.norm(tip)
    u = np.array([1., 0., 0.])
    u -= normal * (u @ normal)
    u /= np.linalg.norm(u)
    v = np.cross(normal, u)
    shape, translation, volume = registered_shape(args.out / 'source' / STEP_PATH)
    bore = np.array([29.502249752175665, 0., -304.1629444013498]) + translation
    # A cylinder's location along its Y axis is arbitrary; compare the X/Z line.
    bore_error = float(np.linalg.norm((bore - tip)[[0, 2]])) * .001
    if bore_error > 2e-6:
        raise ValueError('Independent ankle bore / URDF axis check failed')
    samples = []
    for fraction in np.linspace(.05, .95, 81):
        requested = float(np.linalg.norm(tip) * fraction)
        try:
            items = [section(shape, origin, normal, u, v, requested)]
        except ValueError as error:
            # Some plane/fillet coincidences produce invalid section topology in
            # OCCT. Keep the source untouched and expose two valid neighboring
            # stations, with their real coordinates; never use the invalid cut.
            items = None
            for distance in [.1, .25]:
                try:
                    items = [section(shape, origin, normal, u, v, requested + sign * distance) for sign in [-1, 1]]
                    for item in items:
                        item['requestedSM'] = requested * .001
                        item['stationAdjustmentM'] = item['sM'] - requested * .001
                        item['stationSelectionReason'] = 'Valid neighboring section; original boolean section failed native topology validation.'
                    break
                except ValueError:
                    continue
            if items is None:
                raise ValueError(f'Cannot bracket section at {requested} mm: {error}') from error
        samples.extend(items)
        for item in items:
            print(f"M447 s={item['sM']:.6f}m A={item['areaM2']:.9g}m2 faces={item['sectionFaces']}", flush=True)
    samples.sort(key=lambda item: item['sM'])
    matrix = np.eye(4)
    matrix[:3, 3] = translation * .001
    consistency = volume_check(shape, normal, u, v, volume)
    report = {
        'schemaVersion': 1,
        'id': 'rp1-hardware-c595061-m447',
        'artifactKind': 'native-cad-component-section-profile',
        'integration': {'method': 'OCCT adaptive native surface and volume quadrature, no display triangulation', 'relativeToleranceTarget': 1e-9, 'lengthUnitInKernel': 'mm'},
        'source': {'repo': 'Roboparty/rp1_hardware', 'commit': COMMIT, 'hardwareConfiguration': 'RP1.3.4 5DOF MotionHead', 'urdfCommit': URDF_COMMIT, 'urdfSha256': URDF_SHA256, 'registrationMeshSha256': MESH_SHA256, 'license': 'CERN-OHL-W-2.0', 'localOnly': True, 'files': files},
        'partNo': 'YCL.M000447', 'drawingRevision': '01', 'drawingDate': '2026-09-04',
        'linkName': 'right_knee_link', 'transformLinkFromPart': matrix.tolist(),
        'cadVolumeM3': volume,
        'cadNominalMassKg': volume * 2700,
        'massClassification': 'native CAD volume times nominal alloy density; not weighed or dynamically identified; not substituted into URDF',
        'material': {'designation': 'AL6061-T6', 'sourcePath': BOM_PATH, 'sheet': 'CNC加工BOM', 'cell': 'E41', 'corroboratingDrawing': DRAWING_PATH, 'nominalDensityKgM3': 2700, 'densityReference': {'publisher': 'Alumeco ApS', 'document': 'EN AW-6061 Sheet, strip & plate', 'edition': '2025-04-08', 'url': 'https://www.alumeco.com/media/1p5lryc3/6061_sheet.pdf', 'sourceValue': '2.7 g/cm^3', 'classification': 'generic nominal alloy property, not an RP1 batch certificate'}},
        'registration': {'method': 'three orthogonal source CAD / URDF mesh planes; independent ankle bore axis', 'rotation': 'identity confirmed by orthogonal planar faces', 'datumPlanesMm': [{'axis': 0, 'part': 6.911716417572593, 'link': 8.72000027447939}, {'axis': 1, 'part': 0., 'link': -30.80900013446808}, {'axis': 2, 'part': -60., 'link': -61.16599962115288}], 'ankleBoreRadiusM': .009, 'independentAnkleAxisErrorM': bore_error, 'fullGeometryIdentityEstablished': False},
        'referenceAxis': {'startLinkM': origin.tolist(), 'endLinkM': (tip * .001).tolist(), 'lengthM': float(np.linalg.norm(tip)) * .001, 'normal': normal.tolist(), 'u': u.tolist(), 'v': v.tolist(), 'meaning': 'line between URDF knee and ankle joint centres; not a verified neutral axis or clamp boundary'},
        'sections': samples,
        'sectionVolumeConsistency': consistency,
        'connectionRotationalStiffnessNmPerRad': None,
        'wholeLegLoadShare': None,
        'validatedClampSpan': None,
        'limitations': [
            'M447 is one load-bearing CNC part of the right shank; paired parts, bolts, actuator cases and bearings also carry load.',
            'Sections are native OCCT planar solid intersections, numerically integrated with an explicit tolerance. They are not an automatically validated Euler-Bernoulli equivalent for the assembled leg.',
            'A component cantilever calculation requires an explicit clamp/load assumption. Joint stiffness and force sharing are not supplied by these sections.',
            'Matching datums establish the coordinate registration; local CAD/visual mesh differences and hardware/URDF revision equivalence remain under review.',
            'No Saint-Venant torsion constant, stress concentration factor, fatigue allowance, physical load test or hardware certification is supplied.',
            'Rigid-body mass/inertia and prior motion-validation evidence are unchanged.',
        ],
    }
    (args.out / 'm447-sections.json').write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print('WROTE', args.out / 'm447-sections.json', flush=True)


if __name__ == '__main__':
    main()
