import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { EffectComposer } from "three/examples/jsm//postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler";

type WorldOptions = {
  parentElement: HTMLDivElement;
};

const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
    vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
`;

const FRAGMENT_SHADER = `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
        gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
    }
`;

const darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });

const N = 50000;

export class World {
  private clock: THREE.Clock;

  private scene: THREE.Scene;

  private camera: THREE.PerspectiveCamera;

  private light: THREE.DirectionalLight;

  private commonLight: THREE.AmbientLight;

  private renderer: THREE.WebGLRenderer;

  private controls: OrbitControls;

  private bloomComposer: EffectComposer;

  private finalComposer: EffectComposer;

  private uniforms = {
    globalBloom: { value: 1 },
  };

  constructor(options: WorldOptions) {
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;

    // Init clock to control animations
    this.clock = new THREE.Clock();

    // init Scene
    this.scene = new THREE.Scene();

    // Init Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      innerWidth / innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(-10, 10, 50);
    this.camera.lookAt(0, 0, 0);

    // Init Directional Light (to have shadows)
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.castShadow = true;
    this.light.position.set(2, 2, 2);
    this.light.shadow.mapSize.x = 2048;
    this.light.shadow.mapSize.y = 2048;
    this.scene.add(this.light);

    // Init common light
    this.commonLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.commonLight);

    // Init Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add canvas to a parent element
    options.parentElement.appendChild(this.renderer.domElement);

    // this.addFloor();
    this.addModel();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // bloom
    const renderScene = new RenderPass(this.scene, this.camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1,
      0,
      0.5
    );

    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(renderScene);
    this.bloomComposer.addPass(bloomPass);

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        defines: {},
      }),
      "baseTexture"
    );
    finalPass.needsSwap = true;

    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(renderScene);
    this.finalComposer.addPass(finalPass);

    // Run animation
    this.animate();
  }

  addModel = () => {
    const loader = new GLTFLoader();

    loader.load("./drone-simple.glb", (gltf) => {
      gltf.scene.position.set(0, 2, 0);
      gltf.scene.scale.setScalar(1);
      gltf.scene.rotateY(Math.PI);

      const names = [
        "polySurface131_quan_0",
        "polySurface131_quan_0_1",
        "Cube_003_xiao_0",
      ];

      gltf.scene.traverse((obj: any) => {
        if (obj.isMesh) {
          this.addParticles(obj);
        }

        if (obj.isMesh && names.includes(obj.name)) {
          obj.userData.isBloom = true;
        }
      });
    });
  };

  addParticles = (surfaceMesh: THREE.Mesh) => {
    // Create a sampler for a Mesh surface.
    const sampler = new MeshSurfaceSampler(surfaceMesh)
      .setWeightAttribute("color")
      .build();

    const sampleGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const sampleMaterial = new THREE.MeshStandardMaterial({
      // color: 0xffffff * Math.random(),
      color: 0xff1b41,
    });
    const sampleMesh = new THREE.InstancedMesh(
      sampleGeometry,
      sampleMaterial,
      N
    );

    sampleMesh.userData.isBloom = true;

    const _position = new THREE.Vector3();
    const _matrix = new THREE.Matrix4();

    // Sample randomly from the surface, creating an instance of the sample
    // geometry at each sample point.
    for (let i = 0; i < N; i++) {
      sampler.sample(_position);

      _matrix.makeTranslation(_position.x, _position.y, _position.z);

      sampleMesh.setMatrixAt(i, _matrix);
    }

    sampleMesh.instanceMatrix.needsUpdate = true;

    sampleMesh.scale.setScalar(0.5);
    // sampleMesh.rotateX(Math.PI / 10);
    sampleMesh.rotateY(-Math.PI / 3);

    this.scene.add(sampleMesh);
  };

  EXPLOSURE_DURATION = 5;
  EXPLOSURE_ACCELERATION = 0.99;
  EXPLOSURE_MAX_SPEED = 50;

  public explode = () => {
    this.scene.traverse((obj: any) => {
      if (obj.isMesh) {
        console.log("explode", obj);

        obj.userData.explode = true;
        obj.userData.duration = 0;
        obj.userData.speeds = Array.from(
          { length: N },
          (_) => Math.random() * this.EXPLOSURE_MAX_SPEED
        );
      }
    });
  };

  explosureStep = (
    mesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>,
    delta: number
  ) => {
    const dummy = new THREE.Object3D();
    const _matrix = new THREE.Matrix4();

    mesh.userData.duration += delta;

    const shouldStopAnimation =
      mesh.userData.duration > this.EXPLOSURE_DURATION;

    if (shouldStopAnimation) {
      mesh.userData.explode = false;
      mesh.visible = false;
      return;
    }

    for (let i = 0; i < N; i++) {
      mesh.getMatrixAt(i, _matrix);

      _matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const step = mesh.userData.speeds[i] * delta;
      mesh.userData.speeds[i] *= this.EXPLOSURE_ACCELERATION;

      dummy.position.add(
        dummy.position.clone().normalize().multiplyScalar(step)
      );

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  private animate = () => {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    this.controls.update();

    this.scene.traverse((object: any) => {
      if (object.isMesh) {
        const mesh = object as THREE.InstancedMesh<
          THREE.BoxGeometry,
          THREE.MeshStandardMaterial
        >;

        if (mesh.userData.explode) {
          this.explosureStep(mesh, delta);
        }
      }
    });

    this.scene.traverse((object: any) => {
      if (object.isMesh) {
        const mesh = object as THREE.InstancedMesh<
          THREE.BoxGeometry,
          THREE.MeshStandardMaterial
        >;

        if (!mesh.userData.isBloom) {
          this.darkenNonBloomed(mesh);
        }
      }
    });
    this.uniforms.globalBloom.value = 1;

    this.bloomComposer.render();

    this.scene.traverse((object: any) => {
      if (object.isMesh) {
        const mesh = object as THREE.InstancedMesh<
          THREE.BoxGeometry,
          THREE.MeshStandardMaterial
        >;

        if (!mesh.userData.isBloom) {
          this.restoreMaterial(mesh);
        }
      }
    });
    this.uniforms.globalBloom.value = 0;

    this.finalComposer.render();

    // this.renderer.render(this.scene, this.camera);
  };

  darkenNonBloomed = (obj: THREE.Mesh) => {
    obj.userData.material = obj.material;
    obj.material = darkMaterial;
  };

  restoreMaterial = (obj: THREE.Mesh) => {
    if (obj.userData.material) {
      obj.material = obj.userData.material;
    }
  };
}
