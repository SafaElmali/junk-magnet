"""Original Junk Magnet asset kit. Blender Z-up/-Y front -> glTF Y-up/+Z front."""
import bpy,math,random,os,sys
from mathutils import Vector
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));sys.dont_write_bytecode=True;import robot_rig
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));OUT=os.path.join(ROOT,'public','models')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);random.seed(18)
def mat(n,c,metal=0,rough=.5):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
M={'yellow':mat('Butter yellow',(.94,.61,.035),.25,.36),'cream':mat('Warm ivory',(.94,.87,.69),.08,.34),'navy':mat('Midnight blue',(.025,.064,.095),.15,.36),'blue':mat('Cobalt glass',(.016,.16,.4),.4,.22),'glint':mat('Sky highlight',(.15,.65,.9),.25,.23),'rubber':mat('Rubber',(.04,.047,.042),0,.9),'tread':mat('Worn tread',(.075,.082,.07),0,.83),'red':mat('Vermilion',(.63,.065,.035),.22,.4),'silver':mat('Brushed steel',(.46,.5,.48),.72,.37),'darksteel':mat('Gunmetal',(.15,.19,.19),.65,.45),'rust':mat('Rust',(.35,.13,.05),.22,.91),'teal':mat('Sea green',(.11,.39,.38),.28,.64),'teallight':mat('Raised ribs',(.16,.48,.46),.3,.59),'orange':mat('Traffic orange',(.91,.19,.035),0,.55),'white':mat('Tape',(.93,.9,.79),.1,.5)}
parts=[];chassis=[];rig=[];assets=[]
def finish(o,n,m):
 o.name=n;o.data.materials.append(M[m]);parts.append(o);return o
def take(o):
 parts.remove(o);return o
def cube(n,loc,s,m,b=.05):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  mod=o.modifiers.new('Soft edge','BEVEL');mod.width=b;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,m)
def sphere(n,loc,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc);o=bpy.context.object;o.scale=s
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,n,m)
def cyl(n,loc,r,d,m,axis='Z',v=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=d,location=loc);o=bpy.context.object
 if axis=='X':o.rotation_euler[1]=math.pi/2
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 mod=o.modifiers.new('Rolled edge','BEVEL');mod.width=min(.025,d*.18);mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,n,m)
def torus(n,loc,r,t,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=32,minor_segments=8,location=loc,rotation=rot);o=bpy.context.object
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,n,m)
def poly(n,pts,d,m,plane='XZ',off=(0,0,0)):
 vs=[]
 for k in [-d/2,d/2]:
  for x,z in pts:
   v=(x,k,z) if plane=='XZ' else (x,z,k);vs.append(tuple(v[i]+off[i] for i in range(3)))
 l=len(pts);fs=[tuple(reversed(range(l))),tuple(range(l,l*2))]+[(i,(i+1)%l,(i+1)%l+l,i+l) for i in range(l)]
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Machined bevel','BEVEL');mod.width=.025;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name);return finish(o,n,m)
def merge(objects,label):
 merged=[]
 for material in M.values():
  group=[o for o in objects if o.data.materials and o.data.materials[0]==material]
  if not group:continue
  objects=[o for o in objects if o not in group]
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name=label+'_'+material.name;merged.append(o)
 return merged
def export(n,pivot=None):
 global parts,chassis,rig
 merged=merge(parts,n)
 # A robot body merges apart from its fixed chassis so the game can rock it on the suspension.
 if pivot:merged=[robot_rig.pivot(merged,pivot)]+merged
 merged+=merge(chassis,n+'_chassis')+rig
 bpy.ops.object.select_all(action='DESELECT')
 for o in merged:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,n+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 for o in merged:
  if not o.parent:o.location.x+=(len(assets)%4)*5;o.location.y+=(len(assets)//4)*5
 assets.append(n);parts=[];chassis=[];rig=[]
# Robot
sphere('Shell',(0,0,.79),(.61,.46,.62),'yellow');sphere('Rim',(0,-.39,.85),(.46,.115,.43),'navy');sphere('Face',(0,-.438,.855),(.429,.103,.398),'cream')
for x in [-.16,.16]:
 sphere('Socket',(x,-.526,.89),(.078,.025,.145),'navy');sphere('Lens',(x,-.545,.9),(.059,.014,.119),'blue');sphere('Glint',(x-.014,-.558,.96),(.023,.007,.036),'glint')
for s in [-1,1]:
 chassis.append(take(cube('Track',(s*.59,.01,.25),(.27,.9,.39),'rubber',.13)))
 cyl('Hinge',(s*.49,.12,1.18),.11,.095,'darksteel','X');cyl('Screw',(s*.55,.12,1.18),.055,.03,'silver','X',6)
 for z in [.68,1.12]:cyl('Shell screw',(s*.44,-.34,z),.032,.03,'darksteel','Y',6)
# Wheels and tread links stay separate so the game can drive them (robot_rig.py); lugs show the spin.
wheel=[cyl('Hub',(0,0,0),.14,.04,'yellow','X'),cyl('Axle',(.025,0,0),.07,.05,'darksteel','X',6)]
for i in range(4):a=math.pi/4+i*math.pi/2;wheel.append(cyl('Lug',(.025,.1*math.cos(a),.1*math.sin(a)),.018,.02,'darksteel','X',6))
rig+=robot_rig.wheels(robot_rig.solid([take(o) for o in wheel]),.74,[-.255,.255],.25)
rig+=robot_rig.treads(take(cube('Tread link',(0,0,0),(.29,.046,.05),'tread',.014)),.59,robot_rig.belt(.01,.25,.45,.195,.13,.09))
cube('Service cover',(0,.435,.77),(.53,.055,.56),'yellow',.1)
for z in [.7,.79,.88]:cube('Vent',(0,.471,z),(.30,.018,.027),'navy',.01)
cube('Mount',(0,.08,1.3),(.43,.26,.23),'darksteel',.07)
pts=[(-.46,1.98),(-.46,1.67)]
for i in range(13):
 a=math.pi+math.pi*i/12;pts.append((.46*math.cos(a),1.67+.46*math.sin(a)))
pts.extend([(.46,1.98),(.24,1.98),(.24,1.67)])
for i in range(13):
 a=math.tau-math.pi*i/12;pts.append((.24*math.cos(a),1.67+.24*math.sin(a)))
pts.append((-.24,1.98));poly('Magnet',pts,.22,'red',off=(0,.08,0))
for x in [-.35,.35]:cube('Pole',(x,.08,2.045),(.22,.23,.16),'silver',.025)
export('robot',pivot=(0,0,.45))
# Enemy can
# A scrappy sentry: a heavy lid, raised optics and open pincers read from above.
M['optic']=mat('Enemy amber optics',(1,.23,.025),.1,.3)
optic=M['optic'].node_tree.nodes.get('Principled BSDF')
optic.inputs['Emission Color'].default_value=(1,.12,.008,1)
optic.inputs['Emission Strength'].default_value=1.5
cyl('Body',(0,0,.59),.31,.62,'silver')
for z in [.31,.38,.81]:torus('Rolled rim',(0,0,z),.313,.021,'darksteel')
cyl('Lid armor',(0,0,.9),.345,.08,'darksteel')
cyl('Recessed lid',(0,0,.946),.285,.025,'rust')
torus('Pull tab',(0,.045,.974),.086,.023,'silver')
cube('Face',(0,-.282,.72),(.48,.14,.27),'navy',.045)
for x in [-.135,.135]:
 cyl('Eye housing',(x,-.355,.77),.104,.085,'darksteel','Y',16)
 sphere('Optic',(x,-.408,.785),(.073,.03,.066),'optic')
 brow=cube('Angry brow',(x,-.391,.875),(.205,.085,.042),'silver',.012)
 brow.rotation_euler[1]=.18 if x<0 else -.18
for x in [-.1,0,.1]:cube('Mouth grille',(x,-.359,.615),(.043,.025,.065),'silver',.006)
# Rear vent and shoulder rivets keep the silhouette legible when chasing away.
cube('Rear service plate',(0,.296,.61),(.29,.055,.28),'darksteel',.025)
for z in [.54,.61,.68]:cube('Rear vent',(0,.329,z),(.21,.015,.024),'rust',.004)
for x in [-.25,.25]:
 cyl('Leg',(x,0,.18),.047,.28,'darksteel')
 cube('Boot',(x,-.08,.065),(.21,.29,.13),'rubber',.035)
 cyl('Shoulder',(x*1.38,0,.63),.085,.12,'darksteel','X',12)
 cube('Forearm',(x*1.66,-.04,.49),(.085,.13,.25),'silver',.02)
 cube('Claw palm',(x*1.66,-.08,.36),(.19,.12,.075),'darksteel',.015)
 for dx in [-.067,.067]:
  cube('Pincer',(x*1.66+dx,-.15,.30),(.048,.16,.14),'silver',.012)
export('enemy-can')
# Special enemies get fitted equipment rather than placeholder rectangular blocks.
def horn(n,x):
 centers=[(x,-.23,.70,.095),(x*1.12,-.39,.73,.085),(x*1.16,-.54,.82,.060),(x*1.12,-.65,.96,.008)]
 verts=[]
 for cx,cy,cz,r in centers:
  for i in range(12):
   a=i*math.tau/12;verts.append((cx+math.cos(a)*r,cy,cz+math.sin(a)*r))
 faces=[tuple(reversed(range(12))),tuple(range(36,48))]
 for j in range(3):
  for i in range(12):
   k=j*12+i;q=j*12+(i+1)%12;faces.append((k,q,q+12,k+12))
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o);finish(o,n,'cream')
 for p in mesh.polygons:p.use_smooth=True
for x in [-.25,.25]:
 sphere('Horn socket',(x,-.20,.7),(.12,.10,.12),'darksteel')
 horn('Curved charging tusk',x)
cube('Brow ram',(0,-.17,.92),(.43,.19,.09),'rust',.04)
export('enemy-charger-kit')
# Hollow, ringed muzzle with a dark bore and two glowing side reservoirs.
cyl('Nozzle socket',(0,-.28,.59),.16,.14,'darksteel','Y',16)
cyl('Nozzle barrel',(0,-.41,.59),.125,.22,'teal','Y',16)
torus('Muzzle rim',(0,-.54,.59),.11,.03,'silver',rot=(math.pi/2,0,0))
cyl('Dark bore',(0,-.547,.59),.087,.009,'navy','Y',16)
cyl('Inner aperture',(0,-.554,.59),.04,.01,'optic','Y',12)
for x in [-.28,.28]:
 sphere('Pressure pod',(x,.05,.84),(.10,.14,.20),'teal')
 torus('Pod strap',(x,.05,.84),.105,.02,'darksteel')
export('enemy-spitter-kit')
# Chamfered shield plates sit close to the body, with visible hubs and rivets.
for side in [-1,1]:
 x=side*.365
 cube('Shield backing',(x,0,.62),(.09,.49,.63),'darksteel',.04)
 plate=poly('Clipped shield',[(-.20,.33),(-.27,.47),(-.27,.81),(-.17,.96),(.16,.96),(.26,.81),(.26,.43),(.12,.33)],.075,'silver')
 plate.rotation_euler[2]=math.pi/2;plate.location.x=x+side*.045
 cyl('Shield hub',(x+side*.1,0,.65),.105,.04,'darksteel','X',12)
 for y in [-.15,.15]:
  for z in [.48,.81]:cyl('Shield rivet',(x+side*.10,y,z),.025,.025,'cream','X',8)
export('enemy-warden-kit')
# Container
cube('Shell',(0,0,1.1),(2.5,5,2.2),'teal',.06)
for y in [-2.42,2.42]:
 for x in [-1.22,1.22]:
  cube('Corner post',(x,y,1.1),(.12,.14,2.3),'teallight',.015)
  for z in [.1,2.13]:cube('Casting',(x,y,z),(.21,.22,.16),'darksteel',.025)
for x in [-1.27,1.27]:
 for i in range(22):cube('Corrugated rib',(x,-2.34+i*.22,1.08),(.065,.07,1.9),'teallight',.02)
 for z in [.15,2.07]:cube('Rail',(x,0,z),(.09,4.95,.10),'teallight',.015)
for i in range(12):cube('Roof rib',(-1.13+i*.205,0,2.23),(.065,4.84,.05),'teallight',.015)
for x in [-.61,.61]:
 cube('Door',(x,-2.54,1.12),(1.13,.08,1.94),'teal',.02)
 for dx in [-.35,.35]:cyl('Lock rod',(x+dx,-2.60,1.1),.025,1.82,'silver')
 cube('Handle',(x,-2.63,1.08),(.3,.06,.055),'darksteel',.015)
for i in range(60):cube('Chip',(1.307,random.uniform(-2.32,2.32),random.choice([.2,1.98])+random.uniform(-.1,.1)),(.008,random.uniform(.025,.11),random.uniform(.015,.06)),'rust',.004)
export('container')
# Tire
for z in [.13,.23,.33]:torus('Carcass',(0,0,z),.40,.135,'rubber')
for i in range(24):
 a=i*math.tau/24;o=cube('Tread',(.519*math.cos(a),.519*math.sin(a),.23),(.065,.105,.25),'tread',.02);o.rotation_euler[2]=a
for z in [.055,.405]:torus('Bead',(0,0,z),.30,.027,'tread')
export('tire')
# Cone
cube('Base',(0,0,.04),(.66,.66,.08),'rubber',.06)
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.25,radius2=.07,depth=.70,location=(0,0,.42));finish(bpy.context.object,'Cone','orange')
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.175,radius2=.142,depth=.125,location=(0,0,.49));finish(bpy.context.object,'Band','white');export('cone')
# Scrap shapes
pts=[]
for i in range(36):
 a=i*math.tau/36;r=[.40,.49,.40][i%3];pts.append((math.cos(a)*r,math.sin(a)*r))
poly('Saw',pts,.06,'silver',plane='XY');cyl('Center',(0,0,.045),.095,.07,'darksteel',v=12);cyl('Axle',(0,0,.085),.043,.025,'silver',v=6);export('scrap-saw')
cyl('Shaft',(0,0,0),.072,.6,'silver',v=16)
for z in [-.25,-.19,-.13,-.07,-.01,.05]:torus('Thread',(0,0,z),.071,.012,'darksteel')
cyl('Head',(0,0,.3),.15,.13,'silver',v=6);export('scrap-bolt')
vs=[]
for z in [-.085,.085]:
 for r in [.23,.11]:
  for i in range(6):vs.append((r*math.cos(i*math.tau/6),r*math.sin(i*math.tau/6),z))
fs=[]
for i in range(6):
 j=(i+1)%6;fs.extend([(i,j,j+12,i+12),(i+6,i+18,j+18,j+6),(i,i+6,j+6,j),(i+12,j+12,j+18,i+18)])
me=bpy.data.meshes.new('Nut');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Nut',me);bpy.context.collection.objects.link(o);finish(o,'Nut','silver');export('scrap-nut')
# Editable asset library
world=bpy.context.scene.world or bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.73,.8,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.45
bpy.ops.object.light_add(type='AREA',location=(1,-4,9));bpy.context.object.data.energy=1500;bpy.context.object.data.size=7
bpy.ops.object.camera_add(location=(9,-15,14));cam=bpy.context.object;cam.rotation_euler=((Vector((5,3,.4))-cam.location).to_track_quat('-Z','Y').to_euler());cam.data.type='ORTHO';cam.data.ortho_scale=23;bpy.context.scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','junk-magnet-assets.blend'));print('EXPORTED:',assets)
