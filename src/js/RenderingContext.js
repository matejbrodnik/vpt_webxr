import { WebGL } from './WebGL.js';
import { WebXR } from './WebXR.js';
import { Ticker } from './Ticker.js';
import { quat, vec3, mat4 } from '../../lib/gl-matrix-module.js';

import { Node } from './Node.js';
import { PerspectiveCamera } from './PerspectiveCamera.js';
import { Volume } from './Volume.js';
import { Transform } from './Transform.js';
import { TransferFunction } from './ui/TransferFunction/TransferFunction.js';

import { RendererFactory } from './renderers/RendererFactory.js';
import { ToneMapperFactory } from './tonemappers/ToneMapperFactory.js';
import { LoaderFactory } from './loaders/LoaderFactory.js';
import { ReaderFactory } from './readers/ReaderFactory.js';

import { VRCameraAnimator } from './animators/VRCameraAnimator.js';

import { CircleAnimator } from './animators/CircleAnimator.js';
import { OrbitCameraAnimator } from './animators/OrbitCameraAnimator.js';
import { FOVRenderer } from './renderers/FOVRenderer.js';
import { MCMRenderer2 } from './renderers/MCMRenderer2.js';
import { MIPRenderer } from './renderers/MIPRenderer.js';
import { MCMRenderer } from './renderers/MCMRenderer.js';
import { FOVRenderer2 } from './renderers/FOVRenderer2.js';
import { FOVRenderer3 } from './renderers/FOVRenderer3.js';

import { UIRenderer } from './UIRenderer.js';
import { EyeReproject } from './EyeReproject.js';
import { ISORenderer } from './renderers/ISORenderer.js';
import { LAORenderer } from './renderers/LAORenderer.js';
import { DOSRenderer } from './renderers/DOSRenderer.js';
import { Survey } from './Survey.js';
import { CommonUtils } from './utils/CommonUtils.js';

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
    this.volume = new Volume(this.gl);
    this.volumeTransform = new Transform(new Node());
    // this.volumeTransform.localTranslation = [0, 0, -2];
    
    this.isImmersive = false;
    this.useTimer = false; // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    this.right = false;
    this.changedView = false;

    this.resolution = options.resolution ?? {width: 512, height: 512};
    this.filter = options.filter ?? 'linear';

    this.camera = new Node();
    this.camera.transform.localTranslation = [0, 0, 1];
    this.camera.components.push(new PerspectiveCamera(this.camera));

    this.camera.transform.addEventListener('change', e => {
        // console.log("CAMERA CHANGE")
        if (this.renderer && !this.disable) {
            console.log("CAMERA CHANGE RESET")
            this.renderer.random = Math.random();
            this.renderer.reset(); //move outside to prevent stuttering on reset

        }
    });
    //this.cameraAnimator = new CircleAnimator(this.camera, {
    //    center: [0, 0, 2],
    //    direction: [0, 0, 1],
    //    radius: 0.01,
    //    frequency: 1,
    //});
    this.cameraAnimator = new OrbitCameraAnimator(this.camera, this.canvas, this.volumeTransform);
    // this.cameraAnimator._rotateAroundFocus(1.25, 0);
    // this.cameraAnimator._rotateAroundFocus(2.6, 0);
    // this.cameraAnimator._zoom(-0.7, 0);
    // this.cameraAnimator._zoom(-0.4, 0);


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

    this.loop = 3;
    this.reproList = [];
    this.benchList = [];
    this.iter = 0;
    this.initial = 100;
    this.UIinit = true;
    this.VROn = false;
    
    this.tf = '[{"position":{"x":0.2745,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":1,"g":0.96,"b":0.3,"a":1}},' +
    '{"position":{"x":0.363,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":0.3,"g":1,"b":0.31,"a":1}},' +
    '{"position":{"x":0.4314,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":0.3,"g":1,"b":0.97,"a":1}},' +
    '{"position":{"x":0.5098,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":0.3,"g":0.75,"b":1,"a":1}},' +
    '{"position":{"x":0.5882,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":0.49,"g":0.3,"b":1,"a":1}},' +
    '{"position":{"x":0.6667,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":0.77,"g":0.3,"b":1,"a":1}},' +
    '{"position":{"x":0.7451,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":1,"g":0.3,"b":0.82,"a":1}},' +
    '{"position":{"x":0.8235,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":1,"g":0,"b":0,"a":1}},' +
    '{"position":{"x":0.902,"y":0.97},"size":{"x":0.012,"y":0.2},"color":{"r":1,"g":0.73,"b":0,"a":1}},' +
    '{"position":{"x":0.981,"y":0.97},"size":{"x":0.01,"y":0.2},"color":{"r":0.3,"g":0.3,"b":0.3,"a":1}}]';
    // this.VRAnimator = new VRCameraAnimator(this.volumeTransform);
    this.currFileIndex = 0;
    this.setupIndex = 0;
    this.setupList = [
        {
            depthParams: { // 330430
            xA: 239, yA: 248,
            xD: 268, yD: 250,
            xB: 305, yB: 222,
            rotation: quat.fromEuler(quat.create(), 0, 0, 180), translation: vec3.clone([0, -0.3, 0])}, 
            fileIndex: 0,
            type: "depth"
        },
        {
            fileIndex: 1,
            start: [0.5, 0.5, 0.5],
            type: "search"
        },
        {
            depthParams: { // 330430
            xA: 215, yA: 255,
            xD: 257, yD: 222,
            xB: 324, yB: 204,
            rotation: quat.fromEuler(quat.create(), 90, 20, 0), translation: vec3.clone([0.1, -0.2, 0])}, 
            fileIndex: 0,
            type: "depth"
        },
        {
            fileIndex: 0,
            start: [1.0, 0.6, 0.6],
            type: "search"
        },
    ];
    
    console.log(this.camera.transform);
}

// ============================ WEBGL SUBSYSTEM ============================ //

initGL(inline = true) {
    if(inline) {
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

    }
    const gl = this.gl;
    console.log(gl)
    // console.log(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision);
    // console.log(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
    this.extLoseContext = gl.getExtension('WEBGL_lose_context');
    this.extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
    this.extTextureFloatLinear = gl.getExtension('OES_texture_float_linear');
    this.extTime = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');

    if (!this.extTime) {
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
    console.log("lost")
    if (this.contextRestorable) {
        e.preventDefault();
    }
}

webglcontextrestoredHandler(e) {
    console.log("restored")
    this.initGL();
}

resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.getComponent(PerspectiveCamera).aspect = width / height;
}

async loadVolume(index, filetype, precision=8) {
    const readerClass = ReaderFactory(filetype);
    if (readerClass) {
        const loaderClass = LoaderFactory('blob');
        const file = this.files[index];
        console.log(index)
        this.currFileIndex = index;
        const loader = new loaderClass(file);
        let dim = file.name.split("_")[1].split("x");
        const reader = new readerClass(loader, {
            width  : dim[0],
            height : dim[1],
            depth  : dim[2],
            bits   : precision,
        });
        // const reader = new readerClass(loader, {
        //     width  : options.dimensions[0],
        //     height : options.dimensions[1],
        //     depth  : options.dimensions[2],
        //     bits   : options.precision,
        // });
        this.stopRendering();
        await this.setVolume(reader);
        this.startRendering();
    }
}

async setVolume(reader) {
    this.volume = new Volume(this.gl, reader);
    this.volume.addEventListener('progress', e => {
        this.dispatchEvent(new CustomEvent('progress', { detail: e.detail }));
    });
    console.log("context1")
    await this.volume.load();
    console.log("context12")
    this.volume.setFilter(this.filter);
    if (this.renderer) {
        this.renderer.setVolume(this.volume);
    }
    if(this.renderer2) {
        this.renderer2.setVolume(this.volume);
    }

}

swapVolume(index) {
    if(index == this.currFileIndex)
        return;
    if(index < this.files.length)
        this.dispatchEvent(new CustomEvent('volumechange', { detail: index }));
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

chooseRenderer(renderer, reset=true) {
    if (this.renderer) {
        this.renderer.destroy();
    }
    const rendererClass = RendererFactory(renderer);
    this.renderer = new rendererClass(this.gl, this.volume, this.camera, this.environmentTexture, {
        resolution: this.resolution,
        transform: this.volumeTransform,
        VRAnimator: this.VRAnimator,
        VRProjection: this.VRProjection,
        VROn: this.VROn,
    });
    this.renderer.setContext(this);
    // if(this.renderer instanceof FOVRenderer){
    //     this.disable = true;
    // }
    this.renderer.random = Math.random();
    if(reset) {
        this.renderer.reset(true);
        this.renderer.iter = 10;
    }

    if (this.toneMapper) {
        this.toneMapper.setTexture(this.renderer.getTexture());
    }
    this.isTransformationDirty = true;
    this.countMCM = 0;
    this.countFOV = 0;
    this.timer = 0;
    this.count = 0;
    if(this.query) {
        this.gl.endQuery(this.extTime.TIME_ELAPSED_EXT);
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
    if(this.renderer instanceof FOVRenderer2){ 
        this.iter = 0;
        this.bench = true;
    }
}

chooseRenderer2(renderer, reset=true) {
    if (this.renderer2) {
        this.renderer2.destroy();
    }
    const rendererClass = RendererFactory(renderer);
    this.renderer2 = new rendererClass(this.gl, this.volume, this.camera, this.environmentTexture, {
        resolution: this.resolution,
        transform: this.volumeTransform,
        VRAnimator: this.VRAnimator,
        VRProjection: this.VRProjection,
        VROn: this.VROn,
    });
    this.renderer2.setContext(this);
    // if(this.renderer instanceof FOVRenderer){
    //     this.disable = true;
    // }
    this.renderer2.random = Math.random();
    // this.renderer2.reset();
    if(reset) {
        this.renderer2.reset(true);
        this.renderer2.iter = 10;
    }
    // if (this.toneMapper2) {
    //     this.toneMapper2.setTexture(this.renderer2.getTexture());
    // }
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


setupUI(toneMapper) {
    let ui = new UIRenderer(this.gl, toneMapper.getTexture(), {
        resolution: this.resolution,
        extinction: this.renderer.extinction,
        steps: this.renderer.steps,
        VRAnimator: this.VRAnimator,
    });
    ui.reset();
    return ui;
}

setupReprojection() {
    this.reproject = new EyeReproject(this.gl, this.volume, this.renderer, this.toneMapper, {
        resolution: this.resolution,
        VRAnimator: this.VRAnimator,
    });
    // this.reproject.reset(projMatrix);
}

switchRenderer(index) {
    if(index == 0 && !(this.renderer instanceof FOVRenderer2)) {
        this.chooseRenderer("fov2");
        if(this.renderer2)
            this.chooseRenderer2("fov2", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO FOV2");
        return true;
    }
    if(index == 1 && !(this.renderer instanceof MIPRenderer)) {
        this.chooseRenderer("mip");
        if(this.renderer2)
            this.chooseRenderer2("mip", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO MIP");
        return true;
    }
    if(index == 2 && !(this.renderer instanceof MCMRenderer)) {
        this.chooseRenderer("mcm");
        if(this.renderer2)
            this.chooseRenderer2("mcm", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO MCM");
        return true;
    }
    if(index == 3 && !(this.renderer instanceof ISORenderer)) {
        this.chooseRenderer("iso");
        if(this.renderer2)
            this.chooseRenderer2("iso", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO ISO");
        return true;
    }
    if(index == 4 && !(this.renderer instanceof DOSRenderer)) {
        this.chooseRenderer("dos");
        if(this.renderer2)
            this.chooseRenderer2("dos", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO DOS");
        return true;
    }
    if(index == 5 && !(this.renderer instanceof LAORenderer)) {
        this.chooseRenderer("lao");
        if(this.renderer2)
            this.chooseRenderer2("lao", this.VRAnimator.renderState == 1);
        console.log("CHANGED TO LAO");
        return true;
    }
    return false;
}

_update(t, frame) {
    // console.log("update", this.gl.getError());
    // if(this.VRiterations > 100) {
    //     console.log("OVER");
    //     Ticker.remove(this._update);
    //     return;
    // }
    let session = this.session;
    let gl = this.gl;
    if(this.VRFirst) {
        this.VRFirst = false;
        console.log("render state:", session.renderState);
        let glLayer = session.renderState.baseLayer;
        console.log("gl layer:", glLayer);
        this.resolution = {width: glLayer.framebufferWidth / 5, height: glLayer.framebufferHeight / 5}
        this.VRAnimator = new VRCameraAnimator(this.volumeTransform);
        this.VROn = true;
        this.uiRenderer.destroy();
        this.UIinit = true;
        this.old_t = t;
        this.dtSum = 0;
        // this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
    }
    let dt = t - this.old_t;

    if(this.VRiterations < 15)
        this.VRAnimator.steps = 2;
    if(this.VRiterations == 15)
        this.VRAnimator.steps = 30;

    this.dtSum += dt;
    if(this.VRiterations % 5 == 0) {
        console.log("fps:", (1000 / (this.dtSum / 5)).toFixed(1));
        this.dtSum = 0;
    }
    this.old_t = t;
    if(frame.session.inputSources.length > 0) {
        let inputs = frame.session.inputSources;
        this.VRAnimator.update(inputs, dt);
    }
    // this.right = true;
    let pose = frame.getViewerPose(this.refSpace);
    // if(this.VRiterations % 10 == 0 && this.VRiterations != 0) {
    if (pose) {
        if(this.VRiterations == 0) {
            let projectionMatrix = mat4.clone(pose.views[0].projectionMatrix);
            projectionMatrix[8] = 0;
            this.VRProjection = projectionMatrix;
            this.VRAnimator.apply(pose.views[0].transform.matrix, true)
            this.random = Math.random();
            this.chooseRenderer("fov2");
            this.chooseToneMapper("artistic");
            this.chooseRenderer2("fov2");
            this.setupReprojection();
            // this.renderer.log(pose.views[0].transform.matrix)
            // this.renderer.log(pose.views[1].transform.matrix)
            this.renderer.setName("1");
            this.renderer2.setName("2");
            this.renderer.setProjection(pose.views[0].projectionMatrix);
            this.renderer2.setProjection(pose.views[1].projectionMatrix);
            
            this._saveJSON = this._saveJSON.bind(this);
            this.VRAnimator.addEventListener('saveToJSON', this._saveJSON);

            // console.log("model");
            // console.log(this.VRAnimator.model.localTranslation[0], this.VRAnimator.model.localTranslation[1], this.VRAnimator.model.localTranslation[2]);
            // console.log(this.VRAnimator.model.localRotation[0], this.VRAnimator.model.localRotation[1], this.VRAnimator.model.localRotation[2]);
            // console.log("view");
            // console.log(this.VRAnimator.transform.localTranslation[0], this.VRAnimator.transform.localTranslation[1], this.VRAnimator.transform.localTranslation[2]);
            // console.log(this.VRAnimator.transform.localRotation[0], this.VRAnimator.transform.localRotation[1], this.VRAnimator.transform.localRotation[2]);
            // console.log("proj");
            // this.renderer.log(this.renderer._VRProjection);

            if(this.reproject)
                this.reproject.reset(pose.views[1].projectionMatrix);
        }
        // console.log("volume", this.volumeTransform.globalMatrix);
        let glLayer = session.renderState.baseLayer;
        for (let view of pose.views) {
            this.viewport = glLayer.getViewport(view);
                if(!this.right) {
                    this.changedView = this.VRAnimator.renderStateChanged || this.VRAnimator.apply(view.transform.matrix, this.VRiterations <= 1);
                }
                if(this.changedView) {
                    if(this.right) {
                        // console.log("proj right");
                        if(this.VRAnimator.renderState == 1 && this.renderer2.iter >= 1) {
                            this.renderer2.random = this.random;
                            this.renderer2.setProjection(view.projectionMatrix);
                            this.renderer2.reset();
                            this.changedView = false;
                        }
                        else
                            console.log("right reset: ", this.renderer2.iter);
                        // MOGOČE NI V VREDU???
                        if(this.VRAnimator.renderState == 2 && this.reproject && this.renderer.iter >= 2) {
                            this.reproject.reset(view.projectionMatrix);
                            this.changedView = false;
                        }
                        // console.log("RESET 2");
                    }
                    else {
                        // console.log("proj left");
                        if(this.renderer.iter >= 0) {

                            if(this.VRAnimator.renderState == 0) {
                                this.renderer.setProjection(this.VRProjection);
                                this.changedView = false;
                            }
                            if(this.VRAnimator.renderState == 1) {
                                this.renderer.setProjection(view.projectionMatrix);
                            }
                            if(!this.switchRenderer(this.VRAnimator.chosenRenderer)) {
                                this.random = Math.random();
                                this.renderer.random = this.random;
                                this.renderer.reset();
                            }
                            else 
                                this.changedView = false;
    
                            if(this.VRAnimator.renderState == 2 && this.reproject)
                                this.reproject.setMVPleft(view.projectionMatrix);
                        }
                        // console.log("RESET 1");
                    }
                    // continue; // če želimo pri resetu preskočiti render
                }

            this.render();
            this.right = !this.right;
        }
    } else {
        console.log("NO POSE!");
    }
    this.VRiterations++;
}

_saveJSON(e) {
    console.log("SAVE");
    console.log("ENABLE", this.setupIndex);
    
    if(this.setupIndex == this.setupList.length) {
        CommonUtils.downloadJSON(e.detail, "testJSON.json");
        return;
    }

    let setup = this.setupList[this.setupIndex];
    this.swapVolume(setup.fileIndex);
    console.log(setup.type);
    if(setup.type == "depth")
        this.depthInstance(setup.depthParams);
    else if(setup.type == "search")
        this.searchInstance(setup.start);
    

    this.setupIndex++;
}

depthInstance(depthParams) {
    console.log("DEPTH TEST START");
    this.uiRenderer.depthMode = true;
    if(this.VRAnimator) {
        // this.VRAnimator.depthMode = true;
        this.VRAnimator.lockCircle = true;
        this.VRAnimator.focusDistance = 1;
        this.VRAnimator.model.localTranslation = depthParams.translation;
        this.VRAnimator.model.localRotation = depthParams.rotation;
        this.VRAnimator.transform.localRotation = quat.create();
        this.VRAnimator.transform.localTranslation = vec3.clone([0, 0, 1]);
        // console.log("model");
        // console.log(this.VRAnimator.model.localTranslation[0], this.VRAnimator.model.localTranslation[1], this.VRAnimator.model.localTranslation[2]);
        // console.log(this.VRAnimator.model.localRotation[0], this.VRAnimator.model.localRotation[1], this.VRAnimator.model.localRotation[2]);
        // console.log("view");
        // console.log(this.VRAnimator.transform.localTranslation[0], this.VRAnimator.transform.localTranslation[1], this.VRAnimator.transform.localTranslation[2]);
        // console.log(this.VRAnimator.transform.localRotation[0], this.VRAnimator.transform.localRotation[1], this.VRAnimator.transform.localRotation[2]);
        // console.log("proj");
        // this.renderer.log(this.renderer._VRProjection);
        this.uiRenderer.depthParams = depthParams;

    }
    console.log("DEPTH TEST END");
    this.renderer.reset();
    if(this.VRAnimator.renderState == 1)
        this.renderer2.reset();
}

searchInstance(start) {
    console.log("SEARCH START");
    this.VRAnimator.focusDistance = 0;
    this.VRAnimator.start = start;
    this.VRAnimator.searchMode = true;
    this.VRAnimator.transform.localTranslation = vec3.clone(start);
    this.renderer.reset();
    if(this.VRAnimator.renderState == 1)
        this.renderer2.reset();
}

render() {
    const gl = this.gl;

    if (!gl || !this.renderer || !this.toneMapper) {
        return;
    }
    let ext = this.extTime;

    if(this.useTimer) {
        this.query = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, this.query);
    }

    if(this.VRAnimator && this.VRAnimator.depthMode && !this.VRAnimator.lockCircle) {

    }
    
    if(this.UIinit) {
        this.uiRenderer = this.setupUI(this.toneMapper);
        this.UIinit = false;
        const tf = new TransferFunction();

        tf.bumps = JSON.parse(this.tf);
        tf.render();
        tf._rebuildHandles();
        this.renderer.setTransferFunction(tf.canvas);
        if(this.renderer2)
            this.renderer2.setTransferFunction(tf.canvas);
    }

    this.random = Math.random();
    if(this.right) {
        if(this.VRAnimator.renderState == 2) {
            this.reproject.render();
            // this.uiRenderer.render(this.reproject.getTexture(), this.right);
        }
        else if(this.VRAnimator.renderState == 1) {
            this.renderer2.random = this.random;
            this.renderer2.render(); //2
            this.toneMapper.render(this.renderer2.getTexture()); //2
            // this.uiRenderer.render(this.toneMapper.getTexture(), this.right);
        }
        // else
        //     this.uiRenderer.render(this.toneMapper.getTexture(), this.right);
    }
    else {
        this.renderer.random = this.random;
        this.renderer.render();
        this.toneMapper.render(this.renderer.getTexture());
        // this.uiRenderer.render(this.toneMapper.getTexture(), this.right);
    }
    this.uiRenderer.render(this.VRAnimator && this.VRAnimator.renderState == 2 ? this.reproject.getTexture() : this.toneMapper.getTexture(), this.right);

    this.program = this.programs.quad;
    
    const { program, uniforms } = this.program;
    
    gl.useProgram(program);

    if(this.isImmersive) {
        let glLayer = this.session.renderState.baseLayer;
        let viewport = this.viewport;
        gl.viewport(viewport.x, viewport.y,
            viewport.width, viewport.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
        // gl.clearColor(0, 0, 0, 1);
        // gl.clear(gl.COLOR_BUFFER_BIT);

    }
    else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.activeTexture(gl.TEXTURE0);
    if(this.VRAnimator) {
        // console.log("UI", this.VRAnimator.uiActive, "STATE", this.VRAnimator.renderState, "REPRO",  this.VRAnimator.reproject);
        // console.log((this.renderer._VRProjection[8]));
        // console.log(this.VRAnimator.transform);
        // this.renderer.log(this.VRAnimator.transform.inverseGlobalMatrix);
        // console.log("rot", this.VRAnimator.transform.localRotation[0].toFixed(2), this.VRAnimator.transform.localRotation[1].toFixed(2), this.VRAnimator.transform.localRotation[2].toFixed(2));
        // console.log(this.VRAnimator.model);

    }

    // gl.bindTexture(gl.TEXTURE_2D, this.uiRenderer.getTexture());

    if((this.VRAnimator && this.VRAnimator.uiActive) || this.uiRenderer.depthMode) {
        gl.bindTexture(gl.TEXTURE_2D, this.uiRenderer.getTexture());
    }
    else if(this.VRAnimator && this.VRAnimator.renderState == 2 && this.reproject) {
        gl.bindTexture(gl.TEXTURE_2D, this.right ? this.reproject.getTexture() : this.toneMapper.getTexture());
    }
    else {
        gl.bindTexture(gl.TEXTURE_2D, this.toneMapper.getTexture());
    }
    // gl.bindTexture(gl.TEXTURE_2D, this.right ? this.toneMapper2.getTexture() : this.toneMapper.getTexture());
    // gl.bindTexture(gl.TEXTURE_2D, this.right ? this.uiRenderer.getTexture() : this.uiRenderer.getTexture());

    gl.uniform1i(uniforms.uTexture, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if(this.brick) {
        Ticker.reset();
    }

    // if(this.loop == 0) {
    //     this.cameraAnimator._rotateAroundFocus(0.04, 0);
    //     this.loop = 1;
    // }
    // this.loop--;

    if(!this.useTimer) {
        return;
    }
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.queries.push(this.query);
    this.query = null;

    // this.pendingQueries.push(query);
    // const readyQueries = [];
    // for (let q of this.pendingQueries) {
    //     console.log(this.query);
    if (this.queries.length > 0) {
        const q = this.queries[0];
        const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

        if (available) {
            if (!disjoint) {
                const elapsedTime = gl.getQueryParameter(q, gl.QUERY_RESULT);
                this.timer += elapsedTime;
                // console.log("TIME: ", (elapsedTime / 1000000.0).toFixed(2));
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
        // else
        //     console.log("NOT READY");
    }
    // }

    if(this.renderer instanceof FOVRenderer2) {
        if(this.initial > 0) {
            this.initial--;
            return;
        }
        if(this.initial == 0) {
            this.renderer.allow = false;
            this.renderer.reset();
            this.initial--;
            return;
        }
        let angle = 0.1;
        let frames = 2;
        // console.log(this.iter);
        if(this.iter >= 0 && this.iter <= 100) { // reprojekcija OFF
            if(this.bench) {
                if(this.iter == 0) {
                    console.log("START1")
                }
                let pixelsBench = new Uint8Array(this.resolution.width * this.resolution.height * 4);
                gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsBench);
                this.benchList.push(pixelsBench);

                if(this.iter == 100) {
                    this.bench = false;
                    this.renderer.allow = false;
                    // this.cameraAnimator._move([0, 0, angle]);
                    // this.cameraAnimator._move([angle, 0, 0]);
                    this.cameraAnimator._rotateAroundFocus(angle, 0);
                    this.iter = -1 - frames;
                    console.log("STEP 1");
                }
            }
            else if(this.renderer.allow) { // reprojekcija ON
                if(this.iter == 0) {
                    console.log("START2")
                }
                let pixelsRepro = new Uint8Array(this.resolution.width * this.resolution.height * 4);
                gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsRepro);
                this.reproList.push(pixelsRepro);
                
                if(this.iter == 100) {
                    this.renderer.allow = false;
                    this.iter = -1;
                    this.renderer.reset();
                    console.log("STEP 4");
                }
            }
            
        }
        else if(this.iter == -1) {
            // this.brick = true;
            // return;
            this.renderer.allow = true;
            // this.cameraAnimator._move([0, 0, -angle]);
            // this.cameraAnimator._move([-angle, 0, 0]);
            this.cameraAnimator._rotateAroundFocus(-angle, 0);

            console.log("STEP 2,3");
        }

        if(this.iter == 1000){
            console.log("STEP 5,6");
            this.pixels = new Uint8Array(this.resolution.width * this.resolution.height * 4);
            gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
            let ratio = 1.00;
            let resultsRepro = "";
            let resultsBench = "";
            let bpRepro = "";
            let bpBench = "";
            let diff = "";
            let div = "";
            let mseR_all = [];
            let mseB_all = [];
            let iterDiff = "";
            for(let k = 0; k < this.reproList.length; k++) {
                // if(k % 5 != 0)
                //     continue;
                let k2 = Math.round(k * ratio);
                if(k2 >= this.benchList.length)
                    break;
                let mseR = 0;
                let mseB = 0;
                for(let i = 0; i < this.canvas.height; i++) {
                    for(let j = 0; j < this.canvas.width; j++) {
                        let index = (i * this.canvas.height + j) * 4;
                        let R = this.pixels[index];
                        let G = this.pixels[index+1];
                        let B = this.pixels[index+2];
    
                        let r = this.reproList[k][index];
                        let g = this.reproList[k][index+1];
                        let b = this.reproList[k][index+2];
    
                        let rr = this.benchList[k2][index];
                        let gg = this.benchList[k2][index+1];
                        let bb = this.benchList[k2][index+2];
    
                        mseR += ((R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2) / 3.0;
                        mseB += ((R - rr) ** 2 + (G - gg) ** 2 + (B - bb) ** 2) / 3.0;

                    }
                }
                mseR /= (this.resolution.width * this.resolution.height);
                mseB /= (this.resolution.width * this.resolution.height);
                
                mseB_all.push(mseB);
                mseR_all.push(mseR);
                let d = 0;
                let c = 0;
                while(d >= 0 && mseR_all.length > k-c) {
                    d = mseB - mseR_all[k-c];
                    c++;
                }
                if(mseR_all.length > c-1) {
                    d = mseB - mseR_all[k-c+1];
                    // console.log(d.toFixed(2) + " / (" + mseR_all[k-c+2] + " - " + mseR_all[k-c+1] + ")")
                    c += 1 - Math.abs(d / (mseR_all[k-c+2] - mseR_all[k-c+1]));
                }
                diff += (mseR - mseB).toFixed(2) + "\n";
                div += (mseR / mseB).toFixed(2) + "\n";
                if(k < 40)
                    iterDiff += (c-2).toFixed(2) + "\n";
                console.log("Repro " + k + " Bench " + k2); // + " iter ahead " + (c-2).toFixed(4));
                console.log(mseR);
                console.log(mseB);
            }
            console.log("RATIO (used):", ratio.toFixed(2));
            // console.log("DIFFERENCE:\n" + diff);
            console.log("R/B RATIO:\n" + div);
            console.log("ITERATIONS AHEAD:\n" + iterDiff);
        }

        this.iter++;
    }

    // if((this.renderer instanceof MCMRenderer || this.renderer instanceof FOVRenderer3)) {
    //     if(this.countMCM == 5000) {
    //         this.pixels = new Uint8Array(this.resolution.width * this.resolution.height * 4);
    //         gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    //         console.log("-\n-\n-\nMEASURE READY\n-\n-\n-");
    //         this.first = true;
    //         this.toneMapper._Ref = { ...this.renderer._renderBuffer.getAttachments() };

    //         this.copy = WebGL.createTexture(gl, {
    //             width   : this._resolution.width,
    //             height  : this._resolution.height,
    //             min     : gl.NEAREST,
    //             mag     : gl.NEAREST,
    //             format  : gl.RGBA,
    //             iformat : gl.RGBA32F,
    //             type    : gl.FLOAT,
    //         })

    //         const fboSrc = gl.createFramebuffer();
    //         gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboSrc);
    //         gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    //                                 gl.TEXTURE_2D, this.renderer._renderBuffer.getAttachments().color[0], 0);

    //         const fboDst = gl.createFramebuffer();
    //         gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboDst);
    //         gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    //                                 gl.TEXTURE_2D, this.copy, 0);

    //         gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboSrc);
    //         // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboDst);
    //         gl.blitFramebuffer(0, 0, this.resolution.width, this.resolution.height,
    //                         0, 0, this.resolution.width, this.resolution.height,
    //                         gl.COLOR_BUFFER_BIT, gl.NEAREST);

    //         this.compare = 1.0;
    //         if(this.autoMeasure)
    //             this.chooseRenderer("fov2");
    //     }
    //     if(this.first && this.countMCM % 2 == 0 && this.countMCM < 501) {
    //         let pixelsMCM = new Uint8Array(this.resolution.width * this.resolution.height * 4);
    //         // this.timer3 = performance.now().toFixed(3);
    //         gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsMCM);
    //         this.MCMList.push(pixelsMCM);
    //         // this.timeoffsetM += performance.now().toFixed(3) - this.timer3;
    //         // this.timeoffsetM += performance.now().toFixed(3) - this.timer3;

    //         if(this.countMCM == 500) {
    //             console.log("MCM READY");
    //             this.second = true;
    //         }
    //     }
    //     if(this.countMCM == 500 && this.second) {
    //         console.log("FOV TIME: ", (this.timerFOV / 500.0).toFixed(2));
    //         console.log("MCM TIME (speedup):", (this.timerMCM2 / 500.0).toFixed(2));
    //         console.log("MCM TIME (used): ", (this.timerMCM / 500.0).toFixed(2));
    //         let ratio = this.timerFOV / this.timerMCM;
    //         console.log("RATIO (speedup):", (this.timerFOV / this.timerMCM2).toFixed(2));
    //         console.log("RATIO (used):", ratio.toFixed(2));
    //         // ratio = 0.95;
    //         ratio = 1.00;
    //         let listF = [];
    //         let listM = [];
    //         let resultsFOV = "";
    //         let resultsMCM = "";
    //         let bpFOV = "";
    //         let bpMCM = "";
    //         let diff = "";
    //         let div = "";
    //         for(let k = 0; k < this.FOVList.length; k++) { //FOVList length = MCMList length - 1?
    //             if(k % 5 != 0)
    //                 continue;
    //             let k2 = Math.round(k * ratio);
    //             if(k2 >= this.MCMList.length)
    //                 break;
    //             let mseF = 0;
    //             let mseM = 0;
    //             for(let i = 0; i < this.canvas.height; i++) {
    //                 for(let j = 0; j < this.canvas.width; j++) {
    //                     let index = (i * this.canvas.height + j) * 4;
    //                     let R = this.pixels[index];
    //                     let G = this.pixels[index+1];
    //                     let B = this.pixels[index+2];
    
    //                     let r = this.FOVList[k][index];
    //                     let g = this.FOVList[k][index+1];
    //                     let b = this.FOVList[k][index+2];
    
    //                     let rr = this.MCMList[k2][index];
    //                     let gg = this.MCMList[k2][index+1];
    //                     let bb = this.MCMList[k2][index+2];
    
    //                     mseF += ((R - r) ** 2 + (G - g) ** 2 + (B - b) ** 2) / 3.0;
    //                     mseM += ((R - rr) ** 2 + (G - gg) ** 2 + (B - bb) ** 2) / 3.0;
    //                     // mseF += (R - r) ** 2;
    //                     // mseM += (R - rr) ** 2;
    //                     //console.log(mse);
    //                 }
    //             }
    //             mseF /= (this.resolution.width * this.resolution.height);
    //             mseM /= (this.resolution.width * this.resolution.height);
    //             bpFOV += "FOV " + k * 2 + "\n";
    //             bpMCM += "MCM " + k2 * 2 + "\n";
    //             resultsFOV += mseF.toFixed(2) + "\n";
    //             resultsMCM += mseM.toFixed(2) + "\n";
    //             diff += (mseF - mseM).toFixed(2) + "\n";
    //             div += (mseF/ mseM).toFixed(2) + "\n";
    //             console.log("FOV " + k * 2 + " MCM " + k2 * 2);
    //             console.log(mseF);
    //             console.log(mseM);
    //         }
    //         console.log("RATIO (used):", ratio.toFixed(2));
    //         console.log("DIFFERENCE:\n" + diff);
    //         console.log("F/M RATIO:\n" + div);
    //         // console.log("FOV BP:\n" + bpFOV);
    //         // console.log("MCM BP:\n" + bpMCM);

    //         let white = 0;
    //         let it = 0;
    //         for(let i = 0; i < this.resolution.height; i++) {
    //             for(let j = 0; j < this.resolution.width; j++) {
    //                 let index = (i * this.resolution.height + j) * 4;
    //                 let R = this.pixels[index];
    //                 let G = this.pixels[index+1];
    //                 let B = this.pixels[index+2];
    //                 if(R + G + B == 765)
    //                     white++;
    //                 it++;
    //             }
    //         }
    //         console.log("WHITE %: " + white / it);
    //     }

    //     this.countMCM++;
    // }
    // else if((this.renderer instanceof FOVRenderer || this.renderer instanceof MCMRenderer2 || this.renderer instanceof FOVRenderer2)) {
    //     if(this.countFOV % 2 == 0 && this.countFOV < 501) {
    //         let pixelsFOV = new Uint8Array(this.resolution.width * this.resolution.height * 4);
    //         gl.readPixels(0, 0, this.resolution.width, this.resolution.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsFOV);
    //         this.FOVList.push(pixelsFOV);

    //         if(this.countFOV == 500) {
    //             console.log("--- FOV READY ---");
    //             if(this.autoMeasure)
    //                 this.chooseRenderer("mcm");
    //         }
    //     }
        
    //     this.countFOV++;
    // }

    // if(this.count % 25 == 0 && this.timer != 0) {
    //     let type = "READ";
    //     if(this.renderer instanceof FOVRenderer || this.renderer instanceof FOVRenderer2)
    //         type = "FOV";
    //     else if(this.renderer instanceof MCMRenderer)
    //         type = "MCM";
    //     else if(this.renderer instanceof MIPRenderer)
    //         type = "MIP";
    //     console.log(`${type} Time: ${((this.timer / 25.0) / 1000000.0).toFixed(2)} ms`);
    //     this.timer = 0;
    // }
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
    if(this.VROn) {
        if(this.renderer) {
            this.renderer.disable = false;
            this.renderer.reset();
        }
        if(this.renderer2 && this.VRAnimator && this.VRAnimator.renderState == 1) {
            this.renderer2.disable = false;
            this.renderer2.reset();
        }

        Ticker.add(this._update);
        // Ticker.start(this.session, this.gl);
    }
    else
        Ticker.add(this.render);
}

stopRendering() {
    if(this.VROn) {
        if(this.renderer)
            this.renderer.disable = true;
        if(this.renderer2)
            this.renderer2.disable = true;
        Ticker.remove(this._update);
    }
    else
        Ticker.remove(this.render);
    // Ticker.reset();
}

}
