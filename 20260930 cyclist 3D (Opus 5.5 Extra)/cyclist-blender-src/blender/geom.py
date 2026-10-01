"""Bike geometry (a 56 cm endurance-race road bike) and the rider's fit on it.

All numbers in metres. X forward, Y left, Z up, ground at z = 0, bottom bracket at x = 0.
The drive side (chain) is the rider's right, i.e. -Y.
"""
import math
from mathutils import Vector, Matrix, Quaternion

d2r = math.radians

# ----------------------------------------------------------------- wheels / frame
WHEEL_R = 0.3355          # 700x26c tyre outer radius
RIM_BSD_R = 0.311         # bead seat radius (622 mm ISO)
RIM_DEPTH = 0.045
TYRE_W = 0.026
BB_DROP = 0.070
CHAINSTAY = 0.408

BB = Vector((0.0, 0.0, WHEEL_R - BB_DROP))
RA = Vector((-math.sqrt(CHAINSTAY ** 2 - BB_DROP ** 2), 0.0, WHEEL_R))       # rear axle

STA = d2r(73.5)
HTA = d2r(73.0)
STACK = 0.565
REACH = 0.386
HT_LEN = 0.150
RAKE = 0.045
CRANK = 0.1725

HT_TOP = BB + Vector((REACH, 0, STACK))
STEER_DOWN = Vector((math.cos(HTA), 0, -math.sin(HTA)))     # along steerer, downwards
STEER_FWD = Vector((math.sin(HTA), 0, math.cos(HTA)))       # perpendicular, forward/up
HT_BOT = HT_TOP + STEER_DOWN * HT_LEN

_t = (HT_TOP.z - (WHEEL_R - RAKE * STEER_FWD.z)) / math.sin(HTA)
FA = HT_TOP + STEER_DOWN * _t + STEER_FWD * RAKE                          # front axle
CROWN = HT_BOT + STEER_DOWN * 0.012

SEAT_DIR = Vector((-math.cos(STA), 0, math.sin(STA)))
ST_TOP = BB + SEAT_DIR * 0.505            # end of frame seat tube (seat clamp)
SADDLE_H = 0.722                          # BB centre -> saddle top along seat tube
SADDLE_TOP = BB + SEAT_DIR * SADDLE_H
SADDLE_SETBACK_X = -0.012                 # saddle slid slightly back on its rails

TT_FRONT = HT_TOP + STEER_DOWN * 0.022
TT_REAR = BB + SEAT_DIR * 0.465
SS_TOP = BB + SEAT_DIR * 0.400            # dropped seat stays meet the seat tube here
DT_FRONT = HT_BOT + STEER_DOWN * -0.028

# cockpit
SPACERS = 0.020
STEM_CLAMP_C = HT_TOP - STEER_DOWN * (0.012 + SPACERS + 0.020)
STEM_LEN = 0.110
STEM_ANGLE = d2r(-10)
_stem_dir_ang = (math.pi / 2 - HTA) + STEM_ANGLE
STEM_DIR = Vector((math.cos(_stem_dir_ang), 0, math.sin(_stem_dir_ang)))
BAR_C = STEM_CLAMP_C + STEM_DIR * STEM_LEN
BAR_R = 0.0118            # 23.6 mm bar ends, 31.8 clamp
BAR_HALF_TOP = 0.130      # straight tops (half width)
BAR_BEND_R = 0.072        # forward bend radius -> 404 mm c-c at the hoods
BAR_RAMP = 0.018
BAR_DROP_R = 0.064
BAR_DROP_END = 0.075
BAR_FLARE = 0.012

# drivetrain
CHAINRING_T = (52, 36)
COG_T = (11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 28)
COG_IN_USE = 17
PITCH = 0.0127
CHAINLINE_Y = -0.0435     # big ring centre plane
CASSETTE_Y0 = -0.0195     # largest cog (28T) plane
COG_SPACING = 0.00395


def sprocket_r(n):
    return PITCH / (2 * math.sin(math.pi / n))


def cog_y(n):
    i = sorted(COG_T, reverse=True).index(n)
    return CASSETTE_Y0 - i * COG_SPACING


# rear derailleur pulleys relative to the rear axle (x, z)
JOCKEY_T = 11
JOCKEY_R = sprocket_r(JOCKEY_T)
RD_UPPER = RA + Vector((0.014, 0, -0.060))
RD_LOWER = RA + Vector((0.036, 0, -0.128))


# ----------------------------------------------------------------- rider (1.78 m, 68 kg)
H = 1.78
L_THIGH = 0.432
L_SHIN = 0.432
L_UPPERARM = 0.300
L_FOREARM = 0.262
HIP_HALF = 0.086          # hip-joint half spacing
SHOULDER_HALF = 0.180
FOOT_Y = 0.104            # foot centre-line from bike centre-line
ANKLE_TO_SPINDLE = Vector((0.118, 0, -0.098))   # in the foot frame (sole horizontal)
BACK_ANGLE = d2r(39)      # hip -> shoulder line above horizontal (hands on hoods)
TORSO = 0.505             # hip-joint centre -> shoulder-joint centre

HIP_C = Vector((SADDLE_TOP.x + SADDLE_SETBACK_X + 0.012, 0, SADDLE_TOP.z + 0.084))
SHOULDER_C = HIP_C + Vector((math.cos(BACK_ANGLE), 0, math.sin(BACK_ANGLE))) * TORSO


def pedal_pos(phi, side):
    """phi: crank angle, clockwise from 12 o'clock seen from the drive side, right crank.
    side: +1 = left (+Y), -1 = right (-Y)."""
    a = phi if side < 0 else phi + math.pi
    return BB + Vector((CRANK * math.sin(a), side * FOOT_Y, CRANK * math.cos(a)))


def foot_angle(phi, side):
    """Ankling: sole angle, toe-down positive (radians)."""
    a = phi if side < 0 else phi + math.pi
    return d2r(17.0) - d2r(14.0) * math.cos(a - d2r(95))


def rot_y(a):
    return Matrix.Rotation(a, 3, 'Y')


def ankle_pos(phi, side):
    sp = pedal_pos(phi, side)
    return sp - rot_y(foot_angle(phi, side)) @ ANKLE_TO_SPINDLE


def two_bone_ik(root, target, l1, l2, pole_dir):
    """Returns the middle joint position (knee / elbow)."""
    d = target - root
    dist = min(d.length, (l1 + l2) * 0.9999)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    p = pole_dir - dn * pole_dir.dot(dn)
    p.normalize()
    return root + dn * a + p * h


def hip_pos(side, hip_c=None):
    return (hip_c or HIP_C) + Vector((0, side * HIP_HALF, 0))


def leg_chain(phi, side, hip_c=None):
    hip = hip_pos(side, hip_c)
    ank = ankle_pos(phi, side)
    knee = two_bone_ik(hip, ank, L_THIGH, L_SHIN, Vector((1.0, side * 0.08, 0.15)))
    return hip, knee, ank


def knee_angle(hip, knee, ank):
    a = (hip - knee).normalized()
    b = (ank - knee).normalized()
    return math.degrees(math.acos(max(-1, min(1, a.dot(b)))))


REST_PHI = d2r(90)   # right crank forward (3 o'clock) in the modelling pose


if __name__ == "__main__":
    print("BB", BB, "RA", RA, "FA", FA, "wheelbase", FA.x - RA.x)
    print("HT_TOP", HT_TOP, "HT_BOT", HT_BOT, "ST_TOP", ST_TOP, "SADDLE", SADDLE_TOP)
    print("STEM", STEM_CLAMP_C, "BAR_C", BAR_C)
    print("HIP_C", HIP_C, "SHOULDER_C", SHOULDER_C)
    for deg in range(0, 360, 30):
        h, k, a = leg_chain(d2r(deg), -1)
        print(deg, "knee interior %.1f" % knee_angle(h, k, a), "hip-ankle %.3f" % (a - h).length)
