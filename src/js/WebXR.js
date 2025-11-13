import { Ticker } from './Ticker.js';

export class WebXR {

    static async createSession(gl) {
        if (!navigator.xr) 
            throw new Error('WebXR not supported');
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            console.log("VR SESSION", supported)
        });
        this.session = await navigator.xr.requestSession('inline').then((session) => {
            // session = inlineSession;
            console.log(session);
            const glLayer = new XRWebGLLayer(session, gl);
            session.updateRenderState({
                baseLayer: glLayer,
                // inlineVerticalFieldOfView: Math.PI / 2,
            });
            console.log(glLayer);

            console.log("SESSION: ", session)
            Ticker.start(session);
        });
        return this.session;
    }

}