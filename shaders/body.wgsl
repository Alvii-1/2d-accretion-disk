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

// stored number of bodies + their characteristics
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

    let body = bodies[iIdx];   // current body
    let localPos = square[vIdx]; // current quad vertex pos

    // then scale the square by radius to get the circle
    let worldPos = body.position + localPos * body.radius;

    // convert the pixels to clip space, place the square on screen
    // also incorporate the zoom
    let center = vec2f(600.0, 400.0);
    let zoomed = (worldPos - center) / zoom + center;
    let clipX = (zoomed.x / 1200.0) * 2.0 - 1.0;
    let clipY = 1.0 - (zoomed.y / 800.0) * 2.0;

    // setup vertex output 
    var output: VertexOutput;

    // if the body is dead move the vertex off screen so it doesnt render
    if (body.alive ==0u) {
        output.position = vec4f(-10.0, -10.0, 0.0, 1.0);
        return output;
    }

    // keep writing the rest of the output for alive bodies
    output.position = vec4f(clipX, clipY, 0.0, 1.0);
    output.localPos = localPos;
    output.color = body.color;
    return output;
}

@fragment // fragment shader
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f
{
    if (length(input.localPos) > 1.0) { discard; }
    return input.color;
}