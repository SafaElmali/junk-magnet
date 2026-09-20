"""Original playable robot variants and matching transparent workshop portraits.
Run with Blender --background --factory-startup --python scripts/build_robot_assets.py.
The existing SCRAP GLB is read only; SCOUT and VOLT use the same rounded toy-machine language.
"""
import bpy
import math
import os
from mathutils import Vector

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
}
parts = []


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
        box('Rubber track', (x, .01, .25), (.27, .94, .39), 'rubber', .13)
        for y in [-.28, 0, .28]:
            cyl('Painted road wheel', (side*.74, y, .25), .137, .045, kind, 'X')
            cyl('Brass axle', (side*.768, y, .25), .061, .055, 'gold', 'X', 6)
        for i in range(10):
            box('Top tread', (x, -.395+i*.09, .444), (.29, .046, .05), 'tread', .012)
        for y in [-.46, .48]:
            for z in [.15, .24, .33]:
                box('End tread', (x, y, z), (.29, .04, .046), 'tread', .01)
        box('Track fender', (x, .05, .51), (.3, .79, .07), kind, .032)
        for z in [.68, 1.12]:
            cyl('Face hex fastener', (side*.44, -.34, z), .032, .03, 'steel', 'Y', 6)
        cyl('Shoulder pivot', (side*.50, .11, 1.17), .11, .095, 'dark', 'X')
        cyl('Pivot bolt', (side*.557, .11, 1.17), .055, .03, 'gold', 'X', 6)
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


def export_model(kind):
    global parts
    # Merge by material so detailed bolts/treads do not each cost a draw call.
    for material in M.values():
        group = [o for o in list(parts) if o.data.materials[0] == material]
        if not group:
            continue
        parts = [o for o in parts if o not in group]
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        bpy.context.object.name = kind + '_' + material.name
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, 'robot-'+kind+'.glb'), export_format='GLB', use_selection=True, export_apply=True)


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


def build_assets():
    global parts
    for kind in ['scrap','scout','volt']:
        scene=bpy.data.scenes.new('Robot — '+kind)
        bpy.context.window.scene=scene
        parts=[]
        if kind=='scrap':
            bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS,'robot.glb'))
        else:
            scout() if kind=='scout' else volt()
            export_model(kind)
        studio(scene,kind)
        print('ROBOT_READY',kind,flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','robot-kit.blend'))


if __name__ == '__main__':
    build_assets()
