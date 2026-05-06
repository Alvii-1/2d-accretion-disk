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

// returned struct object from vertexMain
struct VertexOutput 
{
    @builtin(position) position : vec4f,
    @location(0) localPos: vec2f, // for circles clipping
    @location(1) color : vec4f,
}

// stored array of bodies + their characteristics
// also the zoom value which is just a f32
@group(0) @binding(0) var<storage, read> bodies: array<Body>;
@group(0) @binding(1) var<uniform> zoom: f32;  

@vertex // vertex shader
fn vertexMain(@builtin(vertex_index) vIdx : u32, @builtin(instance_index) iIdx : u32) -> VertexOutput 
{

    // draw a square first then cut it to make the circle
    // first draw the square
    var square = array<vec2f, 6>(
        vec2f(-1, -1), 
        vec2f(1, -1), 
        vec2f(-1, 1),
        vec2f(-1, 1), 
        vec2f(1, -1), 
        vec2f(1, 1)
    );

    let body = bodies[iIdx];        // current body
    let localPos = square[vIdx];    // current quad vertex pos

    // place the square in the world centered at the position
    // center is body.position
    // local position * radius determines where corners should be drawn of each tri
    // body at (600, 400) with radius 20, the top left vertex localPos(-1, -1) ends up at pos (580, 380)
    let worldPos = body.position + localPos * body.radius;

    // convert the pixels to clip space, place the square on screen
    // also incorporate the zoom
    let center = vec2f(600.0, 400.0);
    let zoomed = (worldPos - center) / zoom + center; // zoom = 2 means everything is ~half as far from center
    let clipX = (zoomed.x / 1200.0) * 2.0 - 1.0;      // then we compress world coordinates to do a pseudo zoom 
    let clipY = 1.0 - (zoomed.y / 800.0) * 2.0;
    // when zoom is 2 everything is haf as far from center and you see twice the area

    // setup vertex output 
    var output: VertexOutput;

    // if the body is dead move the vertex off screen so it doesnt render
    if (body.alive ==0u) {
        output.position = vec4f(-10.0, -10.0, 0.0, 1.0);
        return output;
    }

    // keep writing the rest of the output for alive bodies
    output.position = vec4f(clipX, clipY, 0.0, 1.0); // pure body on-screen position
    output.localPos = localPos;                      // for cutting into circle
    output.color = body.color;
    return output;
}

@fragment // fragment shader
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f
{
    // cut out all pixels in a radius of 1
    if (length(input.localPos) > 1.0) { discard; }
    return input.color;
}