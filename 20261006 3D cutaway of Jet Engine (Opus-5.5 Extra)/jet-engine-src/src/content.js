// Words, tour steps and label anchors. Numbers match the engine model (see path.js / flow.js).
export const PROMPT = 'Show me how a jet engine works in an inline 3D cutaway, hosted in standalone html.';

// Station bands used by the gas-path chart (x in metres from the intake lip)
export const BANDS = [
  { id: 'fan', name: 'Fan', x0: 0.70, x1: 1.28, mods: ['fan'] },
  { id: 'lpc', name: 'Booster', x0: 1.28, x1: 2.14, mods: ['lpc'] },
  { id: 'hpc', name: 'HP comp.', x0: 2.14, x1: 3.10, mods: ['hpc'] },
  { id: 'comb', name: 'Burner', x0: 3.10, x1: 3.86, mods: ['comb'] },
  { id: 'hpt', name: 'HPT', x0: 3.86, x1: 4.30, mods: ['hpt'] },
  { id: 'lpt', name: 'LPT', x0: 4.30, x1: 5.30, mods: ['lpt'] },
  { id: 'noz', name: 'Nozzle', x0: 5.30, x1: 6.00, mods: ['exhaust', 'cowl'] },
];

// view: centre x, half-width and half-height (m) the shot must show, plus yaw / pitch.
export const STEPS = [
  {
    id: 'overview', flow: null, n: 0, short: 'Overview', title: 'Air in, thrust out', tag: 'THE WHOLE ENGINE', hue: '#9fb3c8',
    text: 'A turbofan is a gas turbine with a giant ducted fan bolted to the front. Air enters on the left, is squeezed, burned with fuel and thrown out of the back. Engineers remember it as <b>suck, squeeze, bang, blow</b>. Press play, or pick a stage.',
    facts: [['Fan diameter', '2.4 m'], ['Air swallowed', '≈ 800 kg/s'], ['Thrust at take-off', '≈ 300 kN']],
    focus: [], station: null,
    view: { cx: 3.15, w: 3.55, h: 1.75, yaw: -0.38, pitch: 0.2 },
  },
  {
    id: 'fan', flow: { x0: -0.55, x1: 1.7, core: 1, byp: 1 }, n: 1, short: 'Intake & fan', title: 'Intake and fan', tag: 'SUCK', hue: '#7cc4ff',
    text: 'The nacelle guides air smoothly onto the <b>fan</b>: 22 wide, swept titanium blades whose tips move faster than sound. The fan does two jobs: it feeds the core, and it throws most of the air straight backwards, which is where most of the thrust comes from.',
    facts: [['Blades', '22'], ['Tip speed', '≈ 490 m/s'], ['Pressure rise', '1.5 : 1']],
    focus: ['inlet', 'fan'], station: 1.0,
    view: { cx: 1.0, w: 1.55, h: 1.5, yaw: -0.62, pitch: 0.16 },
  },
  {
    id: 'bypass', flow: { x0: 0.8, x1: 6.0, core: 0, byp: 1 }, n: 2, short: 'Bypass', title: 'The bypass stream', tag: 'COLD THRUST', hue: '#5cc8ff',
    text: 'Behind the fan the flow splits. About four parts in five never enter the engine core: they ride around it through the <b>bypass duct</b>, straightened by outlet guide vanes, and leave cold at roughly 300 m/s. Moving a lot of air a little faster is quiet and fuel-efficient.',
    facts: [['Bypass ratio', '≈ 4.4 : 1'], ['Share of thrust', '≈ 75–80 %'], ['Exit speed', '≈ 300 m/s']],
    focus: ['fan', 'nacAft', 'cowl'], station: 1.8,
    view: { cx: 2.55, w: 2.2, h: 1.55, yaw: -0.3, pitch: 0.3 },
  },
  {
    id: 'compress', flow: { x0: 1.2, x1: 3.3, core: 1, byp: 0 }, n: 3, short: 'Compressor', title: 'Booster and HP compressor', tag: 'SQUEEZE', hue: '#9be0ff',
    text: 'The core air is squeezed by alternating rows: a spinning <b>rotor</b> row adds energy, a fixed <b>stator</b> row straightens the flow and turns speed into pressure. Twelve rows later the air is at about 36 times atmospheric pressure and around 600 °C, and the blades have shrunk to thumb-size.',
    facts: [['Overall pressure ratio', '≈ 36 : 1'], ['Exit temperature', '≈ 600 °C'], ['HP rotor speed', '≈ 12 400 rpm']],
    focus: ['lpc', 'hpc'], station: 2.7,
    view: { cx: 2.28, w: 1.4, h: 0.8, yaw: -0.3, pitch: 0.34 },
  },
  {
    id: 'burn', flow: { x0: 2.7, x1: 4.5, core: 1, byp: 0 }, n: 4, short: 'Combustor', title: 'The combustor', tag: 'BURN', hue: '#ffb35c',
    text: 'Twenty nozzles spray kerosene into the hot, dense air and it burns <b>continuously</b>, not in explosions. The gas reaches about 1 500 °C, hotter than the metal can stand. So the flame sits inside a perforated liner and cool air leaks through its holes to wrap it in a protective film.',
    facts: [['Gas temperature', '≈ 1 500 °C'], ['Fuel nozzles', '20'], ['Fuel flow', '≈ 2.5 kg/s']],
    focus: ['comb'], station: 3.5,
    view: { cx: 3.5, w: 0.95, h: 0.78, yaw: -0.28, pitch: 0.26 },
  },
  {
    id: 'turbine', flow: { x0: 3.7, x1: 5.8, core: 1, byp: 0 }, n: 5, short: 'Turbines', title: 'Turbines and the two shafts', tag: 'EXTRACT', hue: '#ff8a5c',
    text: 'The hot gas spins two turbines. The <b>HP turbine</b> (gold) drives the HP compressor through a hollow shaft. The <b>LP turbine</b> (blue) drives the fan and booster through a thinner shaft running inside it. Two shafts at two different speeds let every stage run near its best.',
    facts: [['HP spool (N2)', '≈ 12 400 rpm'], ['LP spool (N1)', '≈ 3 900 rpm'], ['Power to the fan', '≈ 40 MW']],
    focus: ['hpt', 'lpt'], station: 4.4,
    view: { cx: 4.55, w: 1.3, h: 0.95, yaw: -0.32, pitch: 0.3 },
  },
  {
    id: 'nozzle', flow: { x0: 4.9, x1: 8.6, core: 1, byp: 1 }, n: 6, short: 'Nozzle', title: 'The nozzle', tag: 'BLOW', hue: '#ffc27a',
    text: 'What energy is left expands through the nozzle and leaves at about 450 m/s. Thrust is simply <b>mass flow × change in velocity</b>: the engine pushes air backwards and the air pushes the engine, and the aircraft, forwards. The core jet is small and fast, the bypass jet large and slow.',
    facts: [['Core jet speed', '≈ 450 m/s'], ['Gas temperature', '≈ 530 °C'], ['Thrust', '≈ 300 kN']],
    focus: ['exhaust', 'cowl', 'lpt'], station: 5.8,
    view: { cx: 5.35, w: 1.5, h: 1.15, yaw: -0.34, pitch: 0.24 },
  },
];

// Callouts: anchor (x, r) sits on the middle plane of the cutaway opening.
export const LABELS = [
  { id: 'inlet', text: 'Air intake', mod: 'inlet', x: 0.2, r: 1.2, row: 'top', step: 1 },
  { id: 'fan', text: 'Fan · 22 blades', mod: 'fan', x: 0.98, r: 0.95, row: 'top', step: 1 },
  { id: 'spinner', text: 'Spinner', mod: 'fan', x: 0.42, r: 0.26, row: 'bot', step: 1 },
  { id: 'bypass', text: 'Bypass duct', mod: 'nacAft', x: 2.35, r: 0.98, row: 'top', step: 2 },
  { id: 'booster', text: 'Booster', mod: 'lpc', x: 1.62, r: 0.5, row: 'bot', step: 3 },
  { id: 'hpc', text: 'HP compressor', mod: 'hpc', x: 2.65, r: 0.40, row: 'bot', step: 3 },
  { id: 'comb', text: 'Combustor', mod: 'comb', x: 3.55, r: 0.56, row: 'top', step: 4 },
  { id: 'hpt', text: 'HP turbine', mod: 'hpt', x: 4.05, r: 0.40, row: 'bot', step: 5 },
  { id: 'lpt', text: 'LP turbine', mod: 'lpt', x: 4.88, r: 0.60, row: 'top', step: 5 },
  { id: 'bnoz', text: 'Bypass nozzle', mod: 'nacAft', x: 5.25, r: 1.02, row: 'top', step: 6 },
  { id: 'plug', text: 'Core nozzle & plug', mod: 'exhaust', x: 5.95, r: 0.20, row: 'bot', step: 6 },
  { id: 'n1', text: 'LP shaft', mod: 'lpc', x: 2.02, r: 0.075, row: 'bot', step: 5 },
  { id: 'n2', text: 'HP shaft', mod: 'comb', x: 3.45, r: 0.157, row: 'bot', step: 5 },
];

export const ABOUT = {
  notes: [
    ['Engine model', 'A generic high-bypass, twin-spool turbofan of the Trent 700 / CF6 class: 2.4 m fan, 22 fan blades, 3-stage booster, 9-stage HP compressor, annular combustor with 20 fuel nozzles, 2-stage HP turbine, 5-stage LP turbine. It is illustrative, not a copy of any real engine, and blade counts and shapes are plausible rather than certified.'],
    ['Geometry', 'Everything is generated in code, no imported models. Casings, discs, shafts and nacelle are surfaces of revolution lofted from one table of flow-path radii (path.js). Blades are cambered aerofoils lofted along the span with twist and sweep, drawn as instanced rows (about 3 000 blades).'],
    ['The cutaway', 'One wedge is removed by discarding fragments by their angle about the engine axis, in every material and in the shadow pass, so light pours in through the opening. Flat orange, hatched faces are generated for every cut solid at the wedge edges. Rotating blades are left uncut so you can watch them turn.'],
    ['Airflow', '6 500 streak particles follow streamlines through the real flow-path radii: one stream splits at the splitter into core and bypass. Colour is gas temperature at that station (blue → white → yellow → orange), speed follows a station velocity table, and crowding shows compression.'],
    ['Flame', 'A ray-marched volume in the annulus between the liner walls (noise advected along the axis with swirl and 20 jets), cut by the same wedge so you can look through the opening at the far side of the ring. It also drives a point light and the glow on turbine parts.'],
    ['Engine behaviour', 'The thrust lever sets target N1 / N2; spool speeds lag it (the HP spool answers faster), and temperatures, flame, glow, particle speed and thrust all follow the lagged speeds. Rotor motion is shown in slow motion so individual blades remain visible; real N1 is about 65 revolutions per second.'],
    ['Graphics status', 'The pill at the bottom right reports where the 3D is being drawn, read from the renderer name the browser exposes: GPU active (a hardware adapter was reported), CPU only (a software renderer such as SwiftShader or llvmpipe), or renderer unknown (the browser did not say). Software rendering works but will be slow; the page lowers its resolution automatically to keep moving.'],
    ['Rendering', 'three.js r186, PBR metals lit by a procedural studio environment and one shadow-casting key light, MSAA, bloom and filmic tone-mapping. The page adapts its resolution to keep the frame rate up.'],
  ],
  controls: [
    ['Drag', 'orbit'], ['Shift / right-drag', 'pan'], ['Wheel / pinch', 'zoom'], ['Space', 'play / pause the tour'],
    ['← →', 'previous / next stage'], ['C', 'cutaway on/off'], ['E', 'explode'], ['↑ ↓', 'thrust lever'],
  ],
  source: 'No source URL was supplied with this prompt. This page was written from the prompt alone, with no reference images.',
};
