"""Independent source-URDF FK fixtures. Standard library only; no adapter data."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def identity():
    return [[float(i == j) for j in range(4)] for i in range(4)]


def rotation(axis, angle):
    length = math.sqrt(sum(v * v for v in axis))
    x, y, z = (v / length for v in axis)
    c, s, t = math.cos(angle), math.sin(angle), 1 - math.cos(angle)
    result = identity()
    result[:3] = [[t*x*x+c, t*x*y-s*z, t*x*z+s*y, 0],
                  [t*x*y+s*z, t*y*y+c, t*y*z-s*x, 0],
                  [t*x*z-s*y, t*y*z+s*x, t*z*z+c, 0]]
    return result


def vector(element, name, default='0 0 0'):
    return [float(v) for v in element.get(name, default).split()] if element is not None else [0., 0., 0.]


results = {}
for model_id, directory in [('go2', 'go2'), ('rp1', 'rp1-24')]:
    tree = ET.parse(ROOT / 'public/models' / directory / 'source.urdf').getroot()
    joints = tree.findall('joint')
    children = {j.find('child').get('link') for j in joints}
    root = next(link.get('name') for link in tree.findall('link') if link.get('name') not in children)
    samples = []
    for case in range(3):
        q, poses = {}, {root: identity()}
        for i, joint in enumerate(j for j in joints if j.get('type') != 'fixed'):
            limit = joint.find('limit')
            low, high = float(limit.get('lower')), float(limit.get('upper'))
            q[joint.get('name')] = 0. if case == 0 else low + (high-low) * (.5 + .22*math.sin(i*.73+case))
        pending = list(joints)
        while pending:
            for joint in list(pending):
                parent = joint.find('parent').get('link')
                if parent not in poses:
                    continue
                origin = joint.find('origin')
                x, y, z = vector(origin, 'rpy')
                transform = multiply(multiply(rotation([0,0,1], z), rotation([0,1,0], y)), rotation([1,0,0], x))
                for i, v in enumerate(vector(origin, 'xyz')):
                    transform[i][3] = v
                if joint.get('type') != 'fixed':
                    transform = multiply(transform, rotation(vector(joint.find('axis'), 'xyz', '1 0 0'), q[joint.get('name')]))
                poses[joint.find('child').get('link')] = multiply(poses[parent], transform)
                pending.remove(joint)
        samples.append({'q': q, 'poses': poses})
    results[model_id] = {'root': root, 'samples': samples}

output = ROOT / 'tests/fixtures/source-robots-fk.json'
output.write_text(json.dumps(results, separators=(',', ':')) + '\n')
print(output)
