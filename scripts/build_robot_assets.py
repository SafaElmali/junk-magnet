"""Original playable robot variants and matching transparent workshop portraits.
Run with Blender --background --factory-startup --python scripts/build_robot_assets.py.
The existing SCRAP GLB is read only; SCOUT, VOLT and MAGNA use the same rounded toy-machine language.
Name robots after `--` (for example `-- magna`) to rebuild only those; only a full build saves the
editable kit, so it always holds every robot.
"""
import bpy
import math
import os
import sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
import robot_rig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'public', 'models')
PORTRAITS = os.path.join(ROOT, 'public', 'robots')
os.makedirs(PORTRAITS, exist_ok=True)


def material(name, rgb, metal=.25, rough=.36, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    p.inputs['Emission Color'].default_value = (*rgb, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m


M = {
    'scout': material('Scout terracotta enamel', (.69, .24, .095)),
    'volt': material('Volt seafoam enamel', (.22, .58, .59), .32),
    'cream': material('Warm ivory', (.94, .87, .69), .08, .34),
    'navy': material('Midnight blue', (.025, .064, .095), .15),
    'blue': material('Cobalt glass', (.016, .16, .4), .4, .22),
    'glint': material('Sky highlight', (.15, .65, .9), .25, .23),
    'rubber': material('Rubber', (.04, .047, .042), 0, .9),
    'tread': material('Worn tread', (.075, .082, .07), 0, .83),
    'steel': material('Brushed steel', (.46, .5, .48), .72, .37),
    'dark': material('Gunmetal', (.15, .19, .19), .65, .45),
    'gold': material('Brass details', (.87, .52, .13), .65, .3),
    'copper': material('Copper windings', (.62, .24, .075), .72, .3),
    'teal': material('Teal accents', (.065, .32, .32), .35),
    'cyan': material('Electric ceramic', (.17, .73, .85), .22, .24, .45),
    # MAGNA; appended so the other robots' material merge order is unchanged.
    'magna': material('Magna cobalt enamel', (.035, .12, .52), .3),
    'red': material('Vermilion', (.63, .065, .035), .22, .4),
}
parts = []
# Fixed undercarriage and driven wheels/links export apart from the rocking body.
chassis = []
rig = []


def finish(o, name, key, bevel=0, smooth=False):
    o.name = name
    o.data.materials.append(M[key])
    if bevel:
        mod = o.modifiers.new('Soft machined edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    elif bevel:
        mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(o)
    return o


def box(name, p, size, key, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, key, bevel)


def sphere(name, p, size, key):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=p)
    o = bpy.context.object
    o.scale = size
    return finish(o, name, key, smooth=True)


def cyl(name, p, radius, depth, key, axis='Z', vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=p)
    o = bpy.context.object
    if axis == 'X':
        o.rotation_euler.y = math.pi / 2
    elif axis == 'Y':
        o.rotation_euler.x = math.pi / 2
    return finish(o, name, key, min(.02, depth * .18), True)


def ring(name, p, radius, tube, key, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=tube, major_segments=32, minor_segments=8, location=p, rotation=rotation)
    return finish(bpy.context.object, name, key, smooth=True)


def rod(name, a, b, radius, key):
    middle = (Vector(a) + Vector(b)) / 2
    o = cyl(name, middle, radius, (Vector(b) - Vector(a)).length, key)
    o.rotation_euler = (Vector(b) - Vector(a)).to_track_quat('Z', 'Y').to_euler()
    return o


def extrude(name, outline, depth, key, axis='Z', at=0, bevel=.03):
    """A prism from a 2D outline: top-view (x, y) points rising from z=at, or side-view (y, z)
    points centred on x=at."""
    if sum(ax * by - bx * ay for (ax, ay), (bx, by) in zip(outline, outline[1:] + outline[:1])) < 0:
        outline = outline[::-1]  # Counter-clockwise, so both caps face outward.
    n = len(outline)
    lift = (lambda a, b, h: (a, b, at + h)) if axis == 'Z' else (lambda a, b, h: (at + h - depth / 2, a, b))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([lift(a, b, h) for h in (0, depth) for a, b in outline], [],
                     [tuple(reversed(range(n))), tuple(range(n, 2 * n))] +
                     [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)])
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    return finish(o, name, key, bevel)


def horseshoe(outer, inner, length, y, segments=16):
    """Top view of a U magnet: the bend at the back (+Y), both arms reaching forward to the poles."""
    bend = [math.pi * i / segments for i in range(segments + 1)]
    return ([(outer, y - length)] + [(outer * math.cos(a), y + outer * math.sin(a)) for a in bend] +
            [(-outer, y - length), (-inner, y - length)] +
            [(inner * math.cos(a), y + inner * math.sin(a)) for a in reversed(bend)] + [(inner, y - length)])


def rounded(cy, cz, hy, hz, radius, segments=6):
    """Side view of a track block: a (y, z) rounded rectangle like robot_rig.belt()'s path."""
    return [(cy + sy * (hy - radius) + radius * math.cos(a), cz + sz * (hz - radius) + radius * math.sin(a))
            for k, (sy, sz) in enumerate([(1, 1), (-1, 1), (-1, -1), (1, -1)])
            for a in (math.pi / 2 * (k + i / segments) for i in range(segments + 1))]


def take(objects):
    for o in objects:
        parts.remove(o)
    return objects


def undercarriage(o):
    chassis.extend(take([o]))
    return o


def road_wheel(kind):
    """A painted wheel with a brass nut and lug bolts, so its spin reads in game."""
    hub = cyl('Painted road wheel', (0, 0, 0), .137, .045, kind, 'X')
    brass = [cyl('Brass axle', (.028, 0, 0), .061, .055, 'gold', 'X', 6)]
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        brass.append(cyl('Lug bolt', (.03, .1 * math.cos(a), .1 * math.sin(a)), .018, .02, 'gold', 'X', 6))
    return robot_rig.solid(take([hub] + brass))


def body(kind):
    width = .57 if kind == 'scout' else .63
    sphere('Rounded enamel shell', (0, 0, .79), (width, .46, .62), kind)
    sphere('Face gasket', (0, -.39, .85), (.46, .115, .43), 'navy')
    sphere('Ivory faceplate', (0, -.438, .855), (.429, .103, .398), 'cream')
    for x in [-.16, .16]:
        sphere('Eye socket', (x, -.526, .89), (.078, .025, .145), 'navy')
        sphere('Glass eye', (x, -.545, .90), (.059, .014, .119), 'blue')
        sphere('Eye glint', (x-.014, -.558, .96), (.023, .007, .036), 'glint')
    for side in [-1, 1]:
        x = side * .59
        undercarriage(box('Rubber track', (x, .01, .25), (.27, .94, .39), 'rubber', .13))
        undercarriage(box('Track fender', (x, .05, .51), (.3, .79, .07), kind, .032))
        for z in [.68, 1.12]:
            cyl('Face hex fastener', (side*.44, -.34, z), .032, .03, 'steel', 'Y', 6)
        cyl('Shoulder pivot', (side*.50, .11, 1.17), .11, .095, 'dark', 'X')
        cyl('Pivot bolt', (side*.557, .11, 1.17), .055, .03, 'gold', 'X', 6)
    rig.extend(robot_rig.wheels(road_wheel(kind), .74, [-.28, 0, .28], .25))
    link = take([box('Tread link', (0, 0, 0), (.29, .046, .05), 'tread', .012)])[0]
    rig.extend(robot_rig.treads(link, .59, robot_rig.belt(.01, .25, .47, .195, .13, .09)))
    box('Rear service panel', (0, .435, .78), (.52, .065, .53), kind, .08)
    for z in [.67, .77, .87]:
        box('Cooling vent', (0, .479, z), (.29, .02, .028), 'navy', .01)
    box('Lower bumper', (0, -.40, .42), (.45, .17, .12), 'dark', .04)
    for x in [-.13, .13]:
        cyl('Bumper light', (x, -.491, .43), .031, .014, 'cyan', 'Y')


def scout():
    body('scout')
    # Low-profile collector crown and raked aerials make a quick, agile silhouette.
    box('Crown saddle', (0, .035, 1.37), (.67, .39, .15), 'teal', .055)
    box('Collector bridge', (0, .025, 1.52), (.63, .24, .15), 'scout', .07)
    for side in [-1, 1]:
        box('Collector arm', (side*.27, .025, 1.70), (.13, .24, .35), 'scout', .055)
        box('Steel collector tip', (side*.27, .025, 1.9), (.14, .25, .13), 'steel', .025)
        rod('Raked antenna', (side*.46, .12, 1.18), (side*.64, .19, 1.96), .025, 'dark')
        sphere('Antenna beacon', (side*.64, .19, 1.97), (.071, .071, .071), 'gold')
        box('Utility pod', (side*.47, .40, .86), (.22, .28, .47), 'teal', .07)
        for z in [.76, .88, 1.0]:
            box('Pod trim', (side*.47, .55, z), (.17, .02, .024), 'steel', .008)
        box('Cheek guard', (side*.46, -.31, .74), (.14, .12, .20), 'scout', .05)
    box('Sensor housing', (0, -.19, 1.34), (.39, .22, .14), 'teal', .06)
    for x in [-.10, .10]:
        cyl('Sensor lens', (x, -.315, 1.35), .045, .033, 'cyan', 'Y')
    box('Ivory bonnet stripe', (0, .06, 1.419), (.13, .26, .025), 'cream', .01)


def volt():
    body('volt')
    box('Power backpack', (0, .40, 1.15), (.70, .33, .49), 'navy', .09)
    for side in [-1, 1]:
        x = side*.46
        cyl('Coil socket', (x, .11, 1.34), .19, .17, 'dark')
        cyl('Ceramic insulator', (x, .11, 1.62), .112, .49, 'cream')
        for z in [1.43, 1.52, 1.61, 1.70, 1.79]:
            ring('Copper coil winding', (x, .11, z), .139, .033, 'copper')
        cyl('Terminal base', (x, .11, 1.87), .19, .085, 'steel')
        sphere('Glass energy terminal', (x, .11, 2.015), (.181, .181, .171), 'cyan')
        ring('Terminal equator', (x, .11, 2.015), .185, .019, 'gold')
        rod('Power conduit', (x, .32, 1.34), (side*.34, .45, .82), .039, 'copper')
        box('Shoulder armor', (side*.50, -.13, 1.03), (.17, .28, .27), 'volt', .065)
    box('Central crown', (0, .03, 1.46), (.32, .3, .30), 'volt', .07)
    cyl('Energy gauge rim', (0, -.148, 1.49), .111, .065, 'gold', 'Y')
    cyl('Energy gauge glass', (0, -.188, 1.49), .079, .022, 'cyan', 'Y')
    for x in [-.20, 0, .20]:
        box('Backpack heat sink', (x, .595, 1.15), (.045, .10, .31), 'steel', .015)


def shell_y(x, z):
    """MAGNA's front (-Y) shell surface, for seating fasteners flush."""
    return -.5 * math.sqrt(max(0, 1 - (x / .66) ** 2 - ((z - .86) / .58) ** 2))


def magna():
    # Heavy magnet unit: a broad cobalt shell on long, deep tracks. The horseshoe magnet lies flat
    # over the head with its poles forward, so its U reads from the game's high camera.
    sphere('Rounded enamel shell', (0, 0, .86), (.66, .5, .58), 'magna')
    sphere('Face gasket', (0, -.43, .89), (.5, .12, .44), 'navy')
    sphere('Ivory faceplate', (0, -.478, .895), (.468, .106, .408), 'cream')
    for x in [-.175, .175]:
        sphere('Eye socket', (x, -.566, .93), (.084, .025, .15), 'navy')
        sphere('Glass eye', (x, -.585, .94), (.063, .014, .122), 'blue')
        sphere('Eye glint', (x - .015, -.598, 1.0), (.024, .007, .037), 'glint')
    for side in [-1, 1]:
        x = side * .62
        # The rubber block follows the belt's profile, so links hug its rounded ends.
        undercarriage(extrude('Rubber track', rounded(0, .29, .547, .212, .177), .3, 'rubber', 'X', x))
        undercarriage(box('Track fender', (x, 0, .59), (.34, .96, .07), 'magna', .032))
        for z in [.7, 1.1]:
            cyl('Face hex fastener', (side * .5, shell_y(.5, z) - .005, z), .032, .03, 'steel', 'Y', 6)
        cyl('Shoulder pivot', (side * .6, .1, 1.1), .125, .1, 'dark', 'X')
        cyl('Pivot bolt', (side * .66, .1, 1.1), .06, .03, 'gold', 'X', 6)
        rod('Magnet strut', (side * .6, .1, 1.1), (side * .36, -.12, 1.54), .038, 'steel')
    # Big idlers at each end and a road wheel between: one wheel mesh at two sizes.
    rig.extend(robot_rig.sized_wheels(road_wheel('magna'), .79, [(-.37, .29, 1.2), (0, .22, .92), (.37, .29, 1.2)]))
    link = take([box('Tread link', (0, 0, 0), (.31, .046, .05), 'tread', .012)])[0]
    rig.extend(robot_rig.treads(link, .62, robot_rig.belt(0, .29, .57, .235, .2, .09)))
    # A flat U raised on a gunmetal mount, with steel pole shoes behind glowing field bands.
    extrude('Horseshoe magnet', horseshoe(.5, .22, .45, 0), .19, 'red', 'Z', 1.5)
    box('Magnet mount', (0, .36, 1.42), (.34, .2, .22), 'dark', .05)
    for side in [-1, 1]:
        box('Steel pole shoe', (side * .36, -.525, 1.595), (.3, .15, .23), 'steel', .03)
        box('Field band', (side * .36, -.45, 1.595), (.32, .035, .245), 'cyan', .008)
    for a in [-.35, 0, .35]:
        cyl('Bend rivet', (.36 * math.sin(a), .36 * math.cos(a), 1.695), .026, .02, 'gold', 'Z', 6)
    box('Rear service panel', (0, .49, .84), (.54, .065, .5), 'magna', .08)
    for z in [.72, .82, .92]:
        box('Cooling vent', (0, .525, z), (.3, .02, .028), 'navy', .01)
    box('Counterweight', (0, .45, .47), (.5, .16, .2), 'dark', .05)
    box('Front bumper', (0, -.47, .45), (.56, .17, .13), 'dark', .04)
    # Brass hazard stripes share the bolts' material, saving a draw call.
    for x in [-.15, -.05, .05, .15]:
        box('Hazard stripe', (x, -.558, .45), (.045, .012, .12), 'gold', .004).rotation_euler.y = math.pi / 4
    for x in [-.23, .23]:
        cyl('Bumper light', (x, -.558, .45), .03, .014, 'cyan', 'Y')


def merge(objects, label):
    merged = []
    for material in M.values():
        group = [o for o in objects if o.data.materials[0] == material]
        if not group:
            continue
        objects = [o for o in objects if o not in group]
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        bpy.context.object.name = label + '_' + material.name
        merged.append(bpy.context.object)
    return merged


def export_model(kind, pivot=.45, **options):
    global parts, chassis, rig
    # Merge by material so detailed bolts do not each cost a draw call. The body merges apart from
    # the fixed chassis because the game rocks it on its suspension.
    body = robot_rig.pivot(merge(parts, kind), (0, 0, pivot))
    exported = [body, *body.children, *merge(chassis, kind + '_chassis'), *rig]
    bpy.ops.object.select_all(action='DESELECT')
    for o in exported:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'robot-'+kind+'.glb'), export_format='GLB', use_selection=True, export_apply=True, **options)
    parts, chassis, rig = [], [], []


def studio(scene, kind, focus=(0, 0, 1.05), scale=2.8):
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.world = bpy.data.worlds.new('Robot studio '+kind)
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (.60, .72, .80, 1)
    bg.inputs[1].default_value = .55
    scene.view_settings.view_transform = 'AgX'
    for name, p, energy, size in [('Key', (-3,-4,6), 650, 4), ('Rim', (3,2,4), 850, 3), ('Fill', (4,-3,2), 220, 3)]:
        bpy.ops.object.light_add(type='AREA', location=p)
        o=bpy.context.object
        o.name=name
        o.data.energy=energy
        o.data.shape='DISK'
        o.data.size=size
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(3.2,-6,3.0))
    cam=bpy.context.object
    cam.rotation_euler=(Vector(focus)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=scale
    scene.camera=cam
    scene.render.filepath=os.path.join(PORTRAITS,kind+'.png')
    bpy.ops.render.render(write_still=True)


BUILDERS = {'scout': scout, 'volt': volt, 'magna': magna}
# MAGNA's taller tracks raise its suspension pivot. It exports only its own scene (not the
# startup cube's) and no UVs, which its untextured materials never read, to keep the GLB small.
# Its shorter, wider body is framed a little lower in the portrait.
EXPORT = {'magna': {'pivot': .5, 'use_active_scene': True, 'export_texcoords': False}}
FRAMING = {'magna': {'focus': (0, 0, .9)}}


def build_assets():
    global parts
    wanted = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for kind in [k for k in ['scrap','scout','volt','magna'] if not wanted or k in wanted]:
        scene=bpy.data.scenes.new('Robot — '+kind)
        bpy.context.window.scene=scene
        parts=[]
        if kind=='scrap':
            bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS,'robot.glb'))
        else:
            BUILDERS[kind]()
            export_model(kind, **EXPORT.get(kind, {}))
        studio(scene,kind,**FRAMING.get(kind, {}))
        # Object names are global across scenes: free the rig names for the next robot.
        for o in scene.objects:
            o.name=kind+' '+o.name
        print('ROBOT_READY',kind,flush=True)
    if not wanted:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','robot-kit.blend'))


if __name__ == '__main__':
    build_assets()
