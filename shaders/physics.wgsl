// struct for celestial celestial bodies matching in types.ts
struct Body 
{
    position: vec2f,
    velocity: vec2f,
    mass: f32,
    radius: f32,
    alive: u32,
    padding: u32,
    color: vec4f,
}

// struct for simulation parameters
struct SimParams
{
    G: f32,             // grav constant
    dt: f32,            // time step
    bodyCount: u32,     // num bodies in sim
    centralMass: f32,   // central mass (anchor point)
}

@group(0) @binding(0) var<storage, read> bodiesIn: array<Body>;         // bodies initially in the sim
@group(0) @binding(1) var<storage, read_write> bodiesOut: array<Body>;  // bodies exiting the sim (some will die)
@group(0) @binding(2) var<uniform> params: SimParams;                   // simulation information

// compute shader to handle physics calculations between bodies. each thread handles a body
@compute @workgroup_size(64)
fn computeMain( @builtin(global_invocation_id) id: vec3u ) 
{
    if (id.x >= params.bodyCount) { return; } // leave if thread is out of bounds

    let currBody = bodiesIn[id.x];

    if (id.x == 0u) { bodiesOut[id.x] = currBody; return; }            // we dont change central mass 
    if (currBody.alive == 0u) { bodiesOut[id.x] = currBody; return; }  // if body is dead skip changing it

    // set up init accelerations (0)
    var ax: f32 = 0.0;
    var ay: f32 = 0.0;

    for (var j: u32 = 0u; j < params.bodyCount; j++) {
        if (j == id.x) { continue; }               // skip self
        if (bodiesIn[j].alive == 0u) { continue; } // skip dead bodies too
        
        // get other body then get difference in position in x and y
        let other = bodiesIn[j];
        let dx = other.position.x - bodiesIn[id.x].position.x;
        let dy = other.position.y - bodiesIn[id.x].position.y;

        // get the difference in pos diagonal
        let r = sqrt(dx*dx + dy*dy + 100.0);  // epsilon squared = 100

        // compute acceleration change and apply it
        let acc = params.G * other.mass / (r * r * r);
        ax += acc * dx;
        ay += acc * dy;
    }   

    // updated position and velocity resulting from calc
    var updated = currBody;
    updated.position = currBody.position + currBody.velocity * params.dt;
    updated.velocity = currBody.velocity + vec2f(ax, ay) * params.dt;
    bodiesOut[id.x] = updated;
}
