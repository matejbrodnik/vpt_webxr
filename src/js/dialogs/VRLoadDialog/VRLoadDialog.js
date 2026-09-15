import { DOMUtils } from '../../utils/DOMUtils.js';
import { Ticker } from './../../Ticker.js';

const template = document.createElement('template');
template.innerHTML = await fetch(new URL('./VRLoadDialog.html', import.meta.url))
    .then(response => response.text());

export class VRLoadDialog extends EventTarget {

constructor() {
    super();

    this.object = template.content.cloneNode(true);
    this.binds = DOMUtils.bind(this.object);

    this._handleVRClick = this._handleVRClick.bind(this);
    this._handleRepro = this._handleRepro.bind(this);
    this._handleEye = this._handleEye.bind(this);

    this._addEventListeners();
}

_addEventListeners() {
    this.binds.loadButton.addEventListener('click', this._handleVRClick);
    this.binds.reproButton.addEventListener('click', this._handleRepro);
    this.binds.eyeButton.addEventListener('click', this._handleEye);
}

_handleVRClick() {
    console.log("VR BUTTON");
    this.dispatchEvent(new CustomEvent('enter', {}));
}

_handleRepro() {
    console.log("REPRO BUTTON");
    this.dispatchEvent(new CustomEvent('repro', {}));
}

_handleEye() {
    console.log("EYE BUTTON");
    this.dispatchEvent(new CustomEvent('eye', {}));
}

}
