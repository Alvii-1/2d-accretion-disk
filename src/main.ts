import { createGPUBuffer, createRenderPipeline, createComputePipeline, initializeWebGPU, makeBindGroup, bodiesToFloat32Array, renderPass, makeComputeBindGroup } from "./renderer";
import { SimulationState, CelestialBody } from './types';

function generateBodies(
    count: number,
    massVariance: number,
    minDist: number,
    maxDist: number
): CelestialBody[] {

    // setup empty array
    let bodies: CelestialBody[] = [];

    // first thing is the main body (sun)
    bodies.push({
        x:600, y:400,
        vx:0, vy:0,
        mass: 1e10,
        radius: 200,
        alive: 1,
        color: [1, 0.8, 0, 1]
    })

    // need gravitational constant and fixed vals before populating
    const G = 6.674e-3          // enlarged from -11
    const cx = 600, cy = 400;   // center known
    const baseMass = 1e6;

    // then populate the rest randomly
    for (let i = 1; i < count; i++) {
        const angle = Math.random() * Math.PI*2;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const mass = baseMass + Math.random() * massVariance;
        const radius = 3 + (mass / baseMass);

        // position on circle
        const x = cx + dist * Math.cos(angle);
        const y = cy + dist * Math.sin(angle);

        // circular orbit velocity perpendicular to radius
        const v = Math.sqrt(G * 1e10 / dist);
        const vx = -v * Math.sin(angle);
        const vy = v * Math.cos(angle);

        bodies.push({
            x, y, vx, vy,
            mass, radius,
            alive: 1,
            color: [0.1 + Math.random() * 0.5, 0.1 + Math.random() * 0.5, 0.1 + Math.random() * 0.5, 1]
        })
    }

    return bodies;
}

// check collisions with the sun and other bodies. if the sun is overlapping
// pos, then eat the body. if the body hits another body, grow in size
function checkCollisions(
    bodies: CelestialBody[],
    device: GPUDevice,
    buffer: GPUBuffer
): void {
    
    // hold set of changed bodies so we dont reiterate over unchanged ones
    const changed = new Set<number>();

    for (let i = 1; i < bodies.length; i++) {
        if (bodies[i].alive === 0) continue;

        // check against central body
        const dx0 = bodies[i].x - bodies[0].x;
        const dy0 = bodies[i].y - bodies[0].y;
        const dist0 = Math.sqrt(dx0*dx0 + dy0*dy0);
        if (dist0 <= bodies[0].radius + bodies[i].radius) {
            bodies[i].alive = 0;
            changed.add(i);
            continue;
        }

        // check against all other small bodies
        for (let j = i + 1; j < bodies.length; j++) {
            if (bodies[i].mass > 1e8 || bodies[j].mass > 1e8) continue; // if we're the big masses we're immortal
            if (bodies[j].alive === 0) continue;
            const dx = bodies[j].x - bodies[i].x;
            const dy = bodies[j].y - bodies[i].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < bodies[i].radius + bodies[j].radius) {
                const totalMass = bodies[i].mass + bodies[j].mass;
                bodies[i].vx = (bodies[i].vx * bodies[i].mass + bodies[j].vx * bodies[j].mass) / totalMass;
                bodies[i].vy = (bodies[i].vy * bodies[i].mass + bodies[j].vy * bodies[j].mass) / totalMass;
                bodies[i].mass = totalMass;
                bodies[i].radius = Math.sqrt(bodies[i].radius**2 + bodies[j].radius**2 * 0.75);
                bodies[j].alive = 0;
                changed.add(i);
                changed.add(j);
            }
        }
    }

    // write changed bodies back to GPU buffer
    for (const idx of changed) {
        const offset = idx * 12 * 4;
        const data = bodiesToFloat32Array([bodies[idx]]);
        device.queue.writeBuffer(buffer, offset, data.buffer);
    }
}


async function main() 
{
    // setup the canvas based on the HTML element that has matching ID
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    if (!canvas) { throw new Error ('HTML Canvas not found'); }

    // setup the device, context, and format from render.ts initializeWebGPU() function
    const { device, context, format } = await initializeWebGPU(canvas);

    let bodies = generateBodies(500, 1e6, 80, 300);

    // setup the sim by calling the func above to get the bodies
    //const bodies = generateBodies(1000, 1e6,);
    const state: SimulationState = {
        bodies,
        dt: 0.008
    }

    // setup render pipeline for drawing bodies
    const { 
        pipeline: renderPipeline, 
        bindGroupLayout: renderBGL
    } = createRenderPipeline(device, format);

    // setup compute pipeline for physics
    const { 
        pipeline: computePipeline, 
        bindGroupLayout: computeBGL
    } = createComputePipeline(device);

    // buffers for data which require overwriting 
    // since the sim state changes (some things get unalive )
    let bufferA = createGPUBuffer(device, state.bodies);
    let bufferB = createGPUBuffer(device, state.bodies);

    // params buffer is needed in the compute shader at each thread, needs
    // to know things like grav constant and bodieslength 
    const paramsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const paramsData = new ArrayBuffer(16);
    new Float32Array(paramsData, 0, 2).set([6.674e-3, state.dt]);
    new Uint32Array(paramsData, 8, 1).set([state.bodies.length]);
    new Float32Array(paramsData, 12, 1).set([1e10]);
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

        // for zooming out 
    const zoomBuffer = device.createBuffer({
        size: 4, // single f32
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(zoomBuffer, 0, new Float32Array([1.0]));

    // setup bind groups for compute and render
    let computeBindGroup = makeComputeBindGroup(device, computeBGL, bufferA, bufferB, paramsBuffer);
    let renderBindGroup = makeBindGroup(device, renderBGL, bufferB, zoomBuffer);

    // Setup HTML elements functionality
    // get slider elements first
    const bodyCountSlider = document.getElementById('bodyCount') as HTMLInputElement;
    const massVarianceSlider = document.getElementById('massVariance') as HTMLInputElement;
    const minRadiusSlider = document.getElementById('minRadius') as HTMLInputElement;
    const maxRadiusSlider = document.getElementById('maxRadius') as HTMLInputElement;
    const zoomSlider = document.getElementById('zoom') as HTMLInputElement;

    // get display spans
    const countVal = document.getElementById('countVal')!;
    const varianceVal = document.getElementById('varianceVal')!;
    const minRadVal = document.getElementById('minRadVal')!;
    const maxRadVal = document.getElementById('maxRadVal')!;
    const zoomVal = document.getElementById('zoomVal')!;

    // update display values when sliders move
    bodyCountSlider.addEventListener('input', () => countVal.textContent = bodyCountSlider.value);
    massVarianceSlider.addEventListener('input', () => varianceVal.textContent = massVarianceSlider.value);
    minRadiusSlider.addEventListener('input', () => minRadVal.textContent = minRadiusSlider.value);
    maxRadiusSlider.addEventListener('input', () => maxRadVal.textContent = maxRadiusSlider.value);

    // inserting second mass
    let insertMode = false;
    const insertBtn = document.getElementById('insertBtn') as HTMLButtonElement;
    const secondaryMassInput = document.getElementById('secondaryMass') as HTMLInputElement;

    insertBtn.addEventListener('click', () => {
        insertMode = !insertMode;
        insertBtn.textContent = insertMode ? 'Click Canvas to Place' : 'Insert Mass Mode';
        insertBtn.style.background = insertMode ? '#ff4444' : '#ffcc00';
    });

    canvas.addEventListener('click', (e: MouseEvent) => {
        if (!insertMode) return;
        
        const cx = 600, cy = 400;
        const zoom = parseFloat(zoomSlider.value);
        const x = (e.offsetX - cx) * zoom + cx;
        const y = (e.offsetY - cy) * zoom + cy;
        const mass = parseFloat(secondaryMassInput.value);
        
        // distance from central body
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        
        // stable circular orbit velocity
        const G = 6.674e-3;
        const v = Math.sqrt(G * 1e10 / dist);
        const vx = -v * Math.sin(angle);
        const vy = v * Math.cos(angle);
        
        state.bodies.push({
            x, y, vx, vy,
            mass,
            radius: 40,
            alive: 1,
            color: [1, 0.3, 0.3, 1]  // red
        });
        
        // recreate buffers to fit new body
        bufferA = createGPUBuffer(device, state.bodies);
        bufferB = createGPUBuffer(device, state.bodies);
        computeBindGroup = makeComputeBindGroup(device, computeBGL, bufferA, bufferB, paramsBuffer);
        renderBindGroup = makeBindGroup(device, renderBGL, bufferB, zoomBuffer);
        
        // update params with new body count
        const newParamsData = new ArrayBuffer(16);
        new Float32Array(newParamsData, 0, 2).set([6.674e-3, state.dt]);
        new Uint32Array(newParamsData, 8, 1).set([state.bodies.length]);
        new Float32Array(newParamsData, 12, 1).set([1e10]);
        device.queue.writeBuffer(paramsBuffer, 0, newParamsData);
        
        insertMode = false;
        insertBtn.textContent = 'Insert Mass Mode';
        insertBtn.style.background = '#ffcc00';
    });

    // speed multiplier
    const speedSlider = document.getElementById('speedMultiplier') as HTMLInputElement;
    const speedVal = document.getElementById('speedVal')!;
    speedSlider.addEventListener('input', () => speedVal.textContent = speedSlider.value);

    zoomSlider.addEventListener('input', () => {
        zoomVal.textContent = zoomSlider.value,
        device.queue.writeBuffer(zoomBuffer, 0, new Float32Array([parseFloat(zoomSlider.value)]))
    });

    document.getElementById('generateBtn')!.addEventListener('click', () => {
        const count = parseInt(bodyCountSlider.value);
        const variance = parseFloat(massVarianceSlider.value) * 1e5;
        const minDist = parseFloat(minRadiusSlider.value);
        const maxDist = parseFloat(maxRadiusSlider.value);
        
        state.bodies = generateBodies(count, variance, minDist, maxDist);
        bufferA = createGPUBuffer(device, state.bodies);
        bufferB = createGPUBuffer(device, state.bodies);
        computeBindGroup = makeComputeBindGroup(device, computeBGL, bufferA, bufferB, paramsBuffer);
        renderBindGroup = makeBindGroup(device, renderBGL, bufferB, zoomBuffer);
        
        // update body count in params
        const newParamsData = new ArrayBuffer(16);
        new Float32Array(newParamsData, 0, 2).set([6.674e-3, state.dt]);
        new Uint32Array(newParamsData, 8, 1).set([state.bodies.length]);
        new Float32Array(newParamsData, 12, 1).set([1e10]);
        device.queue.writeBuffer(paramsBuffer, 0, newParamsData);
    });

    let frameCount = 0;

    // render loop. sets up the command encoder dispatch calls and swaps the buffers as needed, then renders
    function loop()
    {
        const speed = parseInt(speedSlider.value);

        for (let s = 0; s < speed; s++) {
            const encoder = device.createCommandEncoder();
            const computePass = encoder.beginComputePass();
            computePass.setPipeline(computePipeline);
            computePass.setBindGroup(0, computeBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(state.bodies.length / 64));
            computePass.end();
            device.queue.submit([encoder.finish()]);

            [bufferA, bufferB] = [bufferB, bufferA];
            computeBindGroup = makeComputeBindGroup(device, computeBGL, bufferA, bufferB, paramsBuffer);
            renderBindGroup = makeBindGroup(device, renderBGL, bufferB, zoomBuffer);
        }
        // // compute pass
        // const encoder = device.createCommandEncoder();
        // const computePass = encoder.beginComputePass();
        // computePass.setPipeline(computePipeline);
        // computePass.setBindGroup(0, computeBindGroup);
        // computePass.dispatchWorkgroups(Math.ceil(state.bodies.length / 64));
        // computePass.end();
        // device.queue.submit([encoder.finish()]);

        // // swap buffers
        // [bufferA, bufferB] = [bufferB, bufferA];
        // computeBindGroup = makeComputeBindGroup(device, computeBGL, bufferA, bufferB, paramsBuffer);
        // renderBindGroup = makeBindGroup(device, renderBGL, bufferB, zoomBuffer);

        // render
        renderPass(device, context, renderPipeline, renderBindGroup, state.bodies.length);

        frameCount++;

        if (frameCount % 10 === 0) {
            
            // read current body data from GPU back to CPU
            const readBuffer = device.createBuffer({
                size: state.bodies.length * 12 * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            const encoder = device.createCommandEncoder();
            encoder.copyBufferToBuffer(bufferB, 0, readBuffer, 0, state.bodies.length * 12 * 4);
            device.queue.submit([encoder.finish()]);
            
            readBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const data = new Float32Array(readBuffer.getMappedRange());
                // update state.bodies positions from GPU data
                for (let i = 0; i < state.bodies.length; i++) {
                    state.bodies[i].x = data[i * 12 + 0];
                    state.bodies[i].y = data[i * 12 + 1];
                    state.bodies[i].vx = data[i * 12 + 2];
                    state.bodies[i].vy = data[i * 12 + 3];
                }
                readBuffer.unmap();
                readBuffer.destroy();
                checkCollisions(state.bodies, device, bufferA);
                checkCollisions(state.bodies, device, bufferB);
            });
        }
        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', main);
