"""Import pinned Go2/RP1 source models for the local workbench.

Run with the existing alohamini Python environment (NumPy only):
  python scripts/models/import-source-robots.py [--model all|go2|rp1-24] [--offline]

Only files listed in source-robots.lock.json are downloaded. Git blob SHA-1 and
byte counts are checked before parsing; source files are never rewritten.
STL triangles and positions are retained; indexed GLB preserves visual origins,
COLLADA node matrices, source diffuse colors and normals. No decimation occurs.
The GLB is a library of link-local groups, not an assembled robot at q=0.
RP1 license is unspecified upstream: all outputs remain local-only.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import shutil
import struct
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np


REPO = Path(__file__).resolve().parents[2]
LOCK = json.loads(Path(__file__).with_name('source-robots.lock.json').read_text())
NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
IDENTITY = np.eye(4)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def git_blob_sha(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()


def vec(element, key, default='0 0 0'):
    return [float(v) for v in (element.get(key, default) if element is not None else default).split()]


def origin(element):
    return {'xyz': vec(element, 'xyz'), 'rpy': vec(element, 'rpy')}


def rpy_matrix(rpy):
    x, y, z = rpy
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    m = np.eye(4)
    m[:3, :3] = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    return m


def pose_matrix(data):
    m = rpy_matrix(data['rpy'])
    m[:3, 3] = data['xyz']
    return m


def transformed(points, matrix):
    return points @ matrix[:3, :3].T + matrix[:3, 3]


def bounds(points):
    return {'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()}


def union_bounds(items):
    if not items:
        return None
    return {'min': np.min([i['min'] for i in items], axis=0).tolist(), 'max': np.max([i['max'] for i in items], axis=0).tolist()}


def download_file(model_id, spec, entry, offline):
    path = REPO / 'public/models' / model_id / 'source' / entry['path']
    if path.is_file():
        raw = path.read_bytes()
        if len(raw) == entry['bytes'] and git_blob_sha(raw) == entry['gitBlobSha']:
            return path
        raise ValueError(f'Existing source checksum mismatch: {path}; preserve or remove this unexpected file before retrying')
    if offline:
        raise FileNotFoundError(f'Offline source missing: {path}')
    url = f"https://api.github.com/repos/{spec['repository']}/contents/{urllib.parse.quote(entry['path'])}?ref={spec['commit']}"
    request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'Anncatto-local-model-import'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                raw = response.read()
            break
        except Exception as error:
            if attempt == 2:
                raise RuntimeError(f'Could not download pinned source {entry["path"]}: {error}') from error
            time.sleep(attempt + 1)
    if len(raw) != entry['bytes'] or git_blob_sha(raw) != entry['gitBlobSha']:
        raise ValueError(f'Upstream source checksum mismatch: {entry["path"]}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return path


class GLB:
    def __init__(self):
        self.nodes, self.meshes, self.materials, self.views, self.accessors, self.roots = [], [], [], [], [], []
        self.buffer = bytearray()
        self.material_lookup = {}

    def material(self, name, rgba):
        key = (name, tuple(rgba))
        if key in self.material_lookup:
            return self.material_lookup[key]
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': rgba, 'metallicFactor': 0.0, 'roughnessFactor': 0.7}, 'doubleSided': False}
        if rgba[3] < 1:
            m['alphaMode'] = 'BLEND'
        self.material_lookup[key] = len(self.materials)
        self.materials.append(m)
        return len(self.materials) - 1

    def accessor(self, values, kind, target):
        values = np.ascontiguousarray(values)
        while len(self.buffer) % 4:
            self.buffer.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.buffer), 'byteLength': values.nbytes, 'target': target}
        self.views.append(view)
        self.buffer.extend(values.tobytes())
        a = {'bufferView': len(self.views) - 1, 'componentType': 5125 if values.dtype == np.dtype('<u4') else 5126, 'count': len(values), 'type': kind}
        if kind == 'VEC3' and target == 34962:
            a.update(bounds(values))
        self.accessors.append(a)
        return len(self.accessors) - 1

    def primitive(self, positions, normals, indices, material):
        p = {'attributes': {'POSITION': self.accessor(positions.astype('<f4'), 'VEC3', 34962)}, 'indices': self.accessor(indices.reshape(-1).astype('<u4'), 'SCALAR', 34963), 'material': material}
        if normals is not None:
            p['attributes']['NORMAL'] = self.accessor(normals.astype('<f4'), 'VEC3', 34962)
        return p

    def mesh(self, name, primitives):
        self.meshes.append({'name': name, 'primitives': primitives})
        return len(self.meshes) - 1

    def node(self, name, matrix=None, mesh=None, extras=None):
        n = {'name': name}
        if matrix is not None and not np.array_equal(matrix, IDENTITY):
            n['matrix'] = matrix.T.reshape(-1).tolist()
        if mesh is not None:
            n['mesh'] = mesh
        if extras is not None:
            n['extras'] = extras
        self.nodes.append(n)
        return len(self.nodes) - 1

    def child(self, parent, child):
        self.nodes[parent].setdefault('children', []).append(child)

    def write(self, path, model_id):
        obj = {'asset': {'version': '2.0', 'generator': 'Anncatto pinned URDF visual importer', 'extras': {'modelId': model_id, 'coordinateSystem': 'URDF link-local XYZ; Z up, no glTF world-up conversion', 'assembled': False}}, 'scene': 0, 'scenes': [{'nodes': self.roots}], 'nodes': self.nodes, 'meshes': self.meshes, 'materials': self.materials, 'bufferViews': self.views, 'accessors': self.accessors, 'buffers': [{'byteLength': len(self.buffer)}]}
        encoded = json.dumps(obj, separators=(',', ':')).encode()
        encoded += b' ' * (-len(encoded) % 4)
        self.buffer.extend(b'\0' * (-len(self.buffer) % 4))
        raw = struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(encoded) + 8 + len(self.buffer)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(self.buffer), 0x004e4942) + self.buffer
        path.write_bytes(raw)
        return {'bytes': len(raw), 'sha256': sha256(raw), 'meshCount': len(self.meshes)}


def read_stl(path):
    raw = path.read_bytes()
    if len(raw) < 84:
        raise ValueError(f'Invalid binary STL: {path}')
    count = struct.unpack_from('<I', raw, 80)[0]
    if len(raw) != 84 + count * 50:
        raise ValueError(f'Expected exact binary STL, got unexpected length: {path}')
    triangles = np.frombuffer(raw, dtype=np.dtype([('normal', '<f4', (3,)), ('vertex', '<f4', (3, 3)), ('attribute', '<u2')]), count=count, offset=84)
    positions = triangles['vertex'].reshape(-1, 3)
    if not np.isfinite(positions).all():
        raise ValueError(f'Non-finite source STL coordinates: {path}')
    # Position welding is exact. Smooth normals are display-only and do not
    # change the retained source STL or triangle winding used for physics.
    vertices, indices = np.unique(positions, axis=0, return_inverse=True)
    normals = np.zeros(vertices.shape, dtype=np.float64)
    idx = indices.reshape(-1, 3)
    weighted = np.cross(vertices[idx[:, 1]] - vertices[idx[:, 0]], vertices[idx[:, 2]] - vertices[idx[:, 0]])
    for corner in range(3):
        np.add.at(normals, idx[:, corner], weighted)
    length = np.linalg.norm(normals, axis=1)
    good = length > 1e-30
    normals[good] /= length[good, None]
    normals[~good] = [0, 0, 1]
    # Verify indexed reconstruction bit-for-bit in source float32 coordinates.
    assert np.array_equal(vertices[indices], positions)
    return vertices, normals.astype('<f4'), indices, count


class Collada:
    def __init__(self, path, glb):
        self.path, self.glb = path, glb
        self.root = ET.parse(path).getroot()
        if self.root.findtext('c:asset/c:up_axis', 'Z_UP', NS) != 'Z_UP':
            raise ValueError(f'Unreviewed COLLADA up-axis: {path}')
        unit = self.root.find('c:asset/c:unit', NS)
        self.unit = float(unit.get('meter', '1')) if unit is not None else 1.0
        if self.root.findall('c:library_images/c:image', NS):
            raise ValueError(f'External image preservation needs implementation: {path}')
        if self.root.findall('c:library_controllers/c:controller', NS):
            raise ValueError(f'Skinned COLLADA source is not supported: {path}')
        self.geometry = {e.get('id'): e for e in self.root.findall('c:library_geometries/c:geometry', NS)}
        self.visual_scenes = {e.get('id'): e for e in self.root.findall('c:library_visual_scenes/c:visual_scene', NS)}
        self.library_nodes = {e.get('id'): e for e in self.root.findall('c:library_nodes/c:node', NS)}
        effects = {}
        for e in self.root.findall('c:library_effects/c:effect', NS):
            color = e.find('.//c:diffuse/c:color', NS)
            effects[e.get('id')] = [float(x) for x in color.text.split()] if color is not None else [0.7, 0.7, 0.7, 1]
        self.materials = {}
        for m in self.root.findall('c:library_materials/c:material', NS):
            instance = m.find('c:instance_effect', NS)
            self.materials[m.get('id')] = glb.material(m.get('name', m.get('id')), effects[instance.get('url').lstrip('#')])
        self.mesh_cache = {}
        self.unique_triangles = 0
        self.instance_triangles = 0

    def geometry_mesh(self, geometry_id, bindings):
        key = (geometry_id, tuple(sorted(bindings.items())))
        if key in self.mesh_cache:
            return self.mesh_cache[key]
        mesh = self.geometry[geometry_id].find('c:mesh', NS)
        sources = {}
        for s in mesh.findall('c:source', NS):
            accessor = s.find('c:technique_common/c:accessor', NS)
            array = s.find('c:float_array', NS)
            if array is None:
                continue
            stride, count = int(accessor.get('stride', '1')), int(accessor.get('count'))
            offset = int(accessor.get('offset', '0'))
            data = np.fromstring(array.text, sep=' ', dtype=np.float32)
            sources[s.get('id')] = data[offset:offset + stride * count].reshape(count, stride)
        vertices = {}
        for v in mesh.findall('c:vertices', NS):
            vertices[v.get('id')] = {i.get('semantic'): i.get('source').lstrip('#') for i in v.findall('c:input', NS)}
        primitives, clouds, triangle_count = [], [], 0
        for part in mesh:
            tag = part.tag.split('}')[-1]
            if tag in ('source', 'vertices', 'extra'):
                continue
            if tag != 'triangles':
                raise ValueError(f'Unreviewed COLLADA primitive {tag} in {self.path}; refusing to omit or simplify it')
            inputs = part.findall('c:input', NS)
            width = max(int(i.get('offset', '0')) for i in inputs) + 1
            data = np.fromstring(part.findtext('c:p', '', NS), sep=' ', dtype=np.int64).reshape(-1, width)
            count = int(part.get('count'))
            assert len(data) == count * 3
            attributes = {}
            for i in inputs:
                semantic, source = i.get('semantic'), i.get('source').lstrip('#')
                if semantic == 'VERTEX':
                    source = vertices[source]['POSITION']
                    semantic = 'POSITION'
                if semantic in ('POSITION', 'NORMAL'):
                    attributes[semantic] = sources[source][data[:, int(i.get('offset', '0'))], :3]
                elif semantic != 'TEXCOORD':
                    raise ValueError(f'Unsupported COLLADA attribute {semantic}: {self.path}')
            positions = attributes['POSITION']
            normals = attributes.get('NORMAL')
            packed = positions if normals is None else np.concatenate([positions, normals], axis=1)
            unique, indices = np.unique(packed, axis=0, return_inverse=True)
            assert np.array_equal(unique[indices, :3], positions)
            material_id = bindings.get(part.get('material'), part.get('material'))
            if material_id not in self.materials:
                raise ValueError(f'Missing COLLADA material {material_id}: {self.path}')
            primitives.append(self.glb.primitive(unique[:, :3], unique[:, 3:] if normals is not None else None, indices, self.materials[material_id]))
            clouds.append(unique[:, :3])
            triangle_count += count
        result = (self.glb.mesh(f'{self.path.stem}:{geometry_id}', primitives), np.concatenate(clouds), triangle_count)
        self.mesh_cache[key] = result
        self.unique_triangles += triangle_count
        return result

    def clone_scene(self, parent, visual_world):
        scene = self.root.find('c:scene/c:instance_visual_scene', NS)
        visual_scene = self.visual_scenes[scene.get('url').lstrip('#')]
        collected = []
        scale = np.eye(4)
        scale[:3, :3] *= self.unit
        scene_node = self.glb.node(f'{self.path.stem}:scene', scale)
        self.glb.child(parent, scene_node)

        def visit(source, parent_id, parent_world):
            matrix = np.eye(4)
            for child in source:
                tag = child.tag.split('}')[-1]
                if tag == 'matrix':
                    matrix = matrix @ np.array([float(x) for x in child.text.split()]).reshape(4, 4)
                elif tag == 'translate':
                    m = np.eye(4)
                    m[:3, 3] = [float(x) for x in child.text.split()]
                    matrix = matrix @ m
                elif tag == 'scale':
                    matrix = matrix @ np.diag([*[float(x) for x in child.text.split()], 1])
                elif tag == 'rotate':
                    x, y, z, degrees = [float(x) for x in child.text.split()]
                    axis = np.array([x, y, z]); axis /= np.linalg.norm(axis)
                    x, y, z = axis
                    c, s = math.cos(math.radians(degrees)), math.sin(math.radians(degrees))
                    skew = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
                    m = np.eye(4); m[:3, :3] = c * np.eye(3) + (1 - c) * np.outer(axis, axis) + s * skew
                    matrix = matrix @ m
                elif tag in ('lookat', 'skew', 'instance_controller'):
                    raise ValueError(f'Unreviewed COLLADA transform {tag}: {self.path}')
            node = self.glb.node(source.get('name', source.get('id', 'node')), matrix)
            self.glb.child(parent_id, node)
            world = parent_world @ matrix
            for g in source.findall('c:instance_geometry', NS):
                bindings = {m.get('symbol'): m.get('target').lstrip('#') for m in g.findall('c:bind_material/c:technique_common/c:instance_material', NS)}
                mesh, points, triangles = self.geometry_mesh(g.get('url').lstrip('#'), bindings)
                self.glb.child(node, self.glb.node(f'{self.path.stem}:geometry', mesh=mesh))
                collected.append(transformed(points, world))
                self.instance_triangles += triangles
            for child in source.findall('c:node', NS):
                visit(child, node, world)
            for child in source.findall('c:instance_node', NS):
                visit(self.library_nodes[child.get('url').lstrip('#')], node, world)

        for n in visual_scene.findall('c:node', NS):
            visit(n, scene_node, visual_world @ scale)
        if not collected:
            raise ValueError(f'No COLLADA visual geometry: {self.path}')
        return np.concatenate(collected)


def resolve_mesh(spec, filename):
    if filename.startswith('package://'):
        package, relative = filename[len('package://'):].split('/', 1)
        path = PurePosixPath(spec['packagePaths'][package]) / relative
    else:
        path = PurePosixPath(spec['urdf']).parent / filename
    parts = []
    for p in path.parts:
        if p == '..':
            if not parts:
                raise ValueError(f'Mesh outside source root: {filename}')
            parts.pop()
        elif p != '.':
            parts.append(p)
    result = '/'.join(parts)
    if result not in {e['path'] for e in spec['files']}:
        raise ValueError(f'Mesh not covered by source lock: {result}')
    return result


def build_model(model_id, spec, offline):
    out = REPO / 'public/models' / model_id
    out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda e: download_file(model_id, spec, e, offline), spec['files']))
    source_path = out / 'source' / spec['urdf']
    raw = source_path.read_bytes()
    root = ET.fromstring(raw)
    shutil.copyfile(source_path, out / 'source.urdf')
    if spec.get('licensePath'):
        shutil.copyfile(out / 'source' / spec['licensePath'], out / 'LICENSE')
    notice = f"Source: https://github.com/{spec['repository']}\nCommit: {spec['commit']}\nURDF: {spec['urdf']}\n"
    notice += 'Local workbench only; no hardware validation.\n'
    if spec.get('license'):
        notice += f"Upstream license: {spec['license']}; see LICENSE.\n"
    else:
        notice += 'UPSTREAM MODEL LICENSE UNSPECIFIED. The source repository has no license file at the pinned revision.\nDo not infer licensing from the RP1 overview or other repositories. Do not publish or redistribute these model assets without applicable permission.\n'
    notice += 'Source bytes and physical parameters are preserved. Display GLB indexes all original triangles; STL normals are recomputed for display, COLLADA matrices/diffuse colors/normals are preserved. No mesh decimation.\nGLB groups are link-local visual assets, not extra rigid bodies.\n'
    (out / 'NOTICE').write_text(notice)
    glb = GLB()
    asset_prefix = f'models/{model_id}/'
    stl_cache, dae_cache, collision_assets = {}, {}, {}
    root_materials = {e.get('name'): e for e in root.findall('material')}
    links, joints, stats = [], [], {}

    def geometry(element):
        if element is None or len(element) != 1:
            raise ValueError('Expected one geometry shape')
        g = element[0]
        data = {'type': g.tag}
        if g.tag == 'mesh':
            path = resolve_mesh(spec, g.get('filename'))
            data.update(filename=g.get('filename'), scale=vec(g, 'scale', '1 1 1'), asset=f'{asset_prefix}source/{path}', sourcePath=path, vfsPath=f'{model_id}/{path}')
        elif g.tag == 'box':
            data['size'] = vec(g, 'size')
        elif g.tag == 'sphere':
            data['radius'] = float(g.get('radius'))
        elif g.tag in ('cylinder', 'capsule'):
            data.update(radius=float(g.get('radius')), length=float(g.get('length')))
        else:
            raise ValueError(f'Unknown source geometry: {g.tag}')
        return data

    for element in root.findall('link'):
        name = element.get('name')
        link = {'name': name, 'inertial': None, 'visuals': [], 'collisions': [], 'visualBounds': None}
        inertial = element.find('inertial')
        if inertial is not None:
            tensor = inertial.find('inertia')
            link['inertial'] = {'mass': float(inertial.find('mass').get('value')), **origin(inertial.find('origin')), 'tensor': [float(tensor.get(k, '0')) for k in ('ixx', 'iyy', 'izz', 'ixy', 'ixz', 'iyz')]}
        link_node = glb.node(name, extras={'sourceLink': name, 'linkLocal': True})
        glb.roots.append(link_node)
        for kind in ('visual', 'collision'):
            for index, e in enumerate(element.findall(kind)):
                data = {'name': e.get('name', f'{name}::{kind}:{index}'), **origin(e.find('origin')), 'geometry': geometry(e.find('geometry'))}
                if kind == 'collision':
                    if data['geometry']['type'] == 'mesh':
                        g = data['geometry']
                        collision_assets[g['vfsPath']] = {'vfsPath': g['vfsPath'], 'path': g['asset']}
                    link['collisions'].append(data)
                    continue
                material = e.find('material')
                if material is not None:
                    color = material.find('color')
                    if color is None and material.get('name') in root_materials:
                        color = root_materials[material.get('name')].find('color')
                    data['material'] = {'name': material.get('name', ''), 'rgba': vec(color, 'rgba', '0.7 0.7 0.7 1')}
                else:
                    data['material'] = {'name': 'default', 'rgba': [0.7, 0.7, 0.7, 1]}
                g = data['geometry']
                if g['type'] != 'mesh':
                    raise ValueError(f'Unreviewed primitive visual in {model_id}: {name}')
                matrix = pose_matrix(data) @ np.diag([*g['scale'], 1])
                data['glbNode'] = f'{name}::visual:{index}'
                visual_node = glb.node(data['glbNode'], matrix)
                glb.child(link_node, visual_node)
                path = out / 'source' / g['sourcePath']
                if path.suffix.lower() == '.stl':
                    if path not in stl_cache:
                        stl_cache[path] = read_stl(path)
                    points, normals, indices, count = stl_cache[path]
                    mid = glb.material(data['material']['name'], data['material']['rgba'])
                    mesh = glb.mesh(path.stem, [glb.primitive(points, normals, indices, mid)])
                    glb.child(visual_node, glb.node(path.stem, mesh=mesh))
                    data['bounds'] = bounds(transformed(points, matrix))
                    stats[g['sourcePath']] = {'triangles': count, 'vertices': len(points), 'format': 'binary-stl', 'positionReconstructionExact': True}
                elif path.suffix.lower() == '.dae':
                    if path not in dae_cache:
                        dae_cache[path] = Collada(path, glb)
                    dae = dae_cache[path]
                    data['bounds'] = bounds(dae.clone_scene(visual_node, matrix))
                    stats[g['sourcePath']] = {'triangles': dae.unique_triangles, 'instanceTriangles': dae.instance_triangles, 'format': 'collada', 'positionReconstructionExact': True, 'sourceUpAxis': 'Z_UP', 'unitMeter': dae.unit}
                else:
                    raise ValueError(f'Unreviewed visual mesh format: {path}')
                link['visuals'].append(data)
        link['visualBounds'] = union_bounds([v['bounds'] for v in link['visuals']])
        links.append(link)
    for e in root.findall('joint'):
        j = {'name': e.get('name'), 'type': e.get('type'), 'parent': e.find('parent').get('link'), 'child': e.find('child').get('link'), **origin(e.find('origin')), 'axis': vec(e.find('axis'), 'xyz', '1 0 0'), 'limit': {k: float(v) for k, v in e.find('limit').attrib.items()} if e.find('limit') is not None else {}, 'dynamics': {k: float(v) for k, v in e.find('dynamics').attrib.items()} if e.find('dynamics') is not None else {}}
        if e.find('mimic') is not None:
            j['mimic'] = dict(e.find('mimic').attrib)
        joints.append(j)
    roots = {l['name'] for l in links} - {j['child'] for j in joints}
    if len(roots) != 1 or len(joints) != len(links) - 1:
        raise ValueError(f'Expected connected source tree: {model_id}')
    assets = [{'path': f'{asset_prefix}source/{e["path"]}', 'sourcePath': e['path'], 'bytes': e['bytes'], 'gitBlobSha': e['gitBlobSha'], 'sha256': sha256((out / 'source' / e['path']).read_bytes())} for e in spec['files']]
    glb_info = glb.write(out / 'robot.glb', model_id)
    description = {'id': model_id, 'name': root.get('name'), 'root': next(iter(roots)), 'source': {'repository': spec['repository'], 'commit': spec['commit'], 'urdfPath': spec['urdf'], 'urdfSha256': sha256(raw), 'license': spec.get('license'), 'licenseStatus': 'specified' if spec.get('license') else 'unspecified-upstream', 'localOnly': True, 'meshAsset': f'{asset_prefix}robot.glb', 'urdfAsset': f'{asset_prefix}source.urdf', 'assets': assets, 'collisionAssets': list(collision_assets.values()), 'displayProcessing': 'All triangles retained. Exact position indexing; STL normals recomputed for display. COLLADA internal matrices, diffuse colors and normals preserved; no world-up conversion.'}, 'links': links, 'joints': joints}
    description['source']['repo'] = spec['repository']
    manifest = {'source': description['source'], 'summary': {'links': len(links), 'joints': len(joints), 'activeJoints': sum(j['type'] != 'fixed' for j in joints), 'mass': sum(l['inertial']['mass'] if l['inertial'] else 0 for l in links), 'visuals': sum(len(l['visuals']) for l in links), 'collisions': sum(len(l['collisions']) for l in links), 'meshFiles': len(stats), 'uniqueVisualTriangles': sum(s['triangles'] for s in stats.values())}, 'displayMeshes': stats, 'glb': glb_info, 'hardwareValidated': False, 'physicsValidated': False}
    (out / 'description.json').write_text(json.dumps(description, ensure_ascii=False, indent=2) + '\n')
    (out / 'provenance.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'model': model_id, **manifest['summary'], 'glbBytes': glb_info['bytes']}, ensure_ascii=False), flush=True)
    return description


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model', choices=['all', 'go2', 'rp1-24'], default='all')
    p.add_argument('--offline', action='store_true')
    args = p.parse_args()
    for model_id, spec in LOCK['models'].items():
        if args.model in ('all', model_id):
            build_model(model_id, spec, args.offline)
    descriptions = {}
    for model_id in LOCK['models']:
        path = REPO / 'public/models' / model_id / 'description.json'
        if path.is_file():
            descriptions[model_id] = json.loads(path.read_text())
    exports = {'go2': 'go2Description', 'rp1-24': 'rp1Description'}
    output = '// Generated by scripts/models/import-source-robots.py. SI units; source trees and physical parameters are unmodified.\n'
    for model_id, d in descriptions.items():
        output += f'export const {exports[model_id]} = ' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ' as const;\n'
    (REPO / 'src/source-robot-data.ts').write_text(output)


if __name__ == '__main__':
    main()
