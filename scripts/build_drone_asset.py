"""Reproducible helper drone: static shell, independent fans and three role tools."""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name, color, metal=.25, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.36
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
amber=mat('Drone_Amber',(.92,.49,.09)); cream=mat('Drone_Ivory',(.9,.84,.65))
navy=mat('Drone_Navy',(.035,.095,.12)); steel=mat('Drone_Steel',(.21,.31,.34),.7)
light=mat('Drone_Status',(.2,.8,.95),.25,2); rubber=mat('Drone_Rubber',(.018,.029,.032),0)
root=bpy.data.objects.new('Helper_Drone',None); bpy.context.collection.objects.link(root)
def group(name, loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=root; o.location=loc; return o
shell=group('Shell')
def finish(o,name,material,parent=shell):
    o.name=name; o.data.materials.append(material); o.parent=parent
    for p in o.data.polygons:p.use_smooth=True
    return o
def box(name,loc,size,material,parent=shell,bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=o.modifiers.new('Soft edges','BEVEL'); m.width=bevel; m.segments=3; bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=m.name)
    return finish(o,name,material,parent)
def cyl(name,loc,radius,depth,material,parent=shell,axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=loc); o=bpy.context.object
    if axis=='Y':o.rotation_euler.x=math.pi/2
    m=o.modifiers.new('Rim','BEVEL');m.width=.012;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
    return finish(o,name,material,parent)
def ring(name,loc,major,minor,material,parent=shell):
    bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=major,minor_radius=minor,location=loc)
    return finish(bpy.context.object,name,material,parent)
box('Body',(0,0,0),(.75,.65,.31),amber,bevel=.12)
box('Lower armor',(0,0,-.13),(.63,.54,.14),navy,bevel=.06)
box('Face rim',(0,-.304,.025),(.56,.13,.24),cream,bevel=.075)
box('Face glass',(0,-.37,.03),(.45,.045,.155),navy,bevel=.045)
for x in [-.105,.105]:box('Eye',(x,-.4,.04),(.065,.018,.073),light,bevel=.024)
box('Top stripe',(0,0,.165),(.12,.42,.015),cream,bevel=.007)
for x in [-.24,.24]:
    for y in [-.09,0,.09]:box('Cooling vent',(x,y,.153),(.09,.035,.02),navy,bevel=.009)
for side in [-1,1]:
    x=side*.57
    box('Outrigger',(side*.4,0,-.015),(.35,.16,.10),steel)
    ring('Duct armor',(x,0,.08),.235,.055,cream)
    ring('Duct base',(x,0,-.015),.235,.033,navy)
    fan=group('Fan_L' if side<0 else 'Fan_R',(x,0,.045))
    cyl('Rotor hub',(0,0,0),.065,.07,amber,fan)
    for angle in [0,math.pi/3,2*math.pi/3]:
        blade=box('Blade',(0,0,0),(.41,.045,.025),navy,fan,.01);blade.rotation_euler.z=angle
    for angle in [0,math.pi/2]:
        rail=box('Duct guard',(x,0,.125),(.46,.025,.025),steel,bevel=.009);rail.rotation_euler.z=angle
    box('Landing skid',(side*.23,.08,-.26),(.055,.35,.055),steel,bevel=.02)
cyl('Antenna',(0,.23,.29),.016,.26,steel)
cyl('Beacon',(0,.23,.435),.039,.04,light)
collector=group('Tool_Collector')
box('Magnet mount',(0,-.10,-.23),(.12,.14,.16),steel,collector)
for x in [-.11,.11]:
    box('Magnet pole',(x,-.12,-.34),(.075,.11,.22),amber,collector,.025)
    box('Magnet tip',(x,-.12,-.45),(.077,.115,.055),light,collector,.015)
box('Magnet bridge',(0,-.12,-.25),(.29,.11,.075),amber,collector)
repair=group('Tool_Repair')
box('Repair housing',(0,-.09,-.26),(.26,.23,.19),cream,repair,.05)
cyl('Repair nozzle',(0,-.23,-.3),.06,.18,steel,repair,'Y')
cyl('Repair lens',(0,-.33,-.3),.045,.025,light,repair,'Y')
guard=group('Tool_Guard')
box('Guard mount',(0,-.08,-.26),(.29,.22,.19),navy,guard,.045)
for x in [-.075,.075]:
    cyl('Guard barrel',(x,-.24,-.29),.043,.23,steel,guard,'Y')
    cyl('Guard muzzle',(x,-.36,-.29),.034,.018,light,guard,'Y')
# Merge within each articulation/material to bound game draw calls.
for parent in [shell,collector,repair,guard]:
    meshes=[o for o in parent.children if o.type=='MESH']
    batches=[[o for o in meshes if o.data.materials[0]==m] for m in {o.data.materials[0] for o in meshes}]
    for selected in batches:
        bpy.ops.object.select_all(action='DESELECT')
        for o in selected:o.select_set(True)
        bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join()
        bpy.context.object.name=parent.name+'_'+bpy.context.object.data.materials[0].name
bpy.ops.object.select_all(action='DESELECT')
for o in [root,*root.children_recursive]:o.select_set(True)
os.makedirs(ROOT+'/public/models',exist_ok=True);os.makedirs(ROOT+'/art',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/helper-drone.glb',export_format='GLB',use_selection=True,export_apply=True)
for tool in [repair,guard]:
    for o in tool.children_recursive:o.hide_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world.color=(.12,.15,.17)
for name,loc,power,size in [('Key',(-3,-4,5),600,4),('Rim',(3,2,4),850,3),('Fill',(3,-3,1),180,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2,-4,2.5));camera=bpy.context.object;camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.25;scene.camera=camera
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/drone-kit.blend')
scene.render.filepath=ROOT+'/art/helper-drone.png';bpy.ops.render.render(write_still=True)
