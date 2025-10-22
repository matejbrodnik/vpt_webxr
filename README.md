# [VPT: The Volumetric Path Tracing Framework](http://lgm.fri.uni-lj.si/research/volumetric-path-tracing-framework/)

This is a fork of the original VPT from https://github.com/terier/vpt that focuses on directed (foveated) rendering with the aim to speed up convergence. Complexity  of the volume is estimated through maximum intensity projection (MIP), with more complex regions being sampled more frequently.


Visit the original project's [portfolio page](http://lgm.fri.uni-lj.si/research/volumetric-path-tracing-framework/) for more information om VPT.

## Building and running

You need only `node` to build the framework and to run it.

```bash
bin/packer
bin/server-node
```
