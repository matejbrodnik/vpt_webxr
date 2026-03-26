import { CommonUtils } from './utils/CommonUtils.js';

export class Survey {

constructor() {
    this.data = {results: []};
}



save(name) {
    CommonUtils.downloadJSON(this, `${name}.json`)
}

}
