"""Original low-poly boss kit. Z-up / -Y front, exported as Y-up / +Z front.

Three directions considered: tall salvage crane, radial scrap spider, armored
industrial machines. The latter keeps danger readable from the game's high
camera: a broad furnace tank and a low, forward-heavy charging crusher.
Each model is merged by material; no external assets or textures required.
"""
import bpy
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')


def material(name, rgb, metal=.25, rough=.45, emission=0):
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
    'armor': material('Boss ochre enamel', (.72, .36, .065)),
    'red': material('Boss furnace vermilion', (.48, .07, .035)),
    'dark': material('Boss graphite', (.035, .065, .075), .45),
    'steel': material('Boss machined steel', (.43, .49, .47), .7),
    'ivory': material('Boss hazard ivory', (.91, .82, .59)),
    'heat': material('Boss furnace heat', (1, .22, .015), .1, .3, 1.8),
}


def finish(o, name, key, bevel=0):
    o.name = name
    o.data.materials.append(M[key])
    if bevel:
        m = o.modifiers.new('Machined edges', 'BEVEL')
        m.width = bevel
        m.segments = 2
        bpy.ops.object.modifier_apply(modifier=m.name)
        m = o.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def box(name, pos, size, key, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, key, bevel)


def cyl(name, pos, radius, depth, key, axis='Z', vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    o = bpy.context.object
    if axis == 'X':
        o.rotation_euler.y = math.pi / 2
    elif axis == 'Y':
        o.rotation_euler.x = math.pi / 2
    return finish(o, name, key, .015)


def tracks(width, length, height):
    for side in [-1, 1]:
        x = side * width
        box('Armored track', (x, 0, height), (.50, length, height*1.7), 'dark', .16)
        for y in [-length*.32, 0, length*.32]:
            cyl('Road wheel', (x+side*.255, y, height), height*.65, .08, 'steel', 'X')
            cyl('Hex hub', (x+side*.305, y, height), height*.27, .045, 'armor', 'X', 6)
        for i in range(9):
            y = -length*.41 + i*length*.102
            box('Track cleat', (x, y, height*1.87), (.54, .09, .055), 'steel', .012)
        box('Track fender', (x, 0, height*2.13), (.60, length*.88, .15), 'armor', .045)


def furnace():
    tracks(1.04, 1.9, .34)
    box('Lower chassis', (0, 0, .67), (1.85, 1.65, .52), 'dark', .12)
    box('Furnace vessel', (0, .02, 1.48), (1.56, 1.25, 1.35), 'red', .19)
    box('Shoulder deck', (0, 0, 2.10), (2.20, 1.48, .28), 'armor', .09)
    for side in [-1, 1]:
        x = side*.9
        box('Armored shoulder', (x, -.06, 1.66), (.46, 1.38, .67), 'armor', .10)
        cyl('Shoulder pivot', (x+side*.26, -.12, 1.66), .23, .09, 'steel', 'X')
        # Chimneys leave a distinctive twin-stack silhouette even from above.
        cyl('Exhaust stack', (side*.62, .43, 2.54), .16, .98, 'dark')
        cyl('Stack collar', (side*.62, .43, 2.87), .21, .15, 'steel')
        cyl('Hot exhaust throat', (side*.62, .43, 3.04), .115, .025, 'heat')
        for z in [1.10, 1.40, 1.70]:
            cyl('Armor bolt', (side*.67, -.665, z), .06, .055, 'steel', 'Y', 6)
    # Round, recessed furnace mouth with a glowing grate.
    cyl('Furnace door rim', (0, -.66, 1.44), .54, .19, 'steel', 'Y', 16)
    cyl('Furnace recess', (0, -.77, 1.44), .45, .045, 'dark', 'Y', 16)
    cyl('Molten core', (0, -.80, 1.44), .35, .025, 'heat', 'Y', 16)
    for x in [-.24, -.08, .08, .24]:
        box('Furnace grille', (x, -.835, 1.44), (.055, .07, .72 if abs(x)<.1 else .56), 'dark', .01)
    box('Command head', (0, -.20, 2.39), (1.02, .80, .43), 'dark', .08)
    box('Heavy brow', (0, -.64, 2.57), (1.12, .18, .16), 'armor', .04)
    for side in [-1, 1]:
        eye = box('Slanted optic', (side*.23, -.616, 2.39), (.31, .035, .085), 'heat', .01)
        eye.rotation_euler.y = side*-.15
    box('Front bumper', (0, -.98, .57), (1.90, .28, .27), 'steel', .05)
    for x in [-.6, -.3, 0, .3, .6]:
        stripe = box('Hazard tooth', (x, -1.13, .58), (.13, .025, .21), 'dark', .008)
        stripe.rotation_euler.y = -.35
    # Top-mounted mortar makes the area attack's origin legible.
    cyl('Mortar collar', (0, .25, 2.39), .32, .38, 'steel')
    cyl('Mortar barrel', (0, .25, 2.70), .26, .34, 'dark')
    cyl('Mortar bore', (0, .25, 2.88), .17, .025, 'heat')


def crusher():
    tracks(.75, 1.65, .29)
    box('Charger chassis', (0, .08, .67), (1.22, 1.35, .48), 'dark', .10)
    shell = box('Sloped armored hood', (0, .03, 1.10), (1.38, 1.28, .53), 'armor', .13)
    shell.rotation_euler.x = .14
    for side in [-1, 1]:
        box('Ivory racing stripe', (side*.43, .03, 1.39), (.14, 1.00, .035), 'ivory', .01).rotation_euler.x = .14
        cyl('Ram hydraulic', (side*.64, -.47, .83), .12, .70, 'steel', 'Y')
        box('Ram arm', (side*.65, -.84, .76), (.23, .66, .27), 'dark', .05)
        # Forward horns are broad wedge teeth, not fine details.
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.22, radius2=.07, depth=.58, location=(side*.70, -1.28, 1.01), rotation=(math.pi/2, 0, math.pi/4))
        finish(bpy.context.object, 'Crusher tusk', 'ivory', .015)
    box('Impact blade', (0, -1.02, .59), (1.84, .34, .63), 'red', .09)
    box('Blade cutting edge', (0, -1.21, .33), (1.90, .13, .13), 'steel', .02)
    for x in [-.48, -.16, .16, .48]:
        tooth = box('Ram hazard stripe', (x, -1.20, .64), (.16, .035, .40), 'ivory', .01)
        tooth.rotation_euler.y = -.32
    box('Watchtower', (0, .10, 1.65), (.91, .76, .52), 'dark', .10)
    box('Brow visor', (0, -.32, 1.87), (1.07, .32, .19), 'armor', .05)
    for x in [-.24, .24]:
        box('Angry optic', (x, -.30, 1.66), (.31, .04, .095), 'heat', .015)
    for x in [-.39, -.13, .13, .39]:
        box('Rear cooling fin', (x, .70, 1.22), (.08, .20, .49), 'steel', .02)
    cyl('Beacon base', (0, .25, 1.98), .17, .12, 'steel')
    cyl('Charge beacon', (0, .25, 2.12), .12, .18, 'heat')


for name, build in [('boss', furnace), ('miniboss', crusher)]:
    scene = bpy.data.scenes.new('Boss — ' + name)
    bpy.context.window.scene = scene
    build()
    for key, mat in M.items():
        group = [o for o in scene.objects if o.type == 'MESH' and o.data.materials[0] == mat]
        if not group:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        bpy.context.object.name = name + '_' + key
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'enemy-' + name + '.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True)
    triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type == 'MESH')
    print('BOSS_READY', name, 'triangles', triangles, flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'boss-kit.blend'))
