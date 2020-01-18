import * as THREE from 'three';
import simulationVert from '../shaders/simulation.vert';
import simulationFrag from '../shaders/simulation.frag';
import particlesVert from '../shaders/particles.vert';
import particlesFrag from '../shaders/particles.frag';
import glslify from 'glslify';

export default class FBO {
  constructor(renderer, bgScene, webGLView) {
    this.renderer = renderer;
    this.bgScene = bgScene;
    this.time = null;
    this.webGLView = webGLView;

    this.init();
  }

  async init() {
    await this.loadImageTexture();

    this.setInitialPositions();
    this.feedPositionsIntoDataTexture();
    this.createSimMaterial();
    this.initFBO();
    this.initRenderTargets();

    this.setupParticlesGeometry();
    this.setupParticlesMaterial();
    this.setupParticlesMesh();

    this.setupKeyboardControls();
  }

  loadImageTexture() {
    return new Promise((res, rej) => {
      var loader = new THREE.TextureLoader();

      loader.load('./logo-final-final.png', texture => {
        this.logoTexture = texture;
        res();
      });
    });
  }

  setupKeyboardControls() {
    document.addEventListener('keydown', e => {
      if (e.keyCode == 80) {
        // p
        console.log('resetting!');
        this.feedPositionsIntoDataTexture();
        this.createSimMaterial();
        this.initFBO();
        this.initRenderTargets();
        this.fboMesh.material.uniforms.posTex.value = this.dataTex;
        this.fboMesh.material.needsUpdate = true;
        this.particlesMaterial.needsUpdate = true;
      } else if (e.keyCode == 38) {
        // up
        console.log('positive z');
      } else if (e.keyCode == 39) {
        // right
        console.log('positive x');
      } else if (e.keyCode == 40) {
        // down
        console.log('negative z');
      }
    });
  }

  render(time) {
    // at the start of the render block, A is one frame behind B
    // const oldA = this.renderTargetA; // store A, the penultimate state
    // this.renderTargetA = this.renderTargetB; // advance A to the updated state
    // this.renderTargetB = oldA; // set B to the penultimate state

    if (!this.simMaterial) {
      return;
    }

    this.simMaterial.uniforms.uMouse.value = this.webGLView.mouse;

    // pass the updated positional values to the simulation
    // this.simMaterial.uniforms.posTex.value = this.renderTargetA.texture;
    this.simMaterial.uniforms.uTime.value = this.time;

    // run a frame and store the new positional values in renderTargetB
    this.renderer.setRenderTarget(this.renderTargetB);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    // this.renderer.render(this.scene, this.camera, this.renderTargetB, false);

    // pass the new positional values to the scene users see
    this.particlesMaterial.uniforms.posMap.value = this.renderTargetB.texture;

    // render the scene users see as normal
    // renderer.render(scene, camera);
  }

  setupParticlesMesh() {
    this.particlesMesh = new THREE.Points(
      this.particlesGeo,
      this.particlesMaterial
    );

    // this.particlesMesh.add(new THREE.AxesHelper());
    this.particlesMesh.rotation.z += Math.PI * 0.5;
    // this.particlesMesh.rotation.x -= Math.PI;
    this.bgScene.add(this.particlesMesh);
  }

  setupParticlesMaterial() {
    this.particlesMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        posMap: { type: 't', value: null } // `posMap` is set each render
      },
      vertexShader: glslify(particlesVert),
      fragmentShader: glslify(particlesFrag),
      transparent: true
    });
  }

  setupParticlesGeometry() {
    // store the uv attrs; each is x,y and identifies a given point's
    // position data within the positional texture; must be scaled 0:1!
    this.particlesGeo = new THREE.BufferGeometry();
    const arr = new Float32Array(this.w * this.h * 3);

    for (var i = 0; i < arr.length; i++) {
      arr[i++] = (i % this.w) / this.w;
      arr[i++] = Math.floor(i / this.w) / this.h;
      arr[i++] = 0;
    }

    this.particlesGeo.addAttribute(
      'position',
      new THREE.BufferAttribute(arr, 3, true)
    );
  }

  initRenderTargets() {
    // create render targets a + b to which the simulation will be rendered
    this.renderTargetA = new THREE.WebGLRenderTarget(this.w, this.h, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBFormat,
      type: THREE.FloatType,
      stencilBuffer: false
    });

    // a second render target lets us store input + output positional states
    this.renderTargetB = this.renderTargetA.clone();

    // render the positions to the render targets
    this.renderer.setRenderTarget(this.renderTargetA);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(this.renderTargetB);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  initFBO() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -this.w / 2,
      this.w / 2,
      this.w / 2,
      -this.w / 2,
      -1,
      1
    );
    this.fboMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.w, this.w),
      this.simMaterial
    );

    this.scene.add(this.fboMesh);
  }

  createSimMaterial() {
    this.simMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        posTex: {
          type: 't',
          value: this.dataTex
        },
        uTime: {
          type: 'f',
          value: null
        },
        logoTex: {
          type: 't',
          value: this.logoTexture
        },
        uMouse: {
          value: this.webGLView.mouse
        }
      },
      vertexShader: glslify(simulationVert),
      fragmentShader: glslify(simulationFrag)
    });
  }

  feedPositionsIntoDataTexture() {
    this.dataTex = new THREE.DataTexture(
      this.data,
      this.w,
      this.h,
      THREE.RGBFormat,
      THREE.FloatType
    );
    this.dataTex.minFilter = THREE.NearestFilter;
    this.dataTex.magFilter = THREE.NearestFilter;
    this.dataTex.needsUpdate = true;
  }

  setInitialPositions() {
    this.w = 512;
    this.h = 512;
    let i = 0;
    this.data = new Float32Array(this.w * this.h * 3);

    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        this.data[i++] = (x / this.w) * 2.0;
        this.data[i++] = (y / this.h) * 1.2;
        this.data[i++] = 0;
      }
    }
  }
}
