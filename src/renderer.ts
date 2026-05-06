import shaderCode from "../shaders/body.wgsl";
import computeCode from "../shaders/physics.wgsl"
import { CelestialBody } from "./types";

// Doing typical WebGPU Setup here, just getting it out of main
export async function initializeWebGPU(
    canvas: HTMLCanvasElement
): Promise< {
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat
}> {

    // get adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { throw new Error('No GPU adapter found'); }
    const device = await adapter.requestDevice();

    console.log(adapter); // DEBUG
    console.log(device);  // DEBUG

    // setup context and format
    const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();

    if (!context) { throw new Error('Could not get WebGPU context'); }

    // return the device, context, and format
    context.configure({
      device: device,
      format: format
    });

    return { device, context, format }; 
}

// This function will setup the render pipeline and bind group layout,
// it will also return both created render pipeline and bg layout
export function createRenderPipeline(
    device: GPUDevice,
    format: GPUTextureFormat
):{
    pipeline: GPURenderPipeline,
    bindGroupLayout: GPUBindGroupLayout
} {

    // Setup where the shader code is 
    const shaderModule = device.createShaderModule({ code: shaderCode });

    // Specify the read-only bind group layout which is only visible
    // to the vertex shader and will contain the bodies eventually
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'read-only-storage' }
        }, {
            binding: 1,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' }
        }]
    })

    // setup render pipeline, match shader entry points and specify
    // the created bindgrouplayout 
    const renderPipeline = device.createRenderPipeline({
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain"
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{format}]
      },
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      })
    });

    return { 
        pipeline: renderPipeline,
        bindGroupLayout: bindGroupLayout 
    };
}

// similar as above, but for the compute shader in physics.wgsl
export function createComputePipeline(
    device: GPUDevice
):{
    pipeline: GPUComputePipeline,
    bindGroupLayout: GPUBindGroupLayout
} {

    // Setup where the shader code is 
    const computeModule = device.createShaderModule({ code: computeCode });

    // Specify the read-only bind group layout which is only visible
    // to the compute shader and will contain the bodies eventually
    // this time we have 3 bindings 
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' }
        }, {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
        }, {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
        }]
    })

    // setup render pipeline, match shader entry points and specify
    // the created bindgrouplayout 
    const computePipeline = device.createComputePipeline({
      compute: {
        module: computeModule,
        entryPoint: "computeMain"
      },
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      })
    });

    return { 
        pipeline: computePipeline,
        bindGroupLayout: bindGroupLayout 
    };
}

// this function will map the buffer indexes to the float32 array positions
export function bodiesToFloat32Array(
    bodies: CelestialBody[]
): Float32Array {
    const data = new Float32Array(bodies.length * 12);
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        data[i * 12 + 0] = body.x; //4
        data[i * 12 + 1] = body.y; //8
        data[i * 12 + 2] = body.vx; //12
        data[i * 12 + 3] = body.vy; //16
        data[i * 12 + 4] = body.mass; //4
        data[i * 12 + 5] = body.radius;//8
        data[i * 12 + 6] = body.alive; //12
        data[i * 12 + 7] = 0; // padding 16 (32)
        data[i * 12 + 8] = body.color[0]; // start at offset of multiple of 16 
        data[i * 12 + 9] = body.color[1];
        data[i * 12 + 10] = body.color[2];
        data[i * 12 + 11] = body.color[3];
    }
    return data;
}

// Here we create the GPU storage buffer that the shader will end up
// reading the celestial body data from
export function createGPUBuffer(
    device: GPUDevice,
    bodies: CelestialBody[]
): GPUBuffer {
    
    // fill the array of instances of bodies from the function above,
    // then make the GPU buffer. Storage, COPY DST and COPY SRC because
    // we need the buffer to be copied into on the CPU side and we need
    // the CPU side to copy the data back out later for collisions
    let data = bodiesToFloat32Array(bodies);
    let gpuBuffer = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })

    // write the buffer and return it
    device.queue.writeBuffer(gpuBuffer, 0, data.buffer);
    return gpuBuffer;
}

// now we need to create the bind group itself, which is done in this function
// This is specifically for the drawing, not the compute side
export function makeBindGroup(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    bodiesBuffer: GPUBuffer,
    zoomBuffer: GPUBuffer
): GPUBindGroup {

    // setup the bind group to use the correct layout and assign its binding
    // and entries. it will hold the data on the celestial bodies
    return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: bodiesBuffer }
        }, {
            binding: 1,
            resource: { buffer: zoomBuffer}
        }]
    });
}

// Now we also need a bind group for the compute shader,
// which needs the buffer for the bodies and the simulation params
export function makeComputeBindGroup(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    bodiesIn: GPUBuffer,
    bodiesOut: GPUBuffer,
    paramsBuffer: GPUBuffer
): GPUBindGroup {

    // same as above but for the physics side, which has 3 bindings
    return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: bodiesIn } },
            { binding: 1, resource: { buffer: bodiesOut } },
            { binding: 2, resource: { buffer: paramsBuffer } }
        ]
    });
}

// The entire render pass with the command encoder batched
// instructions setup
export function renderPass(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    bindGroup: GPUBindGroup,
    bodyCount: number
): void {

    // setup command encoder
    const commandEncoder = device.createCommandEncoder();
    
    // setup render pass
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r:1, g:1, b:1, a:1 },
            loadOp: "clear",
            storeOp: "store"
        }]
    })

    // call render pass functions and complete the command encoder command
    // sequence 
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6, bodyCount);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
}