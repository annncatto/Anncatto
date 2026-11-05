#!/usr/bin/env python3
"""Import the pinned Alohamini CAD nominal inertial binding, using only stdlib.

Joint geometry stays in aloha-description.ts. This import supplies link-local
mass moments and separately classified bearing armature; it does not import
LIBERO task settings or servo PD gains. Re-run against the source paths below,
or pass equivalent frozen files with --inertial-bundle / --mjcf / --source.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
URDF_HASH = '8459353ebc6af5800d809b96566b5073a7fcff880c67171ab07a0bd2f98ffee6'
BUNDLE_HASH = 'b22a27a4981a026c4891fbe9b79014cf9376c5a1f54c85b27b22ffc89cd7f23e'
MJCF_HASH = '6e044d118425209d1a2ef500434a46ceb8695840441885a2434883e6f9a738a9'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def transpose(A):
    return [list(row) for row in zip(*A)]

def product(A, B):
    return [[sum(x*y for x, y in zip(row, col)) for col in zip(*B)] for row in A]

def mv(A, p):
    return [sum(x*y for x, y in zip(row, p)) for row in A]

def add(a, b):
    return [x+y for x, y in zip(a, b)]

def pack(I):
    return [I[0][0], I[1][1], I[2][2], I[0][1], I[0][2], I[1][2]]

def parallel(c):
    norm2 = sum(x*x for x in c)
    return [[(norm2 if i == j else 0)-c[i]*c[j] for j in range(3)] for i in range(3)]

def quaternion_matrix(q):
    w, x, y, z = q
    return [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]

def vec(value):
    return [float(x) for x in value.split()]

def link_component(source):
    prop, T = source['properties'], source['T_link_source']
    R, shift = [row[:3] for row in T[:3]], [row[3] for row in T[:3]]
    RtR = product(transpose(R), R)
    if max(abs(RtR[i][j]-(i == j)) for i in range(3) for j in range(3)) > 1e-10:
        raise ValueError('Source transform is not rigid')
    com = add(mv(R, prop['com_m']), shift)
    I = product(product(R, prop['central_inertia_kg_m2']), transpose(R))
    return {'mass': prop['mass_kg'], 'com': com, 'inertia': pack(I),
            'sourceFrame': prop['frame'], 'componentIds': source['component_ids']}

def combine(parts):
    mass = sum(p['mass'] for p in parts)
    if mass <= 0:
        raise ValueError('A rigid source group must have positive mass')
    com = [sum(p['mass']*p['com'][i] for p in parts)/mass for i in range(3)]
    tensor = [[0.0]*3 for _ in range(3)]
    for part in parts:
        xx, yy, zz, xy, xz, yz = part['inertia']
        I = [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]]
        P = parallel([x-y for x, y in zip(part['com'], com)])
        tensor = [[tensor[i][j]+I[i][j]+part['mass']*P[i][j] for j in range(3)] for i in range(3)]
    return {'mass': mass, 'com': com, 'inertia': pack(tensor)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path.home()/'Alohamini')
    parser.add_argument('--inertial-bundle', type=Path, default=Path.home()/'Alohamini_workspace/simulation/cad/alohamini2pro_active_inertias_20261102/inertia.json')
    parser.add_argument('--mjcf', type=Path, default=Path.home()/'Alohamini_workspace/simulation/collections/libero_spatial_task8_train_20261103/part_0/reset_012/model/model.xml')
    parser.add_argument('--check', action='store_true', help='Verify generated artifacts without writing')
    args = parser.parse_args()
    urdf = args.source/'models/alohamini2pro/urdf/alohamini2pro.urdf'
    data = [(urdf, URDF_HASH), (args.inertial_bundle, BUNDLE_HASH), (args.mjcf, MJCF_HASH)]
    for path, expected in data:
        if sha(path.read_bytes()) != expected:
            raise ValueError(f'Pinned source hash changed: {path}')
    source = ET.parse(urdf).getroot()
    bundle = json.loads(args.inertial_bundle.read_bytes())
    mjcf = ET.parse(args.mjcf).getroot()
    if bundle['source_description_sha256']['urdf/alohamini2pro.urdf'] != URDF_HASH:
        raise ValueError('Inertial binding belongs to a different URDF')
    srdf = args.source/'models/alohamini2pro/srdf/alohamini2pro.srdf'
    if sha(srdf.read_bytes()) != bundle['source_description_sha256']['srdf/alohamini2pro.srdf']:
        raise ValueError('Inertial binding belongs to a different SRDF')
    names = ['left_Base']
    for name in names:
        names += [j.find('child').get('link') for j in source.findall('joint') if j.find('parent').get('link') == name]
    groups = {g['link']: g for g in bundle['link_groups'] if g['link'] in names}
    replacements = {name for group in groups.values() for name in group['replaces']}
    ids = [id for g in groups.values() for s in g['sources'] for id in s['component_ids']]
    if len(ids) != len(set(ids)) or replacements-set(names):
        raise ValueError('Left-arm source components or rigid ownership are duplicated')
    links = []
    comparison = []
    for name in names:
        group = groups.get(name)
        if group:
            components = [link_component(s) for s in group['sources']]
            physical = combine(components)
        else:
            original = source.find(f"link[@name='{name}']/inertial/mass")
            if original is not None and float(original.get('value')) > 0 and name not in replacements:
                raise ValueError(f'Uncovered left-arm source inertia: {name}')
            components = []
            physical = {'mass': 0, 'com': [0, 0, 0], 'inertia': [0]*6}
        body = mjcf.find(f".//body[@name='{name}']")
        if body is None:
            raise ValueError('Compiled reference body missing: '+name)
        element = body.find('inertial')
        if physical['mass']:
            R = quaternion_matrix(vec(element.get('quat', '1 0 0 0')))
            diag = vec(element.get('diaginertia'))
            reference = {'mass': float(element.get('mass')), 'com': vec(element.get('pos', '0 0 0')),
                         'inertia': pack(product(product(R, [[diag[i] if i == j else 0 for j in range(3)] for i in range(3)]), transpose(R)))}
            errors = {key: max(abs(a-b) for a, b in zip(physical[key], reference[key])) for key in ['com', 'inertia']}
            errors['mass'] = abs(physical['mass']-reference['mass'])
            if max(errors.values()) > 1e-12:
                raise ValueError('Source composition differs from generated MJCF: '+name)
            comparison.append({'name': name, 'maximumAbsoluteErrors': errors})
        elif element is not None and float(element.get('mass', '0')):
            raise ValueError('Removed source body retains duplicated mass: '+name)
        links.append({'name': name, **physical, 'replaces': group['replaces'] if group else [], 'components': components})
    armatures = [{'name': name, 'value': value, 'kind': 'bearing-upper-bound', 'range': [0, value]}
                 for name, value in bundle['joint_armature_kg_m2'].items() if name.startswith('left_')]
    total = sum(link['mass'] for link in links)
    if abs(total-1.84962) > 1e-12:
        raise ValueError('Unexpected source arm mass')
    payload = {'schemaVersion': 1, 'classification': 'cad-nominal', 'urdfSha256': URDF_HASH,
               'bundleSha256': BUNDLE_HASH, 'totalMass': total, 'links': links, 'jointArmature': armatures}
    tracked = ['simulation/mujoco/alohamini_mujoco/'+name+'.py' for name in ['model', 'description', 'inertial_binding', 'inertia', 'control', 'export', 'libero']]
    source_code = []
    for path in tracked:
        working = (args.source/path).read_bytes()
        committed = subprocess.check_output(['git', 'show', 'HEAD:'+path], cwd=args.source)
        source_code.append({'path': path, 'sha256': sha(working), 'headSha256': sha(committed), 'modified': working != committed})
    provenance = {'schemaVersion': 1, 'classification': 'CAD nominal physical model; not hardware identified',
                  'repository': {'path': str(args.source.resolve()), 'branch': subprocess.check_output(['git', 'branch', '--show-current'], cwd=args.source, text=True).strip(),
                                 'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=args.source, text=True).strip(), 'sourceFiles': source_code},
                  'sources': [{'path': str(path.resolve()), 'sha256': expected} for path, expected in data],
                  'sourceDescriptionSha256': bundle['source_description_sha256'], 'sourceClassification': bundle['source'],
                  'importedScope': 'Fixed left_Base subtree: original joint geometry and limits; CAD nominal mass, COM and central tensor in each original link frame. Camera mass is included once in left_Fixed_Jaw.',
                  'originalUrdfSubtreeMass': 2.0, 'importedSubtreeMass': total, 'leftRigidGroups': len(groups), 'originalLinks': len(names),
                  'jointArmature': armatures, 'limitations': bundle['limitations'],
                  'excludedSimulationSettings': {'jointDampingAndFriction': 'Original left-arm URDF declares neither; source MJCF has zero damping/frictionloss, not identified zero physical loss.',
                    'pdGains': 'Task controller gains depend on initialization inertia and explicit overrides; they are not material stiffness or identified servo constants.',
                    'contact': 'LIBERO robot friction [1,0.005,0.0001], solver, timestep, scene placement and collision candidates belong to a separate simulation configuration.',
                    'rotorInertia': 'Pan armature is an upper-bound bearing term. Internal motor/gear reflected inertia remains uncalibrated.'},
                  'mjcfComparison': comparison}
    outputs = {ROOT/'src/aloha-physics-data.ts': '// Generated by scripts/models/import-alohamini-physics.py; SI units; CAD nominal source data.\nexport const alohaPhysicsData = '+json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+' as const;\n',
               ROOT/'public/models/alohamini-left/physics-provenance.json': json.dumps(provenance, ensure_ascii=False, indent=2, allow_nan=False)+'\n',
               ROOT/'public/models/alohamini-left/physics-source.json': args.inertial_bundle.read_text()}
    for path, content in outputs.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError('Generated artifact differs: '+str(path))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    print(json.dumps({'links': len(links), 'rigidGroups': len(groups), 'mass': total, 'armature': armatures, 'mode': 'check' if args.check else 'write'}))

if __name__ == '__main__':
    main()
