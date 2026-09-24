"""Moving parts shared by the playable robot builders.

The game finds these objects by name (src/robot-rig.ts): `wheel_*` spin about their axle, each
side's `tread_<side>_<nn>` links step around the track in belt order, and the `body` empty rocks
on the suspension. Duplicates share one mesh, so each GLB stores a single wheel and link shape;
wheels may be scaled copies, and the game spins each by its own radius.
"""
import bpy
import math

# Robots face -Y, so +X is the robot's left.
SIDES = [(1, 'L'), (-1, 'R')]


def belt(cy, cz, hy, hz, radius, spacing):
    """(y, z, tilt) link poses evenly spaced around a rounded-rectangle track profile.

    Starts at the rear of the top run and heads forward (-Y), so each link's successor is where it
    moves next when the robot drives forward. `tilt` turns a link about X to face outward.
    """
    iy, iz = hy - radius, hz - radius
    # Corner arc centres, walking top, front, bottom, rear.
    corners = [(cy + iy, cz + iz), (cy - iy, cz + iz), (cy - iy, cz - iz), (cy + iy, cz - iz)]
    straights = [2 * iy, 2 * iz, 2 * iy, 2 * iz]
    arc = math.pi / 2 * radius
    perimeter = sum(straights) + 4 * arc
    count = round(perimeter / spacing)
    poses = []
    for i in range(count):
        s = i * perimeter / count
        for k in range(4):
            phi = math.pi / 2 * (k + 1)
            (ay, az), (by, bz) = corners[k], corners[(k + 1) % 4]
            if s <= straights[k]:
                f = s / straights[k]
                y, z = ay + (by - ay) * f, az + (bz - az) * f
                break
            s -= straights[k]
            if s <= arc:
                phi += s / radius
                y, z = by, bz
                break
            s -= arc
        poses.append((y + radius * math.cos(phi), z + radius * math.sin(phi), math.atan2(-math.cos(phi), math.sin(phi))))
    return poses


def place(template, poses):
    """Put `template` at the first (name, location, rotation) pose and linked duplicates at the rest."""
    objects = []
    for i, (name, location, rotation) in enumerate(poses):
        o = template.copy() if i else template
        if i:
            bpy.context.collection.objects.link(o)
        o.name, o.location, o.rotation_euler = name, location, rotation
        objects.append(o)
    return objects


def wheels(template, x, ys, z):
    """Road wheels on both tracks; the right-hand copies turn around to face outward."""
    return place(template, [(f'wheel_{side}_{i}', (s * x, y, z), (0, 0, 0 if s > 0 else math.pi))
                            for s, side in SIDES for i, y in enumerate(ys)])


def sized_wheels(template, x, placements):
    """Like wheels(), but each (y, z, scale) wheel can differ in size while sharing one mesh."""
    objects = place(template, [(f'wheel_{side}_{i}', (s * x, y, z), (0, 0, 0 if s > 0 else math.pi))
                               for s, side in SIDES for i, (y, z, _) in enumerate(placements)])
    for o, (_, _, scale) in zip(objects, placements * len(SIDES)):
        o.scale = (scale, scale, scale)
    return objects


def treads(template, x, poses):
    return place(template, [(f'tread_{side}_{i:02d}', (s * x, y, z), (tilt, 0, 0))
                            for s, side in SIDES for i, (y, z, tilt) in enumerate(poses)])


def solid(objects):
    """Join parts into the first one and bake its rotation, keeping the origin as the pivot."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return objects[0]


def pivot(objects, location):
    """Parent the merged body meshes to a `body` empty the game rocks about `location`."""
    bpy.ops.object.empty_add(location=location)
    body = bpy.context.object
    body.name = 'body'
    for o in objects:
        o.parent = body
        o.matrix_parent_inverse = body.matrix_world.inverted()
    return body
