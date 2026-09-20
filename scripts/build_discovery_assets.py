"""Detailed original discovery props; same materials and bevels as the playable robots."""
import bpy
import math
import os
import sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
import build_robot_assets as kit
from build_robot_assets import box, cyl, ring, sphere, rod

ROOT=kit.ROOT
OUT=os.path.join(ROOT,'public','models')
PORTRAITS=os.path.join(ROOT,'public','discoveries')
os.makedirs(PORTRAITS,exist_ok=True)
kit.M['enamel']=kit.material('Station teal enamel',(.07,.32,.31),.3,.34)
kit.M['red']=kit.material('Repair coral',(.72,.09,.045),.2,.38)
kit.M['amber']=kit.material('Amber beacon',(.94,.56,.065),.25,.25,.3)


def merge(objects,parent,label):
    materials={o.data.materials[0] for o in objects}
    for material in materials:
        group=[o for o in objects if o.data.materials[0]==material]
        objects=[o for o in objects if o not in group]
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        o=bpy.context.object
        o.name=label+'_'+material.name
        if parent:
            o.parent=parent
            o.matrix_parent_inverse=parent.matrix_world.inverted()


def chest():
    # Hollow armored trunk, separate rear-hinged lid and removable contents.
    box('Crate floor',(0,0,.18),(1.48,.98,.18),'navy',.07)
    for x in [-.66,.66]:
        box('Side wall',(x,0,.46),(.16,.98,.55),'enamel',.06)
        box('Side recessed panel',(x*1.11,0,.47),(.035,.55,.29),'navy',.02)
        ring('Side carrying handle',(x*1.17,0,.51),.13,.031,'steel',(0,math.pi/2,0))
    for y in [-.43,.43]:
        box('Front wall',(0,y,.46),(1.38,.14,.55),'enamel',.045)
        box('Recessed face panel',(0,y*1.18,.46),(.68,.025,.32),'navy',.02)
    for x in [-.49,.49]:
        box('Brass front strap',(x,-.52,.47),(.105,.045,.58),'gold',.018)
        box('Brass rear strap',(x,.52,.47),(.105,.045,.58),'gold',.018)
    for x in [-.63,.63]:
        for y in [-.4,.4]:
            box('Corner shoe',(x,y,.15),(.27,.25,.24),'dark',.055)
            cyl('Corner rivet',(x,y-.10,.3),.037,.04,'steel','Y',6)
    # Front medallion reads as supplies, with a milled central latch.
    cyl('Latch rim',(0,-.545,.58),.135,.065,'gold','Y',8)
    cyl('Latch core',(0,-.585,.58),.08,.03,'cream','Y',6)
    box('Key slot',(0,-.607,.58),(.025,.008,.07),'navy',.007)
    base=list(o for o in bpy.context.scene.objects if o.type=='MESH')
    box('Rounded lid',(0,0,.84),(1.55,1.05,.25),'enamel',.115)
    box('Lid inset',(0,-.01,.971),(.7,.66,.035),'teal',.02)
    for x in [-.49,.49]:
        box('Lid brass strap',(x,0,.98),(.12,.98,.075),'gold',.025)
        for y in [-.37,.37]:cyl('Lid rivet',(x,y,1.024),.036,.025,'steel',vertices=6)
        cyl('Rear hinge',(x,.48,.76),.074,.26,'steel','X')
    box('Lid latch tongue',(0,-.55,.82),(.19,.07,.21),'gold',.025)
    lidparts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in base]
    bpy.ops.object.empty_add(location=(0,.48,.76));lid=bpy.context.object;lid.name='Chest_Lid'
    bpy.context.view_layer.update();merge(lidparts,lid,'Lid')
    # Contents are hidden once the reward has flown out.
    before=set(bpy.context.scene.objects)
    for x,y,z in [(-.31,-.08,.50),(.1,.1,.56),(.37,-.13,.47)]:
        box('Supply ingot',(x,y,z),(.29,.27,.15),'gold',.035)
        cyl('Spare hex nut',(x,y,z+.13),.095,.09,'steel',vertices=6)
    bpy.ops.object.empty_add();loot=bpy.context.object;loot.name='Chest_Loot'
    merge([o for o in bpy.context.scene.objects if o.type=='MESH' and o not in before],loot,'Loot')
    merge(base,None,'Chest')


def repair():
    box('Rubber docking base',(0,0,.13),(1.35,1.05,.22),'navy',.11)
    box('Steel plinth',(0,0,.28),(1.14,.87,.13),'steel',.055)
    box('Rounded cabinet',(0,.07,.86),(.97,.61,1.14),'enamel',.14)
    box('Face gasket',(0,-.255,.94),(.78,.10,.78),'navy',.07)
    box('Ivory service panel',(0,-.318,.94),(.70,.058,.70),'cream',.055)
    box('Cross stem',(0,-.36,1.06),(.12,.035,.34),'red',.02)
    box('Cross arms',(0,-.375,1.06),(.34,.035,.12),'red',.02)
    box('Status screen',(0,-.365,.75),(.38,.025,.13),'navy',.025)
    for x in [-.11,0,.11]:box('Charge indicator',(x,-.382,.75),(.052,.013,.055),'cyan',.008)
    for x in [-.36,.36]:
        for z in [.63,1.24]:cyl('Face screw',(x,-.359,z),.027,.02,'steel','Y',6)
    for x in [-.3,.3]:
        box('Dock guide',(x,-.17,.365),(.08,.52,.065),'gold',.02)
    # A physical service hose and nozzle replace the plain rectangular block.
    ring('Service hose',(.58,.10,.82),.24,.043,'rubber',(math.pi/2,0,0))
    box('Nozzle holster',(.55,-.07,.68),(.12,.15,.24),'steel',.03)
    cyl('Service nozzle',(.56,-.10,.86),.065,.30,'gold')
    box('Top handle',(0,.08,1.49),(.43,.18,.15),'dark',.045)
    box('Handle grip',(0,.08,1.55),(.24,.20,.06),'cream',.02)
    cyl('Beacon socket',(-.31,.07,1.46),.08,.08,'dark')
    sphere('Ready beacon',(-.31,.07,1.56),(.065,.065,.08),'cyan')
    for z in [.76,.87,.98]:box('Rear vent',(0,.391,z),(.40,.025,.035),'navy',.01)
    merge([o for o in bpy.context.scene.objects if o.type=='MESH'],None,'Repair')


def salvage():
    cyl('Extraction platform',(0,0,.14),.95,.22,'navy',vertices=32)
    ring('Machined platform rim',(0,0,.26),.81,.047,'steel')
    for i in range(8):
        a=i*math.pi/4
        o=box('Safety stripe',(.78*math.cos(a),.78*math.sin(a),.29),(.16,.09,.05),'gold',.015)
        o.rotation_euler.z=a
    box('Salvage console',(0,.0,.57),(1.02,.75,.55),'enamel',.09)
    panel=box('Sloped console',(0,-.07,.90),(.92,.63,.14),'steel',.06)
    panel.rotation_euler.x=math.radians(14)
    screen=box('Screen bezel',(-.09,-.11,1.0),(.57,.43,.055),'navy',.04)
    screen.rotation_euler.x=math.radians(14)
    screen=box('Teal screen',(-.09,-.115,1.035),(.45,.31,.018),'cyan',.022)
    screen.rotation_euler.x=math.radians(14)
    for i in range(3):cyl('Control button',(.34,-.23+i*.13,.996+i*.03),.043,.027,'gold')
    for x in [-.35,.35]:
        cyl('Cabinet screw',(x,-.39,.65),.034,.025,'steel','Y',6)
    box('Intake slot',(0,-.39,.48),(.56,.035,.18),'navy',.025)
    for x in [-.2,-.1,0,.1,.2]:box('Intake rib',(x,-.42,.48),(.025,.034,.14),'steel',.007)
    cyl('Aerial foot',(.67,.25,.33),.16,.15,'gold')
    cyl('Telescopic antenna',(.67,.25,.97),.047,1.20,'steel')
    cyl('Beacon base',(.67,.25,1.54),.13,.095,'dark')
    cyl('Amber signal lens',(.67,.25,1.69),.115,.22,'amber')
    sphere('Beacon dome',(.67,.25,1.81),(.12,.12,.07),'amber')
    for i in range(4):
        a=i*math.pi/2
        rod('Beacon guard',(.67+.13*math.cos(a),.25+.13*math.sin(a),1.55),(.67+.13*math.cos(a),.25+.13*math.sin(a),1.81),.014,'steel')
    cyl('Beacon cap',(.67,.25,1.83),.15,.035,'dark')
    merge([o for o in bpy.context.scene.objects if o.type=='MESH'],None,'Salvage')


for kind in ['chest','repair','salvage']:
    scene=bpy.data.scenes.new('Discovery — '+kind)
    bpy.context.window.scene=scene
    {'chest':chest,'repair':repair,'salvage':salvage}[kind]()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'discovery-'+kind+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
    # Share the robot studio so props have matching light/material presentation.
    kit.PORTRAITS=PORTRAITS
    kit.studio(scene,kind,focus=(0,0,.6 if kind=='chest' else .9),scale=2.25 if kind!='salvage' else 2.5)
    print('DISCOVERY_READY',kind,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','discovery-kit.blend'))
