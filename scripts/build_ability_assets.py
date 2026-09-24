"""Original toy-machined ability kit. Seventeen editable Blender scenes and transparent UI renders.

Pass ability ids after `--` to re-render only those icons; every scene is still rebuilt and saved."""
import bpy, math, os, sys
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'abilities')
DRONE = os.path.join(ROOT, 'public', 'models', 'helper-drone.glb')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, color, metal=0.25, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.32
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
M={k:material(k,c,metal,em) for k,c,metal,em in [
 ('gold',(.92,.53,.075),.5,0),('cream',(.93,.85,.64),.2,0),('navy',(.025,.066,.085),.45,0),
 ('teal',(.065,.38,.38),.4,0),('red',(.7,.075,.035),.3,0),('steel',(.49,.58,.56),.75,0),
 ('rubber',(.026,.038,.041),.1,0),('cyan',(.13,.85,1),.25,1.4),
 ('molten',(.86,.17,.008),.1,.12),('crust',(.13,.055,.03),.2,0) ]}

def finish(o,name,mat,bevel=0):
    o.name=name; o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('Soft machined edge','BEVEL'); mod.width=bevel; mod.segments=3
        mod=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o

def box(name,p,s,mat,bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.scale=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,bevel)

def cyl(name,p,r,d,mat,axis='Z',vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d,location=p);o=bpy.context.object
    if axis=='Y': o.rotation_euler[0]=math.pi/2
    if axis=='X': o.rotation_euler[1]=math.pi/2
    return finish(o,name,mat,.025)

def ring(name,p,r,t,mat,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=48,minor_segments=12,location=p,rotation=rot)
    o=bpy.context.object
    for face in o.data.polygons: face.use_smooth=True
    return finish(o,name,mat)

def poly(name,points,depth,mat,y=0):
    n=len(points); vs=[(x,y+d,z) for d in [-depth/2,depth/2] for x,z in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return finish(o,name,mat,.035)

def rod(name,a,b,r,mat,vertices=24):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return finish(o,name,mat,.02)

def cone(name,p,r1,r2,d,mat,rot=(0,0,0),vertices=40):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=d,location=p,rotation=rot)
    return finish(bpy.context.object,name,mat,.02)

def blob(name,p,r,mat,squash=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3,radius=r,location=p);o=bpy.context.object
    o.scale=(1,1,squash)
    for face in o.data.polygons: face.use_smooth=True
    return finish(o,name,mat)

def bolt(x,y,z,scale=1,mat='gold'):
    pts=[(-.04,.8),(-.5,.05),(-.12,.05),(-.27,-.7),(.5,.23),(.12,.23),(.3,.8)]
    return poly('Lightning conductor',[(x+a*scale,z+b*scale) for a,b in pts],.17*scale,mat,y)

def screws(xs,z,y):
    for x in xs:
        cyl('Hex fastener',(x,y,z),.055,.055,'steel','Y',6)

def saw(x=0,y=0,z=1,r=.88):
    pts=[]
    for i in range(48):
        a=i*math.tau/48; rr=r*(1 if i%3==0 else .82)
        pts.append((x+rr*math.cos(a),z+rr*math.sin(a)))
    poly('Saw teeth',pts,.14,'steel',y)
    cyl('Blade hub',(x,y-.12,z),r*.38,.15,'teal','Y')
    cyl('Gold axle',(x,y-.22,z),r*.15,.13,'gold','Y',6)

def magnet():
    pts=[(-.82,1.85),(-.82,.87)]
    pts += [(.82*math.cos(a),.87+.82*math.sin(a)) for a in [math.pi+i*math.pi/20 for i in range(21)]]
    pts += [(.82,1.85),(.4,1.85),(.4,.87)]
    pts += [(.4*math.cos(a),.87+.4*math.sin(a)) for a in [math.tau-i*math.pi/20 for i in range(21)]]
    pts += [(-.4,1.85)]
    poly('Horseshoe magnet',pts,.44,'red')
    for x in [-.61,.61]:
        box('Steel pole',(x,0,1.83),(.43,.48,.29),'cream',.035)
        screws([x],1.2,-.25)

def drone(role):
    # Import the gameplay drone so its icon matches the yard; keep only this role's tool.
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=DRONE)
    imported=[o for o in bpy.data.objects if o not in before]
    def tool(o):
        while o:
            base=o.name.split('.')[0]
            if base.startswith('Tool_'): return base.split('_')[1]
            o=o.parent
    for o in [o for o in imported if tool(o) not in (None,role.capitalize())]: bpy.data.objects.remove(o)
    # Shared kit materials keep the drone icons consistent with the other ten renders.
    shared={'Amber':'gold','Ivory':'cream','Navy':'navy','Steel':'steel','Status':'cyan','Rubber':'rubber'}
    for o in bpy.data.objects:
        if o not in before and o.type=='MESH':
            o.data.materials[0]=M[shared[o.data.materials[0].name.split('.')[0].split('_')[1]]]
    root=next(o for o in bpy.data.objects if o not in before and o.name.split('.')[0]=='Helper_Drone')
    root.scale=(1.38,1.38,1.38); root.location=(-.1,.2,1.5); root.rotation_euler=(0,0,math.radians(-18))

def build(id):
    if id=='saw':
        saw();ring('Orbit path',(0,.2,1),1.12,.035,'gold');cyl('Orbiting rivet',(1,.13,1.5),.12,.15,'gold','Y',6)
    elif id=='lightning':
        cyl('Coil foot',(0,0,.19),.7,.25,'navy');cyl('Insulator',(0,0,.75),.35,1,'teal')
        for z in [.45,.62,.79,.96,1.13]:ring('Copper winding',(0,0,z),.37,.065,'gold',(0,0,0))
        cyl('Top terminal',(0,0,1.33),.45,.17,'steel');bolt(0,-.48,1.32,.95,'cyan')
    elif id=='turret':
        cyl('Rotating base',(0,0,.25),.73,.35,'navy');cyl('Pivot',(0,0,.65),.27,.5,'gold')
        box('Turret housing',(0,.03,1.14),(1.2,.9,.7),'teal',.13)
        for x in [-.33,.33]:
            cyl('Barrel',(x,-.75,1.22),.16,1.0,'steel','Y');cyl('Muzzle',(x,-1.27,1.22),.19,.15,'navy','Y');cyl('Bore',(x,-1.36,1.22),.09,.025,'rubber','Y')
        box('Gold armor',(0,0,1.53),(.8,.75,.13),'gold');cyl('Sight',(0,-.46,1.35),.08,.07,'cyan','Y')
    elif id=='burst':
        cyl('Emitter',(0,0,.82),.6,.48,'teal','Y');cyl('Core',(0,-.3,.82),.3,.2,'gold','Y')
        for r in [.72,1.04]:ring('Expanding field',(0,-.34,.82),r,.055,'cyan')
        for x,z in [(-1.14,.82),(1.14,.82),(0,1.96),(0,-.32)]:box('Pulse spark',(x,-.34,z),(.14,.13,.2),'cream',.03)
    elif id=='harpoon':
        # A magnet-tipped hook on a steel shaft, its cable spooled on a reel.
        tail,tip=Vector((-.5,0,.72)),Vector((.72,0,1.66))
        axis=(tip-tail).normalized();side=Vector((-axis.z,0,axis.x))
        rod('Harpoon shaft',tail,tip,.1,'steel')
        for t in [.3,.42]:ring('Magnet collar',tail+(tip-tail)*t,.15,.05,'gold',(tip-tail).to_track_quat('Z','Y').to_euler())
        poly('Hook head',[(p.x,p.z) for p in [tip+axis*.62,tip-axis*.05+side*.36,tip+axis*.08,tip-axis*.05-side*.36]],.26,'red')
        poly('Hook tip',[(p.x,p.z) for p in [tip+axis*.66,tip+axis*.36+side*.12,tip+axis*.36-side*.12]],.3,'cream')
        for s in [-1,1]:
            base=tip-axis*.18
            poly('Hook barb',[(p.x,p.z) for p in [base+side*s*.08,base-axis*.42+side*s*.42,base-axis*.2+side*s*.08]],.16,'gold')
        cyl('Cable reel',(-.68,.05,.66),.48,.26,'navy','Y');cyl('Reel hub',(-.68,-.12,.66),.16,.1,'gold','Y',6)
        for r in [.27,.36]:ring('Spooled cable',(-.68,-.1,.66),r,.04,'rubber')
        rod('Taut cable',(-.68,-.14,1.02),tail,.03,'rubber',8)
    elif id=='slag':
        # A stubby salvage mortar lobbing molten slag over a burning puddle.
        cyl('Mortar base',(-.25,0,.2),.62,.26,'navy');box('Base plate',(-.25,0,.36),(.9,.8,.1),'steel',.03)
        rod('Mortar tube',(-.35,0,.42),(.2,0,1.45),.3,'teal')
        for t in [.35,.75]:ring('Tube band',Vector((-.35,0,.42)).lerp(Vector((.2,0,1.45)),t),.31,.05,'gold',(Vector((.55,0,1.03))).to_track_quat('Z','Y').to_euler())
        ring('Muzzle',(.2,0,1.45),.29,.06,'rubber',(Vector((.55,0,1.03))).to_track_quat('Z','Y').to_euler())
        blob('Slag shell',(.62,-.05,1.95),.2,'molten');blob('Slag drip',(.44,-.05,1.72),.07,'molten')
        cyl('Crust',(.72,-.35,.06),.62,.06,'crust',vertices=40);blob('Molten puddle',(.72,-.35,.11),.5,'molten',.14)
        for x,y in [(.32,-.72),(1.12,-.52)]:blob('Splash',(x,y,.14),.07,'molten')
    elif id=='capacitor':
        # Three charged cells on a bus bar: shorter weapon cooldowns.
        box('Bus base',(0,0,.22),(1.75,.8,.3),'navy',.06);box('Bus bar',(0,-.42,.3),(1.55,.06,.12),'gold',.02)
        for x in [-.55,0,.55]:
            cyl('Cell casing',(x,0,.95),.26,1.1,'teal');cyl('Cell band',(x,0,.67),.27,.18,'cream')
            cyl('Terminal cap',(x,0,1.53),.2,.08,'steel');cyl('Terminal post',(x,0,1.62),.07,.14,'gold',vertices=6)
        rod('Jumper',(-.55,0,1.66),(.55,0,1.66),.035,'gold',8)
        bolt(0,-.34,1.02,.62,'cyan')
    elif id=='amplifier':
        # An emitter pushing its field outward: larger area effects.
        for r,z in [(1.3,.05),(.98,.08),(.66,.11)]:ring('Field ring',(0,0,z),r,.045,'cyan',(0,0,0))
        cyl('Emitter base',(0,0,.22),.45,.3,'navy');cyl('Emitter column',(0,0,.62),.2,.55,'steel')
        cone('Amplifier dish',(0,0,1.07),.12,.62,.38,'teal');ring('Dish rim',(0,0,1.26),.62,.05,'gold',(0,0,0))
        blob('Field core',(0,0,1.28),.17,'cyan')
        for a in [math.radians(d) for d in (-20,70,160,250)]:
            c,s=math.cos(a),math.sin(a);cx,cy=c*1.5,s*1.5
            bpy.ops.mesh.primitive_cone_add(vertices=3,radius1=.16,depth=.34,location=(cx,cy,.14),rotation=(0,math.pi/2,a))
            finish(bpy.context.object,'Growth arrow','gold',.02)
    elif id=='boots':
        box('Tread body',(0,0,.55),(1.35,1.1,.7),'rubber',.24)
        for x in [-.55,-.27,0,.27,.55]:box('Tread grip',(x,-.01,.91),(.15,1.1,.14),'steel',.025)
        for x in [-.43,0,.43]:cyl('Wheel',(x,-.58,.55),.23,.11,'gold','Y');cyl('Axle',(x,-.66,.55),.09,.06,'navy','Y')
        box('Rocket mount',(0,.07,1.17),(.85,.7,.43),'teal')
        for x in [-.25,.25]:
            cyl('Booster',(x,.12,1.51),.21,.56,'red');cyl('Nozzle',(x,.12,1.23),.23,.14,'navy')
        bolt(.73,-.3,1.55,.48)
    elif id=='magnet':magnet()
    elif id=='armor':
        pts=[(-.85,1.82),(0,2.04),(.85,1.82),(.72,.68),(0,.08),(-.72,.68)]
        poly('Shield rim',pts,.32,'steel');poly('Enamel shield',[(x*.85,(z-1)*.85+1) for x,z in pts],.14,'teal',-.25)
        poly('Central stripe',[(-.12,1.78),(.12,1.78),(.1,.72),(0,.51),(-.1,.72)],.075,'gold',-.35)
        screws([-.52,.52],1.57,-.37)
    elif id=='repair':
        box('Repair kit',(0,0,.93),(1.6,.75,1.35),'cream',.15)
        box('Handle',(0,0,1.71),(.7,.33,.32),'navy',.1);box('Handle inset',(0,-.02,1.73),(.4,.36,.12),'rubber',.03)
        box('Cross upright',(0,-.43,.97),(.25,.13,.8),'red',.035);box('Cross arms',(0,-.43,.97),(.8,.13,.25),'red',.035)
        for x in [-.61,.61]:box('Corner band',(x,-.015,.93),(.12,.79,1.37),'teal',.025)
    elif id=='refill':
        box('Supply crate',(0,.02,.62),(1.6,1.05,1.02),'teal',.06)
        for z in [.2,1.06]:box('Crate rail',(0,-.56,z),(1.7,.12,.17),'gold',.035)
        for x in [-.7,.7]:box('Crate frame',(x,-.55,.63),(.16,.15,1.04),'gold',.035)
        saw(.1,0,1.47,.56);cyl('Spare bolt',(-.55,-.2,1.41),.1,.6,'steel');cyl('Bolt head',(-.55,-.2,1.73),.19,.16,'gold',vertices=6)
        ring('Spare nut',(.58,.11,1.3),.22,.09,'steel')
    elif id=='overclock':
        box('Processor',(0,0,1),(1.3,.45,1.4),'navy',.1);box('Chip plate',(0,-.26,1),(1.03,.12,1.11),'red',.06)
        for i in range(5):
            z=.48+i*.26
            for x in [-.77,.77]:box('Gold contact',(x,0,z),(.3,.24,.1),'gold',.02)
        bolt(0,-.4,1,.64,'gold');cyl('Status light',(.43,-.35,1.48),.055,.04,'cyan','Y')
    elif id=='drone_collector':
        drone('collector')
        for z,r in [(.72,.36),(.5,.27)]:ring('Pull field',(-.14,.05,z),r,.032,'cyan',(0,0,0))
        ring('Pulled nut',(-.4,-.55,.02),.33,.14,'steel',(math.pi/2,.5,0))
        cyl('Pulled bolt',(.46,-.45,.02),.12,.66,'steel');cyl('Bolt head',(.46,-.45,.44),.25,.18,'gold',vertices=6)
    elif id=='drone_repair':
        drone('repair')
        ring('Repair aura',(.05,-.2,-.05),.85,.045,'cyan',(0,0,0))
        box('Cross backing upright',(.6,-.62,.35),(.5,.1,1.25),'cream',.06);box('Cross backing arms',(.6,-.62,.35),(1.25,.09,.5),'cream',.06)
        box('Cross upright',(.6,-.7,.35),(.3,.1,1.0),'red',.04);box('Cross arms',(.6,-.7,.35),(1.0,.09,.3),'red',.04)
    elif id=='drone_guard':
        drone('guard')
        for x,y in [(-.34,-.875),(-.536,-.811)]:
            cyl('Tracer round',(x,y,1.1),.06,.6,'cyan','Y').rotation_euler=(math.pi/2,0,math.radians(-18))
        pts=[(-.3,.62),(0,.72),(.3,.62),(.25,.2),(0,-.02),(-.25,.2)]
        crest=lambda k:[(x*k+.6,(z-.35)*k+.3) for x,z in pts]
        poly('Guard crest',crest(1.9),.16,'red',-.55);poly('Crest face',crest(1.35),.08,'cream',-.66)
        poly('Crest stripe',[(.6+x*1.35,(z-.35)*1.35+.3) for x,z in [(-.05,.6),(.05,.6),(.045,.2),(0,.08),(-.045,.2)]],.05,'gold',-.72)

IDS=['saw','lightning','turret','burst','boots','magnet','armor','repair','refill','overclock','drone_collector','drone_repair','drone_guard','harpoon','slag','capacitor','amplifier']
ONLY=set(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else IDS)
for id in IDS:
    scene=bpy.data.scenes.new('Ability — '+id);bpy.context.window.scene=scene
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.world=bpy.data.worlds.new('Studio '+id);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.6,.72,.8,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.55
    scene.view_settings.view_transform='AgX'
    build(id)
    for name,p,power,size in [('Key',(-3,-4,6),650,4),('Rim',(3,2,4),850,3),('Fill',(4,-3,2),220,3)]:
        bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(3.1,-6,3.2));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.95;scene.camera=cam
    if id not in ONLY: continue
    scene.render.filepath=os.path.join(OUT,id+'.png');bpy.ops.render.render(write_still=True)
    print('ABILITY_RENDERED',id,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','ability-kit.blend'))
