import { WebGL } from './WebGL.js';
import { WebXR } from './WebXR.js';
import { Ticker } from './Ticker.js';
import { mat4 } from '../../lib/gl-matrix-module.js';

import { Node } from './Node.js';
import { PerspectiveCamera } from './PerspectiveCamera.js';
import { Volume } from './Volume.js';
import { Transform } from './Transform.js';

import { RendererFactory } from './renderers/RendererFactory.js';
import { ToneMapperFactory } from './tonemappers/ToneMapperFactory.js';

import { CircleAnimator } from './animators/CircleAnimator.js';
import { OrbitCameraAnimator } from './animators/OrbitCameraAnimator.js';
import { FOVRenderer } from './renderers/FOVRenderer.js';
import { MCMRenderer2 } from './renderers/MCMRenderer2.js';
import { MIPRenderer } from './renderers/MIPRenderer.js';
import { MCMRenderer } from './renderers/MCMRenderer.js';
import { FOVRenderer2 } from './renderers/FOVRenderer2.js';
import { FOVRenderer3 } from './renderers/FOVRenderer3.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class RenderingContext extends EventTarget {

constructor(options = {}) {
    super();

    this.render = this.render.bind(this);
    this.webglcontextlostHandler = this.webglcontextlostHandler.bind(this);
    this.webglcontextrestoredHandler = this.webglcontextrestoredHandler.bind(this);

    this.canvas = document.createElement('canvas');
    this.canvas.addEventListener('webglcontextlost', this.webglcontextlostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.webglcontextrestoredHandler);

    this.initGL();
    this.session = WebXR.createSession(this.gl);
    this.isImmersive = false;
    this.useTimer = false;
    this.right = false;


    this.resolution = options.resolution ?? {width: 512, height: 512};
    this.filter = options.filter ?? 'linear';

    this.camera = new Node();
    this.camera.transform.localTranslation = [0, 0, 2];
    this.camera.components.push(new PerspectiveCamera(this.camera));

    this.camera.transform.addEventListener('change', e => {
        if (this.renderer && !this.disable) {
            this.renderer.reset();

        }
    });
    //this.cameraAnimator = new CircleAnimator(this.camera, {
    //    center: [0, 0, 2],
    //    direction: [0, 0, 1],
    //    radius: 0.01,
    //    frequency: 1,
    //});
    this.cameraAnimator = new OrbitCameraAnimator(this.camera, this.canvas);
    this.cameraAnimator._rotateAroundFocus(1.25, 0);
    // this.cameraAnimator._rotateAroundFocus(2.6, 0);
    // this.cameraAnimator._zoom(-0.7, 0);
    this.cameraAnimator._zoom(-0.6, 0);

    this.volume = new Volume(this.gl);
    this.volumeTransform = new Transform(new Node());
    this.once = false;
    this.countFOV = 0;
    this.countMCM = 0;
    this.timeoffsetF = 0;
    this.timeoffsetM = 0;
    this.FOVList = [];
    this.MCMList = [];
    this.timerFOV = 0;
    this.timerMCM = 0;
    this.timerMCM2 = 0;

    this._update = this._update.bind(this);
    this.VRiterations = 0;
}

// ============================ WEBGL SUBSYSTEM ============================ //

initGL() {
    const contextSettings = {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: true,
        xrCompatible: true,
    };

    this.autoMeasure = true;
    this.contextRestorable = true;

    this.gl = this.canvas.getContext('webgl2', contextSettings);
    const gl = this.gl;
    console.log(gl)

    this.extLoseContext = gl.getExtension('WEBGL_lose_context');
    this.extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
    this.extTextureFloatLinear = gl.getExtension('OES_texture_float_linear');
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!this.ext) {
        console.error('EXT_disjoint_timer_query is not supported');
    }

    if (!this.extColorBufferFloat) {
        console.error('EXT_color_buffer_float not supported!');
    }

    if (!this.extTextureFloatLinear) {
        console.error('OES_texture_float_linear not supported!');
    }


    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    this.environmentTexture = WebGL.createTexture(gl, {
        width   : 1,
        height  : 1,
        data    : new Uint8Array([255, 255, 255, 255]),
        format  : gl.RGBA,
        iformat : gl.RGBA, // TODO: HDRI & OpenEXR support
        type    : gl.UNSIGNED_BYTE,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        min     : gl.LINEAR,
        max     : gl.LINEAR,
    });

    this.measureTexture = WebGL.createTexture(gl, {
        width   : 1,
        height  : 1,
        data    : new Uint8Array([255, 255, 255, 255]),
        format  : gl.RGBA,
        iformat : gl.RGBA, // TODO: HDRI & OpenEXR support
        type    : gl.UNSIGNED_BYTE,
        wrapS   : gl.CLAMP_TO_EDGE,
        wrapT   : gl.CLAMP_TO_EDGE,
        min     : gl.LINEAR,
        max     : gl.LINEAR,
    });

    this.programs = WebGL.buildPrograms(gl, {
        quad: SHADERS.quad,
        quadFov: SHADERS.quadFov
    }, MIXINS);
}

enableBtn() {
    console.log("snap");
    this.countdown = 5;
}

webglcontextlostHandler(e) {
    if (this.contextRestorable) {
        e.preventDefault();
    }
}

webglcontextrestoredHandler(e) {
    this.initGL();
}

resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.getComponent(PerspectiveCamera).aspect = width / height;
}

async setVolume(reader) {
    this.volume = new Volume(this.gl, reader);
    this.volume.addEventListener('progress', e => {
        this.dispatchEvent(new CustomEvent('progress', { detail: e.detail }));
    });
    await this.volume.load();
    this.volume.setFilter(this.filter);
    if (this.renderer) {
        this.renderer.setVolume(this.volume);
    }
}

setEnvironmentMap(image) {
    WebGL.createTexture(this.gl, {
        texture : this.environmentTexture,
        image   : image
    });
}

setFilter(filter) {
    this.filter = filter;
    if (this.volume) {
        this.volume.setFilter(filter);
        if (this.renderer) {
            this.renderer.reset();
        }
    }
}

setAuto(auto) {
    this.autoMeasure = auto;
}

chooseRenderer(renderer) {
    if (this.renderer) {
        this.renderer.destroy();
    }
    const rendererClass = RendererFactory(renderer);
    this.renderer = new rendererClass(this.gl, this.volume, this.camera, this.environmentTexture, {
        resolution: this.resolution,
        transform: this.volumeTransform,
    });
    this.renderer.setContext(this);
    // if(this.renderer instanceof FOVRenderer){
    //     this.disable = true;
    // }
    this.renderer.reset();
    if (this.toneMapper) {
        this.toneMapper.setTexture(this.renderer.getTexture());
    }
    this.isTransformationDirty = true;
    this.countMCM = 0;
    this.countFOV = 0;
    this.timer = 0;
    this.count = 0;
    if(this.query) {
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.gl.deleteQuery(this.query);
        console.log("QUERY!");
    }
    if(this.queries) {
        this.queries.forEach(q => {
            this.gl.deleteQuery(q);
        });
    }  
    this.query = null;
    this.queries = [];
    // if(this.renderer instanceof FOVRenderer){
    //     this.disable = false;
    // }
}

chooseRenderer2(renderer) {
    if (this.renderer2) {
        this.renderer2.destroy();
    }
    const rendererClass = RendererFactory(renderer);
    this.renderer2 = new rendererClass(this.gl, this.volume, this.camera, this.environmentTexture, {
        resolution: this.resolution,
        transform: this.volumeTransform,
    });
    this.renderer2.setContext(this);
    // if(this.renderer instanceof FOVRenderer){
    //     this.disable = true;
    // }
    this.renderer2.reset();
    if (this.toneMapper2) {
        this.toneMapper2.setTexture(this.renderer2.getTexture());
    }
}

chooseToneMapper(toneMapper) {
    if (this.toneMapper && !this.keep) {
        this.toneMapper.destroy();
    }
    const gl = this.gl;
    let texture;
    if (this.renderer) {
        texture = this.renderer.getTexture();
    } else {
        texture = WebGL.createTexture(gl, {
            width  : 1,
            height : 1,
            data   : new Uint8Array([255, 255, 255, 255]),
        });
    }
    const toneMapperClass = ToneMapperFactory(toneMapper);
    this.toneMapper = new toneMapperClass(gl, texture, {
        resolution: this.resolution,
    });

    this.toneMapper.copy = this.copy;
    if (this.renderer instanceof FOVRenderer) {
        this.toneMapper._lastTexture = this.renderer._renderBuffer.getAttachments().color[1];
        this.toneMapper._position = this.renderer._accumulationBuffer.getReadAttachments().color[0];
    }
}

chooseToneMapper2(toneMapper) {
    if (this.toneMapper2 && !this.keep) {
        this.toneMapper2.destroy();
    }
    const gl = this.gl;
    let texture;
    if (this.renderer2) {
        texture = this.renderer2.getTexture();
    } else {
        texture = WebGL.createTexture(gl, {
            width  : 1,
            height : 1,
            data   : new Uint8Array([255, 255, 255, 255]),
        });
    }
    const toneMapperClass = ToneMapperFactory(toneMapper);
    this.toneMapper2 = new toneMapperClass(gl, texture, {
        resolution: this.resolution,
    });

    this.toneMapper2.copy = this.copy;
}

_update(t, frame) {
    console.log(this.gl.getError());
    if(this.VRiterations > 1500) {
        console.log("OVER");
        Ticker.remove(this._update);
        return;
    }
    let session = this.session;
    let gl = this.gl;
    console.log(gl.getError());
    if(this.VRFirst) {
        this.VRFirst = false;
        console.log("render state:", session.renderState);
        let glLayer = session.renderState.baseLayer;
        console.log("gl layer:", glLayer);
        this.resolution = {width: glLayer.framebufferWidth, height: glLayer.framebufferHeight}
        console.log(gl.getError());
        this.chooseRenderer("test");
        this.chooseRenderer2("test");
        this.chooseToneMapper("artistic");
        this.chooseToneMapper2("artistic");
        this.renderer.VROn = true;
        this.extLoseContext = gl.getExtension('WEBGL_lose_context');
        this.extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
        this.extTextureFloatLinear = gl.getExtension('OES_texture_float_linear');
        console.log(gl.getError());

        // this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    }
    console.log("t", t, this.VRiterations);
    // console.log("frame", frame);
    let pose = frame.getViewerPose(this.refSpace);
    if (pose) {
        let glLayer = session.renderState.baseLayer;
        for (let view of pose.views) {
            let viewport = glLayer.getViewport(view);
            gl.viewport(viewport.x, viewport.y,
                viewport.width, viewport.height);
            // this.camera.transform.localMatrix = mat4.invert([], view.transform.matrix);
            // scene.draw(view.projectionMatrix, view.transform);
            this.render();
            this.right = !this.right;
        }
    } else {
        console.log("NO POSE!");
    }
    this.VRiterations++;
}

render() {
    const gl = this.gl;
    if (!gl || !this.renderer || !this.toneMapper) {
        return;
    }
    let ext = this.ext;

    if(this.useTimer) {
        this.query = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, this.query);
    }

    if(this.right) {
        this.renderer2.render();
        this.toneMapper2.render();
    }
    else {
        this.renderer.render();
        this.toneMapper.render();
    }
    
    this.program = this.programs.quad;
    
    const { program, uniforms } = this.program;
    
    gl.useProgram(program);

    if(this.isImmersive) {
        let glLayer = this.session.renderState.baseLayer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

    }
    else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.right ? this.toneMapper2.getTexture() : this.toneMapper.getTexture());

    gl.uniform1i(uniforms.uTexture, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);


    if(!this.useTimer) {
        return;
    }
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.queries.push(this.query);
    this.query = null;

    // this.pendingQueries.push(query);
    // const readyQueries = [];
    // for (let q of this.pendingQueries) {
    // console.log(this.query);
    if (this.queries.length > 0) {
        const q = this.queries[0];
        const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);

        if (available) {
            if (!disjoint) {
                const elapsedTime = gl.getQueryParameter(q, gl.QUERY_RESULT);
                this.timer += elapsedTime;
                if((this.renderer instanceof MCMRenderer || this.renderer instanceof FOVRenderer3) && this.countMCM > 500 && this.countMCM < 1001) {
                // if(this.renderer instanceof MCMRenderer && this.countMCM < 501) {
                    if(this.first)
                        this.timerMCM2 += elapsedTime;
                    else
                        this.timerMCM += elapsedTime;
                }
                if((this.renderer instanceof FOVRenderer || this.renderer instanceof MCMRenderer2 || this.renderer instanceof FOVRenderer2) && this.countFOV < 501)
                    this.timerFOV += elapsedTime;
                this.count++;
            }
            else
                console.log("DISJOINT");

            gl.deleteQuery(q);
            // q = null;
            this.queries.shift();
        }
        else
            console.log("NOT READY");
    }

    if((this.renderer instanceof MCMRenderer || this.renderer instanceof FOVRenderer3)) {
        if(this.countMCM == 5000) {
            this.pixels = new Uint8Array(this.resolution.width * this.resolution.height * 4);
            gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
            //this.renderer.measureTexture = { ...this.toneMapper.getTexture() };
            console.log("-\n-\n-\nMEASURE READY\n-\n-\n-");
            this.first = true;
            this.toneMapper._Ref = { ...this.renderer._renderBuffer.getAttachments() };

            this.copy = WebGL.createTexture(gl, {
                width   : this._resolution.width,
                height  : this._resolution.height,
                min     : gl.NEAREST,
                mag     : gl.NEAREST,
                format  : gl.RGBA,
                iformat : gl.RGBA32F,
                type    : gl.FLOAT,
            })

            const fboSrc = gl.createFramebuffer();
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboSrc);
            gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                    gl.TEXTURE_2D, this.renderer._renderBuffer.getAttachments().color[0], 0);

            const fboDst = gl.createFramebuffer();
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboDst);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                    gl.TEXTURE_2D, this.copy, 0);

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboSrc);
            // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboDst);
            gl.blitFramebuffer(0, 0, this.resolution.width, this.resolution.height,
                            0, 0, this.resolution.width, this.resolution.height,
                            gl.COLOR_BUFFER_BIT, gl.NEAREST);

            this.compare = 1.0;
            if(this.autoMeasure)
                this.chooseRenderer("fov2");
        }
        if(this.first && this.countMCM % 2 == 0 && this.countMCM < 501) {
            let pixelsMCM = new Uint8Array(this.resolution.width * this.resolution.height * 4);
            // this.timer3 = performance.now().toFixed(3);
            gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsMCM);
            this.MCMList.push(pixelsMCM);
            // this.timeoffsetM += performance.now().toFixed(3) - this.timer3;
            // this.timeoffsetM += performance.now().toFixed(3) - this.timer3;

            if(this.countMCM == 500) {
                console.log("MCM READY");
                this.second = true;
            }
        }
        if(this.countMCM == 500 && this.second) {
            console.log("FOV TIME: ", (this.timerFOV / 500.0).toFixed(2));
            console.log("MCM TIME (speedup):", (this.timerMCM2 / 500.0).toFixed(2));
            console.log("MCM TIME (used): ", (this.timerMCM / 500.0).toFixed(2));
            let ratio = this.timerFOV / this.timerMCM;
            console.log("RATIO (speedup):", (this.timerFOV / this.timerMCM2).toFixed(2));
            console.log("RATIO (used):", ratio.toFixed(2));
            // ratio = 0.95;
            ratio = 1.00;
            let listF = [];
            let listM = [];
            let resultsFOV = "";
            let resultsMCM = "";
            let bpFOV = "";
            let bpMCM = "";
            let diff = "";
            let div = "";
            for(let k = 0; k < this.FOVList.length; k++) { //FOVList length = MCMList length - 1?
                if(k % 5 != 0)
                    continue;
                let k2 = Math.round(k * ratio);
                if(k2 >= this.MCMList.length)
                    break;
                let mseF = 0;
                let mseM = 0;
                for(let i = 0; i < this.canvas.height; i++) {
                    for(let j = 0; j < this.canvas.width; j++) {
                        let index = (i * this.canvas.height + j) * 4;
                        let R = this.pixels[index];
                        let G = this.pixels[index+1];
                        let B = this.pixels[index+2];
    
                        let r = this.FOVList[k][index];
                        let g = this.FOVList[k][index+1];
                        let b = this.FOVList[k][index+2];
    
                        let rr = this.MCMList[k2][index];
                        let gg = this.MCMList[k2][index+1];
                        let bb = this.MCMList[k2][index+2];
    
                        mseF += ((R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2) / 3.0;
                        mseM += ((R - rr) ** 2 + (G - gg) ** 2 + (B - bb) ** 2) / 3.0;
                        // mseF += (R - r) ** 2;
                        // mseM += (R - rr) ** 2;
                        //console.log(mse);
                    }
                }
                mseF /= (this.resolution.width * this.resolution.height);
                mseM /= (this.resolution.width * this.resolution.height);
                bpFOV += "FOV " + k * 2 + "\n";
                bpMCM += "MCM " + k2 * 2 + "\n";
                resultsFOV += mseF.toFixed(2) + "\n";
                resultsMCM += mseM.toFixed(2) + "\n";
                diff += (mseF - mseM).toFixed(2) + "\n";
                div += (mseF/ mseM).toFixed(2) + "\n";
                console.log("FOV " + k * 2 + " MCM " + k2 * 2);
                console.log(mseF);
                console.log(mseM);
            }
            console.log("RATIO (used):", ratio.toFixed(2));
            console.log("DIFFERENCE:\n" + diff);
            console.log("F/M RATIO:\n" + div);
            // console.log("FOV BP:\n" + bpFOV);
            // console.log("MCM BP:\n" + bpMCM);

            let white = 0;
            let it = 0;
            for(let i = 0; i < this.resolution.height; i++) {
                for(let j = 0; j < this.resolution.width; j++) {
                    let index = (i * this.resolution.height + j) * 4;
                    let R = this.pixels[index];
                    let G = this.pixels[index+1];
                    let B = this.pixels[index+2];
                    if(R + G + B == 765)
                        white++;
                    it++;
                }
            }
            console.log("WHITE %: " + white / it);
        }

        this.countMCM++;
    }
    else if((this.renderer instanceof FOVRenderer || this.renderer instanceof MCMRenderer2 || this.renderer instanceof FOVRenderer2)) {
        if(this.countFOV % 2 == 0 && this.countFOV < 501) {
            let pixelsFOV = new Uint8Array(this.resolution.width * this.resolution.height * 4);
            gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsFOV);
            this.FOVList.push(pixelsFOV);

            if(this.countFOV == 500) {
                console.log("--- FOV READY ---");
                if(this.autoMeasure)
                    this.chooseRenderer("mcm");
            }
        }
        
        this.countFOV++;
    }

    if(this.count % 25 == 0 && this.timer != 0) {
        let type = "READ";
        if(this.renderer instanceof FOVRenderer || this.renderer instanceof FOVRenderer2)
            type = "FOV";
        else if(this.renderer instanceof MCMRenderer)
            type = "MCM";
        else if(this.renderer instanceof MIPRenderer)
            type = "MIP";
        console.log(`${type} Time: ${((this.timer / 25.0) / 1000000.0).toFixed(2)} ms`);
        this.timer = 0;
    }
}

    // let imageURL  = this.canvas.toDataURL('image/png');
    // var downloadLink = document.createElement('a');
    // downloadLink.href = imageURL;
    // if(this.renderer instanceof FOVRenderer) {
    //     downloadLink.download = 'FOV.png';
    // }
    // else {
    //     downloadLink.download = 'MCM.png';
    // }
    // document.body.appendChild(downloadLink);
    // downloadLink.click();
    // document.body.removeChild(downloadLink);

get resolution() {
    return this._resolution;
}

set resolution(resolution) {
    this._resolution = resolution;
    this.canvas.width = resolution.width;
    this.canvas.height = resolution.height;
    if (this.renderer) {
        this.renderer.setResolution(resolution);
    }
    if (this.toneMapper) {
        this.toneMapper.setResolution(resolution);
        if (this.renderer) {
            this.toneMapper.setTexture(this.renderer.getTexture());
        }
    }
}

async recordAnimation(options = {}) {
    const date = new Date();
    const timestamp = [
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
    ].join('_');

    if (options.type === 'images') {
        const parentDirectory = await showDirectoryPicker();
        const directory = await parentDirectory.getDirectoryHandle(timestamp, { create: true });
        this.recordAnimationToImageSequence({ directory, ...options });
    } else if (options.type === 'video') {
        const outputStream = await showSaveFilePicker({
            suggestedName: timestamp + '.mp4',
        }).then(file => file.createWritable());
        this.recordAnimationToVideo({ outputStream, ...options });
    } else {
        throw new Error(`animation output type (${options.type}) not supported`);
    }
}

async recordAnimationToImageSequence(options = {}) {
    const { directory, startTime, endTime, frameTime, fps } = options;
    const frames = Math.max(Math.ceil((endTime - startTime) * fps), 1);
    const timeStep = 1 / fps;

    function wait(millis) {
        return new Promise((resolve, reject) => setTimeout(resolve, millis));
    }

    function pad(number, length) {
        const string = String(number);
        const remaining = length - string.length;
        const padding = new Array(remaining).fill('0').join('');
        return padding + string;
    }

    const canvas = this.canvas;
    function getCanvasBlob() {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => resolve(blob));
        });
    }

    this.stopRendering();

    for (let i = 0; i < frames; i++) {
        const t = startTime + i * timeStep;
        this.cameraAnimator.update(t);

        this.renderer.reset();
        this.startRendering();
        await wait(frameTime * 1000);
        this.stopRendering();

        const filename = `frame${pad(i, 4)}.png`;
        const file = await directory.getFileHandle(filename, { create: true })
            .then(file => file.createWritable());
        const blob = await getCanvasBlob();
        file.write(blob);
        file.close();

        this.dispatchEvent(new CustomEvent('animationprogress', {
            detail: (i + 1) / frames
        }));
    }

    this.startRendering();
}

async recordAnimationToVideo(options = {}) {
    const { outputStream, startTime, endTime, frameTime, fps } = options;
    const frames = Math.max(Math.ceil((endTime - startTime) * fps), 1);
    const timeStep = 1 / fps;

    function wait(millis) {
        return new Promise((resolve, reject) => setTimeout(resolve, millis));
    }

    function pad(number, length) {
        const string = String(number);
        const remaining = length - string.length;
        const padding = new Array(remaining).fill('0').join('');
        return padding + string;
    }

    const canvasStream = this.canvas.captureStream(0);
    const videoStream = canvasStream.getVideoTracks()[0];
    const recorder = new MediaRecorder(canvasStream, {
        videoBitsPerSecond : 4 * 1024 * 1024,
    });
    recorder.addEventListener('dataavailable', e => {
        outputStream.write(e.data);
        outputStream.close();
    });

    this.stopRendering();
    recorder.start();

    for (let i = 0; i < frames; i++) {
        const t = startTime + i * timeStep;
        this.cameraAnimator.update(t);

        this.renderer.reset();
        this.startRendering();
        await wait(frameTime * 1000);
        this.stopRendering();

        videoStream.requestFrame();

        this.dispatchEvent(new CustomEvent('animationprogress', {
            detail: (i + 1) / frames
        }));
    }

    recorder.stop();
    this.startRendering();
}

startRendering() {
    Ticker.add(this.render);
}

stopRendering() {
    Ticker.remove(this.render);
}

}
