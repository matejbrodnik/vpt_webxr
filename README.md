# WebXR based Volumetric Path Tracer (VPT)

This is a continuation of directed (foveated) rendering VPT with the aim to speed up convergence. Complexity of the volume is estimated through maximum intensity projection (MIP), with more complex regions being sampled more frequently.

Visit the original project's [portfolio page](http://lgm.fri.uni-lj.si/research/volumetric-path-tracing-framework/) for more information on VPT.

Previous work on [directed rendering VPT](https://github.com/matejbrodnik/vpt_webxr)

## Building and running

You need only `node` to build the framework and to run it.

```bash
bin/packer
bin/server-node
```
