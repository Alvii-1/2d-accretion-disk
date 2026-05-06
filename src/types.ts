// Interface for celestial body (planet) characteristics
export interface CelestialBody {
    x: number; y: number;                       // position
    vx: number; vy: number;                     // velocity in x and y dir
    mass: number;                               // body mass
    radius: number;                             // body radius
    alive: number;                              // 1 or 0 for alive or dead
    color: [number, number, number, number];    // body colors
}

// Interface for simulation state, the current bodies in the
// sim and the time step
export interface SimulationState {
    bodies: Array<CelestialBody>;               // array of current sim's bodies
    dt: number;                                 // time step
}